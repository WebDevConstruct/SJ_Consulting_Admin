import { z } from "zod";

import {
  BatchHttpError,
  assertSameOrigin,
  getPrivilegedClient,
  handleBatchError,
  jsonResponse,
  QUESTION_BUCKET,
  requireQuestionOwner,
} from "@/lib/question-batches";

import {
  draftQuestionsSchema,
  saveDraftSchema,
} from "@/lib/questions/batch-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{ batchId: string }>;
};

type QuestionImportRow = {
  id: string;
  title: string | null;
  subject_id: string;
  exam_type_id: string | null;
  exam_year: string | number | null;
  status: string;
  storage_path: string | null;
  original_filename: string | null;
  raw_text: string | null;
  draft_payload: {
    questions?: unknown[];
  } | null;
  extraction_method: string | null;
  extraction_warnings: unknown[] | null;
  created_at: string;
  updated_at: string;
};

type SubjectRow = {
  name: string;
};

type ExamTypeRow = {
  name: string;
};

type QuestionRow = {
  question_number: number | string | null;
  question_type: string | null;
  question_text: string;
  options: unknown;
  subquestions: unknown;
  correct_option: string | null;
  explanation: string | null;
  source_page: number | string | null;
  answer_source: string | null;
  warnings: unknown[] | null;
};

type UpdatedBatchRow = {
  id: string;
  updated_at: string;
};

async function getBatchId(context: Context) {
  const { batchId } = await context.params;

  if (!z.string().uuid().safeParse(batchId).success) {
    throw new BatchHttpError(400, "Invalid batch ID.");
  }

  return batchId;
}

export async function GET(
  _request: Request,
  context: Context,
) {
  try {
    await requireQuestionOwner();

    const batchId = await getBatchId(context);
    const supabase = getPrivilegedClient();

    const {
      data: batchData,
      error,
    } = await supabase
      .from("question_imports")
      .select(
        [
          "id",
          "title",
          "subject_id",
          "exam_type_id",
          "exam_year",
          "status",
          "storage_path",
          "original_filename",
          "raw_text",
          "draft_payload",
          "extraction_method",
          "extraction_warnings",
          "created_at",
          "updated_at",
        ].join(","),
      )
      .eq("id", batchId)
      .maybeSingle();

    if (error) throw error;

    const batch = batchData as QuestionImportRow | null;

    if (!batch) {
      throw new BatchHttpError(404, "Batch not found.");
    }

    const [
      subjectResult,
      examResult,
    ] = await Promise.all([
      supabase
        .from("subjects")
        .select("name")
        .eq("id", batch.subject_id)
        .maybeSingle(),

      batch.exam_type_id
        ? supabase
            .from("question_exam_types")
            .select("name")
            .eq("id", batch.exam_type_id)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),
    ]);

    if (subjectResult.error) throw subjectResult.error;
    if (examResult.error) throw examResult.error;

    const subject = subjectResult.data as SubjectRow | null;
    const examType = examResult.data as ExamTypeRow | null;

    let questions: unknown[] = [];

    if (batch.status === "approved") {
      const result = await supabase
        .from("questions")
        .select(
          [
            "question_number",
            "question_type",
            "question_text",
            "options",
            "subquestions",
            "correct_option",
            "explanation",
            "source_page",
            "answer_source",
            "warnings",
          ].join(","),
        )
        .order("position_in_import", {
          ascending: true,
          nullsFirst: false,
        })
        .order("created_at")
        .order("id");

      if (result.error) throw result.error;

      questions = (result.data as unknown as QuestionRow[] | null) ?? [];
    } else {
      const payload = batch.draft_payload as {
        questions?: unknown[];
      } | null;

      questions = Array.isArray(payload?.questions)
        ? payload.questions
        : [];
    }

    const validation = draftQuestionsSchema.safeParse(questions);

    if (!validation.success) {
      throw new BatchHttpError(
        409,
        "This batch contains legacy or invalid question data. " +
          "It needs normalisation before this editor can open it.",
      );
    }

    let sourceUrl: string | null = null;

    if (batch.storage_path) {
      const signed = await supabase.storage
        .from(QUESTION_BUCKET)
        .createSignedUrl(batch.storage_path, 300);

      if (signed.error) {
        console.error(
          "Source URL generation failed:",
          signed.error,
        );
      } else {
        sourceUrl = signed.data.signedUrl;
      }
    }

    return jsonResponse({
      batch: {
        id: batch.id,
        title: batch.title || "Untitled question batch",
        subject_id: batch.subject_id,
        subject_name: subject?.name || batch.subject_id,
        exam_type_name: examType?.name || "Unassigned exam",
        exam_year: batch.exam_year,
        status: batch.status,
        original_filename: batch.original_filename,
        raw_text: batch.raw_text || "",
        extraction_method: batch.extraction_method,
        extraction_warnings: Array.isArray(
          batch.extraction_warnings,
        )
          ? batch.extraction_warnings
          : [],
        updated_at: batch.updated_at,
      },
      questions: validation.data,
      source_url: sourceUrl,
    });
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}

