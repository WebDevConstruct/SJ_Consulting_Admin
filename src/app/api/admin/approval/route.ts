import { NextResponse } from 'next/server';
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const labelledTextSchema = z.object({
  label: z.string().refine(
    (value) => value.trim().length > 0,
    "Option label is required.",
  ),
  text: z.string().refine(
    (value) => value.trim().length > 0,
    "Option text is required.",
  ),
}).strict();

const publishQuestionSchema = z.object({
  question_number: z.string().refine(
    (value) => value.trim().length > 0,
    "Question number is required.",
  ),
  question_type: z.literal("multiple_choice"),
  question_text: z.string().refine(
    (value) => value.trim().length > 0,
    "Question text is required.",
  ),
  options: z.array(labelledTextSchema).min(2),
  subquestions: z.array(labelledTextSchema),
  correct_option: z.string().min(1),
  answer_source: z.enum([
    "source_answer_key",
    "admin_provided",
  ]),
  explanation: z.string(),
  source_page: z.number().int().positive().nullable(),
  warnings: z.array(z.string()).max(
    0,
    "Resolve question warnings before publishing.",
  ),
}).strict().superRefine((question, context) => {
  const labels = question.options.map((option) => option.label);

  if (new Set(labels).size !== labels.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "Option labels must be unique.",
    });
  }

  if (!labels.includes(question.correct_option)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["correct_option"],
      message: "Correct option must match an existing label.",
    });
  }
});

const approvalSchema = z.object({
  import_id: z.string().uuid(),
  reviewed: z.literal(true),
  questions: z.array(publishQuestionSchema).min(1).max(100),
}).strict();

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    // Reject cross-origin browser publication requests.
    // If deployed behind a proxy that changes request.url,
    // configure this against your trusted application origin.
    const origin = request.headers.get("origin");

    if (origin && origin !== new URL(request.url).origin) {
      return respond({ error: "Invalid request origin." }, 403);
    }

    const supabase = await createClient();

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return respond(
        { error: "Please sign in again." },
        401,
      );
    }

    const {
      data: isOwner,
      error: ownerError,
    } = await supabase.rpc("is_question_owner");

    if (ownerError) {
      console.error("Owner access check failed", ownerError);
      return respond(
        { error: "Unable to verify owner access." },
        500,
      );
    }

    if (isOwner !== true) {
      return respond(
        { error: "An active owner account is required." },
        403,
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return respond(
        { error: "Request body must be valid JSON." },
        400,
      );
    }

    const validation = approvalSchema.safeParse(body);

    if (!validation.success) {
      return respond(
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

    const {
      data: result,
      error: approvalError,
    } = await supabase.rpc("approve_question_import", {
      p_import_id: validation.data.import_id,
      p_questions: validation.data.questions,
    });

    if (approvalError) {
      console.error("Question approval failed", approvalError);

      const status =
        approvalError.code === "42501"
          ? 403
          : approvalError.code === "P0002"
          ? 404
          : approvalError.code === "P0001"
          ? 409
          : approvalError.code === "22023"
          ? 400
          : 500;

      return respond(
        {
          error:
            status === 500
              ? "Unable to approve this import."
              : approvalError.message,
        },
        status,
      );
    }

    return respond(
      {
        ...result,
        message:
          `Successfully published ${result.total_questions} questions ` +
          `for ${result.subject} (${result.year}).`,
      },
      201,
    );
  } catch (error: unknown) {
    console.error(
      "Unexpected approval error",
      error instanceof Error ? error.message : error,
    );

    return respond(
      { error: "Server error during approval." },
      500,
    );
  }
}