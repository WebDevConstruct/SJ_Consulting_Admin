
import { z } from "zod";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

import {
  assertSameOrigin,
  BatchHttpError,
  getPrivilegedClient,
  handleBatchError,
  jsonResponse,
  requireQuestionOwner,
} from "@/lib/question-batches";

import {
  draftQuestionsSchema,
} from "@/lib/questions/batch-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{
    courseId: string;
    batchId: string;
  }>;
};

type CourseRow = {
  id: string;
  course_code: string;
  course_title: string;
  status: string;
};

type QuestionImportCourseRow = {
  id: string;
  status: string;
  exam_year: string | number | null;
  raw_text: string | null;
  draft_payload: {
    questions?: unknown[];
  } | null;
  updated_at: string;
};

type SavedBatchRow = {
  id: string;
  updated_at: string;
};

const paramsSchema = z.object({
  courseId: z.string().uuid(),
  batchId: z.string().uuid(),
});

const extractionResponseSchema = z.object({
  success: z.literal(true),
  extraction_method: z.enum([
    "cloudflare_ai",
    "text_parser",
  ]),
  questions: draftQuestionsSchema,
  warnings: z.array(z.string()),
  total_questions: z.number().int().nonnegative(),
  questions_missing_answers: z.number().int().nonnegative(),
  duplicate_candidates_removed: z.number().int().nonnegative(),
  requires_manual_entry: z.boolean(),
});

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    assertSameOrigin(request);
    await requireQuestionOwner();

    const ids = paramsSchema.safeParse(await context.params);

    if (!ids.success) {
      throw new BatchHttpError(
        400,
        "Invalid course or batch ID.",
      );
    }

    const { courseId, batchId } = ids.data;
    const supabase = getPrivilegedClient();

    const {
      data: courseData,
      error: courseError,
    } = await supabase
      .from("courses")
      .select("id, course_code, course_title, status")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) throw courseError;

    const course = courseData as CourseRow | null;

    if (!course) {
      throw new BatchHttpError(404, "Course not found.");
    }

    if (course.status === "archived") {
      throw new BatchHttpError(
        409,
        "Restore the archived course before extracting questions.",
      );
    }

    const {
      data: batchData,
      error: batchError,
    } = await supabase
      .from("question_import_courses")
      .select(
        [
          "id",
          "status",
          "exam_year",
          "raw_text",
          "draft_payload",
          "updated_at",
        ].join(","),
      )
      .eq("id", batchId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (batchError) throw batchError;

    const batch = batchData as QuestionImportCourseRow | null;

    if (!batch) {
      throw new BatchHttpError(
        404,
        "Batch not found for this course.",
      );
    }

    if (!["pending", "reviewing"].includes(batch.status)) {
      throw new BatchHttpError(
        409,
        "This batch is no longer editable.",
      );
    }

    const payload = batch.draft_payload as {
      questions?: unknown[];
    } | null;

    if (payload !== null) {
      if (!Array.isArray(payload.questions)) {
        throw new BatchHttpError(
          409,
          "This batch has an invalid saved draft. " +
            "Repair it before running extraction.",
        );
      }

      if (payload.questions.length > 0) {
        throw new BatchHttpError(
          409,
          "This batch already has draft questions. " +
            "Edit the existing draft instead of overwriting it.",
        );
      }
    }

    const rawText =
      typeof batch.raw_text === "string"
        ? batch.raw_text
        : "";

    if (!rawText.trim()) {
      throw new BatchHttpError(
        422,
        "No readable source text is saved for this batch.",
      );
    }

    if (rawText.length > 40_000) {
      throw new BatchHttpError(
        413,
        "The source exceeds the 40,000-character extraction limit. " +
          "Split it into smaller question-aware batches.",
      );
    }

    // Do not use a service-role client for this invocation.
    // The Edge Function must receive the signed-in owner's token.
    const sessionClient = await createClient();

    const { data: result, error: extractionError } =
      await sessionClient.functions.invoke(
        "extract-Json-from-pdf",
        {
          body: {
            textContent: rawText,
            course: {
              code: course.course_code,
              title: course.course_title,
              source_year:
                batch.exam_year === null
                  ? null
                  : Number(batch.exam_year),
            },
          },
        },
      );

    if (extractionError) {
      let message = "Unable to extract course questions.";
      let responseStatus = 502;

      if (extractionError instanceof FunctionsHttpError) {
        const upstreamStatus = extractionError.context.status;

        if (
          [400, 401, 403, 413, 422, 429, 504].includes(
            upstreamStatus,
          )
        ) {
          responseStatus = upstreamStatus;
        }

        try {
          const details = await extractionError.context.json();

          if (typeof details?.error === "string") {
            message = details.error;
          }
        } catch {
          // Keep the safe default message.
        }
      }

      console.error(
        "Course extraction invocation failed:",
        extractionError,
      );

      throw new BatchHttpError(responseStatus, message);
    }

    const validation =
      extractionResponseSchema.safeParse(result);

    if (!validation.success) {
      console.error(
        "Invalid course extraction response:",
        validation.error.issues,
      );

      throw new BatchHttpError(
        422,
        "Extraction returned invalid question data or exceeded " +
          "the editor's question limit. No draft was replaced.",
      );
    }

    const extracted = validation.data;

    if (
      extracted.total_questions !== extracted.questions.length
    ) {
      throw new BatchHttpError(
        422,
        "The extraction count does not match the returned questions. " +
          "No draft was replaced.",
      );
    }

    const {
      data: savedData,
      error: saveError,
    } = await supabase
      .from("question_import_courses")
      .update({
        status: "reviewing",
        extraction_payload: result,
        draft_payload: {
          questions: extracted.questions,
        },
        extraction_method: extracted.extraction_method,
        extraction_warnings: extracted.warnings,
      })
      .eq("id", batchId)
      .eq("course_id", courseId)
      .eq("updated_at", batch.updated_at)
      .in("status", ["pending", "reviewing"])
      .select("id, updated_at")
      .maybeSingle();

    if (saveError) throw saveError;

    const saved = savedData as SavedBatchRow | null;

    if (!saved) {
      throw new BatchHttpError(
        409,
        "The batch changed during extraction. " +
          "Reload to see the latest draft.",
      );
    }

    return jsonResponse({
      success: true,
      batch_id: saved.id,
      total_questions: extracted.questions.length,
      questions_missing_answers:
        extracted.questions_missing_answers,
      duplicate_candidates_removed:
        extracted.duplicate_candidates_removed,
      extraction_method: extracted.extraction_method,
      requires_manual_entry: extracted.questions.length === 0,
      updated_at: saved.updated_at,
    });
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}


