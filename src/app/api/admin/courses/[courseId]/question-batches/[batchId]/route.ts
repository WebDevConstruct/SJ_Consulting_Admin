import { createClient } from "@/lib/supabase/server";

import {
  assertSameOrigin,
  BatchHttpError,
  handleBatchError,
  jsonResponse,
  requireQuestionOwner,
} from "@/lib/question-batches";

import {
  saveDraftSchema,
  type DraftQuestion,
} from "@/lib/questions/batch-schema";
import {getPrivilegedClient} from "@lib/question-batches"
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    courseId: string;
    batchId: string;
  }>;
};

type CourseBatchRow = {
  id: string;
  course_id: string;
  title: string;
  exam_year: string | null;
  status: "pending" | "reviewing" | "approved" | "archived";
  original_filename: string;
  raw_text: string | null;
  extraction_warnings: string[] | null;

  updated_at: string;
draft_payload : DraftQuestion[] | null;
  courses: {
    id: string;
    course_code: string;
    course_title: string;
    college_name: string;
    status: "draft" | "active" | "archived";
  };
};

type CourseBatchStatusRow = {
  id: string;
  status: "pending" | "reviewing" | "approved" | "archived";
  updated_at: string;
  question_count : number | null
  courses: {
    status: "draft" | "active" | "archived";
  };
};

export async function GET(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await assertSameOrigin(request);
    await requireQuestionOwner();

    const { courseId, batchId } = await params;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("question_import_courses")
      .select(`
        id,
        course_id,
        title,
        exam_year,
        status,
        original_filename,
        raw_text,
        extraction_warnings,
        updated_at,
        draft_payload,
  
        courses (
          id,
          course_code,
          course_title,
          college_name,
          status
        )
      `)
      .eq("id", batchId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (error) {
        console.log(error);
      throw new BatchHttpError(
        500,
        "Unable to load the course batch.",
      );
    }

    if (!data) {
      throw new BatchHttpError(404, "Course batch not found.");
    }

    const batch  = data as unknown as CourseBatchRow ;
  
    const course = batch.courses;
 //   console.log(course);

    if (!course) {
      throw new BatchHttpError(404, "Course not found.");
    }

    const batchEditable =
      batch.status === "pending" || batch.status === "reviewing";
  
    return jsonResponse({
      batch: {
        id: batch.id,
        course_id: batch.course_id,
        title: batch.title,
        exam_year: batch.exam_year ? Number(batch.exam_year) : null,
        status: batch.status,
        original_filename: batch.original_filename,
        raw_text: batch.raw_text ?? "",
        extraction_warnings: batch.extraction_warnings ?? [],

        updated_at: batch.updated_at,
      },
      course: {
        id: course.id,
        course_code: course.course_code,
        course_title: course.course_title,
        college_name: course.college_name,
        status: course.status,
      },
      questions: batch.draft_payload ?? [],
      editable: batchEditable && course.status !== "archived",
      source_url: null,
      source_warning: null,
    });
  } catch (error) {
    return handleBatchError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await assertSameOrigin(request);
    await requireQuestionOwner();

    const { courseId, batchId } = await params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new BatchHttpError(400, "Invalid JSON body.");
    }

    const parsed = saveDraftSchema.safeParse(body);
   console.log("Parsed", parsed);
    if (!parsed.success) {
      return jsonResponse(
        {
          error: "Invalid draft payload.",
          issues: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        422,
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from("question_import_courses")
      .select(`
        id,
        status,
        updated_at,
        courses (
          status
        )
      `)
      .eq("id", batchId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (error) {
      throw new BatchHttpError(
        500,
        "Unable to verify the course batch.",
      );
    }

    if (!data) {
      throw new BatchHttpError(404, "Course batch not found.");
    }

    const batch = data as unknown as CourseBatchStatusRow;
   console.log("Batch", batch)
    const courseStatus = batch.courses?.status;
    //console.log("Course Status", courseStatus);
    if (!courseStatus) {
      throw new BatchHttpError(404, "Course not found.");
    }

    if (courseStatus === "archived") {
      throw new BatchHttpError(
        409,
        "This course is archived and cannot be edited.",
      );
    }

    if (batch.status !== "pending" && batch.status !== "reviewing") {
      throw new BatchHttpError(
        409,
        "This batch can no longer be edited.",
      );
    }

    if (batch.updated_at !== parsed.data.expected_updated_at) {
      throw new BatchHttpError(
        409,
        "This batch was updated in another session. Reload it and try again.",
      );
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("question_import_courses")
      .update({
        draft_payload: {
        questions :  parsed.data.questions
        },
        status: "reviewing",
        updated_at: now,
      })
      .eq("id", batchId)
      .eq("course_id", courseId)
      .eq("updated_at", parsed.data.expected_updated_at);
  console.log(updateError)
    if (updateError) {
      throw new BatchHttpError(
        500,
        "Unable to save the course batch draft.",
      );
    }

    return jsonResponse({
      batch_id: batchId,
      status: "reviewing",
      updated_at: now,
    });
  } catch (error) {
    return handleBatchError(error);
  }
}
export async function DELETE(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await assertSameOrigin(request);
    await requireQuestionOwner();

    const { courseId, batchId } = await params;

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "delete_course_question_import",
      {
        p_course_id: courseId,
        p_import_id: batchId,
      },
    );

    if (error) {
      console.error("Course question batch deletion failed:", error);

      const status =
        error.code === "42501"
          ? 403
          : error.code === "P0002"
            ? 404
            : 500;

      return jsonResponse(
        {
          error:
            status === 500
              ? "Unable to delete this course batch."
              : error.message,
        },
        status,
      );
    }

    const result = data as {
      success?: boolean;
      storage_bucket?: string | null;
      storage_path?: string | null;
      deleted_questions ?: number | null

    } | null;

    if (!result?.success) {
      throw new BatchHttpError(
        500,
        "Batch deletion did not return a valid result.",
      );
    }

    let storageWarning: string | null = null;

    if (result.storage_bucket && result.storage_path) {
      const storage = getPrivilegedClient();

      const { error: storageError } = await storage.storage
        .from(result.storage_bucket)
        .remove([result.storage_path]);

      if (storageError) {
        console.error(
          "Course batch source-file deletion failed:",
          storageError,
        );

        storageWarning =
          "The batch was deleted, but its stored source file could not be removed.";
      }
    }

    return jsonResponse({
      message: storageWarning ?? "Course batch deleted.",
      batch_id: batchId,
      course_id: courseId,
      deleted_questions: result.deleted_questions  ?? null,
      storage_warning: storageWarning,
    });
  } catch (error) {
    return handleBatchError(error);
  }
}