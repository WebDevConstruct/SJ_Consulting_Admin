import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import {
  assertSameOrigin,
  BatchHttpError,
  handleBatchError,
  jsonResponse,
  requireQuestionOwner,
} from "@/lib/question-batches";

import {
  courseApprovalSchema,
} from "@/lib/courses/question-publication-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{
    courseId: string;
    batchId: string;
  }>;
};

type ApprovalResult = {
  success: boolean;
  import_id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  total_questions: number;
  status: "approved";
};

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    assertSameOrigin(request);
    await requireQuestionOwner();

    const params = await context.params;

    const ids = z.object({
      courseId: z.string().uuid(),
      batchId: z.string().uuid(),
    }).safeParse(params);

    if (!ids.success) {
      throw new BatchHttpError(
        400,
        "Invalid course or batch ID.",
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new BatchHttpError(
        400,
        "Request body must be valid JSON.",
      );
    }

    const validation = courseApprovalSchema.safeParse(body);

    if (!validation.success) {
      return jsonResponse(
        {
          error: "Questions are not ready for publication.",
          issues: validation.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }

   
    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "approve_course_question_import",
      {
        p_course_id: ids.data.courseId,
        p_import_id: ids.data.batchId,
        p_questions: validation.data.questions,
      },
    );
    if (error) {
      console.error("Course question approval failed:", error);

      const status =
        error.code === "42501"
          ? 403
          : error.code === "P0002"
            ? 404
            : error.code === "P0001" ||
                error.code === "23505"
              ? 409
              : error.code === "22023"
                ? 400
                : 500;

      return jsonResponse(
        {
          error:
            status === 500
              ? "Unable to publish this course batch."
              : error.code === "23505"
                ? "This batch already contains published question positions."
                : error.message,
        },
        status,
      );
    }

    const result = data as ApprovalResult | null;

    if (!result?.success) {
      throw new BatchHttpError(
        500,
        "Publication did not return a valid result.",
      );
    }

    return jsonResponse(
      {
        ...result,
        message:
          `Successfully published ${result.total_questions} ` +
          `questions for ${result.course_code}.`,
      },
      201,
    );
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}

// DELETING THE BATCHES