// import { z } from "zod";
// import { FunctionsHttpError } from "@supabase/supabase-js";

// import { createClient } from "@/lib/supabase/server";

// import {
//   assertSameOrigin,
//   BatchHttpError,
//   getPrivilegedClient,
//   handleBatchError,
//   jsonResponse,
//   requireQuestionOwner,
// } from "@/lib/question-batches";

// import {
//   draftQuestionsSchema,
// } from "@/lib/questions/batch-schema";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";



// type Context = {
//   params: Promise<{
//     courseId: string;
//     batchId: string;
//   }>;
// };

// const paramsSchema = z.object({
//   courseId: z.string().uuid(),
//   batchId: z.string().uuid(),
// });

// const extractionResponseSchema = z.object({
//   success: z.literal(true),
//   extraction_method: z.enum([
//     "cloudflare_ai",
//     "text_parser",
//   ]),
//   questions: draftQuestionsSchema,
//   warnings: z.array(z.string()),

//   total_questions: z.number().int().nonnegative(),
//   questions_missing_answers: z.number().int().nonnegative(),
//   duplicate_candidates_removed: z.number().int().nonnegative(),

//   requires_manual_entry: z.boolean(),
// });

// export async function POST(
//   request: Request,
//   context: Context,
// ) {
//   try {
//     assertSameOrigin(request);
//     await requireQuestionOwner();

//     const ids = paramsSchema.safeParse(await context.params);

//     if (!ids.success) {
//       throw new BatchHttpError(
//         400,
//         "Invalid course or batch ID.",
//       );
//     }

//     const { courseId, batchId } = ids.data;
//     const supabase = getPrivilegedClient();

//     const {
//       data: course,
//       error: courseError,
//     } = await supabase
//       .from("courses")
//       .select("id, course_code, course_title, status")
//       .eq("id", courseId)
//       .maybeSingle();

//     if (courseError) throw courseError;

//     if (!course) {
//       throw new BatchHttpError(404, "Course not found.");
//     }

//     if (course.status === "archived") {
//       throw new BatchHttpError(
//         409,
//         "Restore the archived course before extracting questions.",
//       );
//     }

//     const {
//       data: batch,
//       error: batchError,
//     } = await supabase
//       .from("question_import_courses")
//       .select(
//         [
//           "id",
//           "status",
//           "exam_year",
//           "raw_text",
//           "draft_payload",
//           "updated_at",
//         ].join(","),
//       )
//       .eq("id", batchId)
//       .eq("course_id", courseId)
//       .maybeSingle();

//     if (batchError) throw batchError;

