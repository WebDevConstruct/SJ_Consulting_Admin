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
  params: Promise<{ batchId: string }>;
};

export async function POST(
  request: Request,
  context: Context,
) {
  try {
    assertSameOrigin(request);
    await requireQuestionOwner();

    const { batchId } = await context.params;

    if (!z.string().uuid().safeParse(batchId).success) {
      throw new BatchHttpError(400, "Invalid batch ID.");
    }

    const supabase = getPrivilegedClient();

    const { data: batch, error } = await supabase
      .from("question_imports")
      .select(
        "id, status, subject_id, exam_year, raw_text, draft_payload, updated_at",
      )
      .eq("id", batchId)
      .maybeSingle();

    if (error) throw error;

    if (!batch) {
      throw new BatchHttpError(404, "Batch not found.");
    }

    if (!["pending", "reviewing"].includes(batch.status)) {
      throw new BatchHttpError(409, "This batch is not editable.");
    }

    const existing = batch.draft_payload as {
      questions?: unknown;
    } | null;

    if (
      Array.isArray(existing?.questions) &&
      existing.questions.length > 0
    ) {
      throw new BatchHttpError(
        409,
        "This batch already has draft questions. " +
          "Edit those questions rather than overwriting the draft.",
      );
    }

    const rawText =
      typeof batch.raw_text === "string" ? batch.raw_text : "";

    if (!rawText.trim()) {
      throw new BatchHttpError(422, "No extracted source text is saved.");
    }

    // Matches the Edge Function guardrail supplied earlier.
    // Do not truncate content to get around it.
    if (rawText.length > 1_000_000) {
      throw new BatchHttpError(
        413,
        "This source exceeds the current extraction batch limit. " +
          "Split the document into smaller question-aware batches.",
      );
    }

    const sessionClient = await createClient();

    const { data: result, error: extractionError } =
      await sessionClient.functions.invoke("extract-Json-from-pdf", {
        body: {
          textContent: rawText,
          subject: batch.subject_id,
          year: Number(batch.exam_year),
        },
      });

    if (extractionError) {
      let message = extractionError.message;

      if (extractionError instanceof FunctionsHttpError) {
        try {
          const details = await extractionError.context.json();
          message = details.error || message;
        } catch {
          // Preserve the original error message.
        }
      }

      throw new BatchHttpError(502, message);
    }

    if (!result?.success) {
      throw new BatchHttpError(
        502,
        result?.error || "Extraction did not complete.",
      );
    }

    const validation = draftQuestionsSchema.safeParse(result.questions);

    if (!validation.success) {
      throw new BatchHttpError(
        422,
        "The extraction has invalid fields or exceeds 100 questions. " +
          "No draft was replaced. Split oversized documents.",
      );
    }

    const extractionWarnings = Array.isArray(result.warnings)
      ? result.warnings.filter(
          (warning: unknown): warning is string =>
            typeof warning === "string",
        )
      : [];

    const { data: saved, error: saveError } = await supabase
      .from("question_imports")
      .update({
        status: "reviewing",
        draft_payload: {
          questions: validation.data,
        },
        extraction_method:
          typeof result.extraction_method === "string"
            ? result.extraction_method
            : "cloudflare_ai",
        extraction_warnings: extractionWarnings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId)
      .eq("updated_at", batch.updated_at)
      .in("status", ["pending", "reviewing"])
      .select("id")
      .maybeSingle();

    if (saveError) throw saveError;

    if (!saved) {
      throw new BatchHttpError(
        409,
        "The batch changed during extraction. Reload to see the latest draft.",
      );
    }

    return jsonResponse({
      success: true,
      total_questions: validation.data.length,
      requires_manual_entry: validation.data.length === 0,
    });
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}