export async function PATCH(
  request: Request,
  context: Context,
) {
  try {
    assertSameOrigin(request);
    await requireQuestionOwner();

    const batchId = await getBatchId(context);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new BatchHttpError(400, "Invalid JSON request.");
    }

    const validation = saveDraftSchema.safeParse(body);

    if (!validation.success) {
      throw new BatchHttpError(
        400,
        validation.error.issues
          .map(
            (issue) =>
              `${issue.path.join(".")}: ${issue.message}`,
          )
          .join("; "),
      );
    }

    const supabase = getPrivilegedClient();

    const {
      data: updatedData,
      error,
    } = await supabase
      .from("question_imports")
      .update({
        draft_payload: {
          questions: validation.data.questions,
        },
        status: "reviewing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId)
      .eq("updated_at", validation.data.expected_updated_at)
      .in("status", ["pending", "reviewing"])
      .select("id, updated_at")
      .maybeSingle();

    if (error) throw error;

    const updated = updatedData as UpdatedBatchRow | null;

    if (!updated) {
      throw new BatchHttpError(
        409,
        "The batch changed or is no longer editable. " +
          "Reload before saving again.",
      );
    }

    return jsonResponse({
      success: true,
      updated_at: updated.updated_at,
    });
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}



// import { z } from "zod";

// import {
//   BatchHttpError,
//   assertSameOrigin,
//   getPrivilegedClient,
//   handleBatchError,
//   jsonResponse,
//   QUESTION_BUCKET,
//   requireQuestionOwner,
// } from "@/lib/question-batches";

// import {
//   draftQuestionsSchema,
//   saveDraftSchema,
// } from "@/lib/questions/batch-schema";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

// type Context = {
//   params: Promise<{ batchId: string }>;
// };

// async function getBatchId(context: Context) {
//   const { batchId } = await context.params;

//   if (!z.string().uuid().safeParse(batchId).success) {
//     throw new BatchHttpError(400, "Invalid batch ID.");
//   }

//   return batchId;
// }

// export async function GET(
//   _request: Request,
//   context: Context,
// ) {
//   try {
//     await requireQuestionOwner();

//     const batchId = await getBatchId(context);
//     const supabase = getPrivilegedClient();

//     const { data: batch, error } = await supabase
//       .from("question_imports")
//       .select(
//         [
//           "id",
//           "title",
//           "subject_id",
//           "exam_type_id",
//           "exam_year",
//           "status",
//           "storage_path",
//           "original_filename",
//           "raw_text",
//           "draft_payload",
//           "extraction_method",
//           "extraction_warnings",
//           "created_at",
//           "updated_at",
//         ].join(","),
//       )
//       .eq("id", batchId)
//       .maybeSingle();

//     if (error) throw error;

//     if (!batch) {
//       throw new BatchHttpError(404, "Batch not found.");
//     }

//     const [
//       subjectResult,
//       examResult,
//     ] = await Promise.all([
//       supabase
//         .from("subjects")
//         .select("name")
//         .eq("id", batch.subject_id)
//         .maybeSingle(),

//       batch.exam_type_id
//         ? supabase
//             .from("question_exam_types")
//             .select("name")
//             .eq("id", batch.exam_type_id)
//             .maybeSingle()
//         : Promise.resolve({ data: null, error: null }),
//     ]);

//     if (subjectResult.error) throw subjectResult.error;
//     if (examResult.error) throw examResult.error;

//     let questions: unknown[] = [];

//     if (batch.status === "approved") {
//       const result = await supabase
//         .from("questions")
//         .select(
//           [
//             "question_number",
//             "question_type",
//             "question_text",
//             "options",
//             "subquestions",
//             "correct_option",
//             "explanation",
//             "source_page",
//             "answer_source",
//             "warnings",
//           ].join(","),
//         )
//        .order("position_in_import", {
//   ascending: true,
//   nullsFirst: false,
// })
// .order("created_at")
// .order("id")

//       if (result.error) throw result.error;

//       questions = result.data ?? [];
//     } else {
//       const payload = batch.draft_payload as {
//         questions?: unknown;
//       } | null;

//       questions = Array.isArray(payload?.questions)
//         ? payload.questions
//         : [];
//     }

//     const validation = draftQuestionsSchema.safeParse(questions);

//     if (!validation.success) {
//       throw new BatchHttpError(
//         409,
//         "This batch contains legacy or invalid question data. " +
//           "It needs normalisation before this editor can open it.",
//       );
//     }

//     let sourceUrl: string | null = null;

//     if (batch.storage_path) {
//       const signed = await supabase.storage
//         .from(QUESTION_BUCKET)
//         .createSignedUrl(batch.storage_path, 300);

//       if (signed.error) {
//         console.error("Source URL generation failed:", signed.error);
//       } else {
//         sourceUrl = signed.data.signedUrl;
//       }
//     }

//     return jsonResponse({
//       batch: {
//         id: batch.id,
//         title: batch.title || "Untitled question batch",
//         subject_id: batch.subject_id,
//         subject_name: subjectResult.data?.name || batch.subject_id,
//         exam_type_name: examResult.data?.name || "Unassigned exam",
//         exam_year: batch.exam_year,
//         status: batch.status,
//         original_filename: batch.original_filename,
//         raw_text: batch.raw_text || "",
//         extraction_method: batch.extraction_method,
//         extraction_warnings: Array.isArray(batch.extraction_warnings)
//           ? batch.extraction_warnings
//           : [],
//         updated_at: batch.updated_at,
//       },
//       questions: validation.data,
//       source_url: sourceUrl,
//     });
//   } catch (error: unknown) {
//     return handleBatchError(error);
//   }
// }

// export async function PATCH(
//   request: Request,
//   context: Context,
// ) {
//   try {
//     assertSameOrigin(request);
//     await requireQuestionOwner();

//     const batchId = await getBatchId(context);

//     let body: unknown;

//     try {
//       body = await request.json();
//     } catch {
//       throw new BatchHttpError(400, "Invalid JSON request.");
//     }

//     const validation = saveDraftSchema.safeParse(body);

//     if (!validation.success) {
//       throw new BatchHttpError(
//         400,
//         validation.error.issues
//           .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
//           .join("; "),
//       );
//     }

//     const supabase = getPrivilegedClient();

//     const { data, error } = await supabase
//       .from("question_imports")
//       .update({
//         draft_payload: {
//           questions: validation.data.questions,
//         },
//         status: "reviewing",
//         updated_at: new Date().toISOString(),
//       })
//       .eq("id", batchId)
//       .eq("updated_at", validation.data.expected_updated_at)
//       .in("status", ["pending", "reviewing"])
//       .select("id, updated_at")
//       .maybeSingle();

//     if (error) throw error;

//     if (!data) {
//       throw new BatchHttpError(
//         409,
//         "The batch changed or is no longer editable. " +
//           "Reload before saving again.",
//       );
//     }

//     return jsonResponse({
//       success: true,
//       updated_at: data.updated_at,
//     });
//   } catch (error: unknown) {
//     return handleBatchError(error);
//   }
// }