//     if (!batch) {
//       throw new BatchHttpError(
//         404,
//         "Batch not found for this course.",
//       );
//     }

//     if (!["pending", "reviewing"].includes(batch.status)) {
//       throw new BatchHttpError(
//         409,
//         "This batch is no longer editable.",
//       );
//     }

//     const payload = batch.draft_payload as unknown as {
//       questions?: unknown;
//     }  | null;

//     if (payload !== null) {
//       if (!Array.isArray(payload.questions)) {
//         throw new BatchHttpError(
//           409,
//           "This batch has an invalid saved draft. " +
//             "Repair it before running extraction.",
//         );
//       }

//       if (payload.questions.length > 0) {
//         throw new BatchHttpError(
//           409,
//           "This batch already has draft questions. " +
//             "Edit the existing draft instead of overwriting it.",
//         );
//       }
//     }

//     const rawText =
//       typeof batch.raw_text === "string"
//         ? batch.raw_text
//         : "";

//     if (!rawText.trim()) {
//       throw new BatchHttpError(
//         422,
//         "No readable source text is saved for this batch.",
//       );
//     }

//     if (rawText.length > 40_000) {
//       throw new BatchHttpError(
//         413,
//         "The source exceeds the 40,000-character extraction limit. " +
//           "Split it into smaller question-aware batches.",
//       );
//     }

//     // Do not use a service-role client for this invocation.
//     // The Edge Function must receive the signed-in owner's token.
//     const sessionClient = await createClient();

//     const { data: result, error: extractionError } =
//       await sessionClient.functions.invoke(
//         "extract-Json-from-pdf",
//         {
//           body: {
//             textContent: rawText,

//             course: {
//               code: course.course_code,
//               title: course.course_title,
//               source_year:
//                 batch.exam_year === null
//                   ? null
//                   : Number(batch.exam_year),
//             },
//           },
//         },
//       );

//     if (extractionError) {
//       let message = "Unable to extract course questions.";
//       let responseStatus = 502;

//       if (extractionError instanceof FunctionsHttpError) {
//         const upstreamStatus = extractionError.context.status;

//         if (
//           [400, 401, 403, 413, 422, 429, 504].includes(
//             upstreamStatus,
//           )
//         ) {
//           responseStatus = upstreamStatus;
//         }

//         try {
//           const details = await extractionError.context.json();

//           if (typeof details?.error === "string") {
//             message = details.error;
//           }
//         } catch {
//           // Keep the safe default message.
//         }
//       }

//       console.error(
//         "Course extraction invocation failed:",
//         extractionError,
//       );

//       throw new BatchHttpError(responseStatus, message);
//     }

//     const validation =
//       extractionResponseSchema.safeParse(result);

//     if (!validation.success) {
//       console.error(
//         "Invalid course extraction response:",
//         validation.error.issues,
//       );

//       throw new BatchHttpError(
//         422,
//         "Extraction returned invalid question data or exceeded " +
//           "the editor's question limit. No draft was replaced.",
//       );
//     }

//     const extracted = validation.data;

//     if (
//       extracted.total_questions !== extracted.questions.length
//     ) {
//       throw new BatchHttpError(
//         422,
//         "The extraction count does not match the returned questions. " +
//           "No draft was replaced.",
//       );
//     }

//     const {
//       data: saved,
//       error: saveError,
//     } = await supabase
//       .from("question_import_courses")
//       .update({
//         status: "reviewing",

//         // This preserves the extractor's prepared response.
//         // It is not the raw Cloudflare model envelope.
//         extraction_payload: result,

//         draft_payload: {
//           questions: extracted.questions,
//         },

//         extraction_method: extracted.extraction_method,
//         extraction_warnings: extracted.warnings,
//       })
//       .eq("id", batchId)
//       .eq("course_id", courseId)
//       .eq("updated_at", batch.updated_at)
//       .in("status", ["pending", "reviewing"])
//       .select("id, updated_at")
//       .maybeSingle();

//     if (saveError) throw saveError;

//     if (!saved) {
//       throw new BatchHttpError(
//         409,
//         "The batch changed during extraction. " +
//           "Reload to see the latest draft.",
//       );
//     }

//     return jsonResponse({
//       success: true,
//       batch_id: saved.id,
//       total_questions: extracted.questions.length,
//       questions_missing_answers:
//         extracted.questions_missing_answers,
//       duplicate_candidates_removed:
//         extracted.duplicate_candidates_removed,
//       extraction_method: extracted.extraction_method,
//       requires_manual_entry: extracted.questions.length === 0,
//       updated_at: saved.updated_at,
//     });
//   } catch (error: unknown) {
//     return handleBatchError(error);
//   }
// }

