import { z } from "zod";

const labelledTextSchema = z.object({
  label: z.string().refine(
    (value) => value.trim().length > 0,
    "Label is required.",
  ),

  text: z.string().refine(
    (value) => value.trim().length > 0,
    "Text is required.",
  ),
}).strict();

export const coursePublishQuestionSchema = z.object({
  question_number: z.string().refine(
    (value) => value.trim().length > 0,
    "Question number is required.",
  ),

  question_type: z.literal("multiple_choice"),

  question_text: z.string().refine(
    (value) => value.trim().length > 0,
    "Question text is required.",
  ),

  options: z.array(
    z.object({
      label: z.string().regex(
        /^[A-Z0-9]{1,5}$/,
        "Use 1–5 uppercase letters or digits.",
      ),

      text: z.string().refine(
        (value) => value.trim().length > 0,
        "Option text is required.",
      ),
    }).strict(),
  ).min(2).max(30),

  subquestions: z.array(labelledTextSchema),

  correct_option: z.string().regex(
    /^[A-Z0-9]{1,5}$/,
    "Choose an approved option label.",
  ),

  answer_source: z.enum([
    "source_answer_key",
    "admin_provided",
  ]),

  explanation: z.string(),

  source_page: z.number()
    .int()
    .positive()
    .max(2_147_483_647)
    .nullable(),

  warnings: z.array(z.string()).max(
    0,
    "Resolve all warnings before publishing.",
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
      message: "Correct option must match an existing option label.",
    });
  }
});

export const courseApprovalSchema = z.object({
  reviewed: z.literal(true),

  questions: z.array(coursePublishQuestionSchema)
    .min(1)
    .max(100),
}).strict();