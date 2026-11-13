import { z } from "zod";

export const labelledTextSchema = z.object({
  label: z.string().max(30),
  text: z.string().max(30_000),
}).strict();

export const draftQuestionSchema = z.object({
  question_number: z.string().max(100),
  question_type: z.enum(["multiple_choice", "essay"]),
  question_text: z.string().max(100_000),
  options: z.array(labelledTextSchema).max(30),
  subquestions: z.array(labelledTextSchema).max(100),
  correct_option: z.string().max(30).nullable(),
  explanation: z.string().max(100_000),
  source_page: z.number().int().positive().nullable(),
  answer_source: z.enum([
    "source_answer_key",
    "admin_provided",
    "not_provided",
  ]),
  warnings: z.array(z.string().max(5_000)).max(100),
}).strict();

export const draftQuestionsSchema = z.array(
  draftQuestionSchema,
).max(100);

export const saveDraftSchema = z.object({
  expected_updated_at: z.string().datetime({ offset: true }),
  questions: draftQuestionsSchema,
}).strict();

export type DraftQuestion = z.infer<typeof draftQuestionSchema>;

export function publicationIssues(
  questions: DraftQuestion[],
): string[] {
  const issues: string[] = [];

  if (questions.length === 0) {
    return ["Add at least one question."];
  }

  if (questions.length > 100) {
    issues.push("A batch cannot contain more than 100 questions.");
  }

  questions.forEach((question, index) => {
    const prefix = `Question ${question.question_number || index + 1}`;
    const labels = question.options.map((option) => option.label);

    if (!question.question_number.trim()) {
      issues.push(`${prefix}: source number is missing.`);
    }

    if (!question.question_text.trim()) {
      issues.push(`${prefix}: question text is missing.`);
    }

    if (question.question_type !== "multiple_choice") {
      issues.push(`${prefix}: essay grading is not enabled.`);
    }

    if (question.options.length < 2) {
      issues.push(`${prefix}: at least two options are required.`);
    }

    if (
      question.options.some(
        (option) => !option.label.trim() || !option.text.trim(),
      )
    ) {
      issues.push(`${prefix}: an option is incomplete.`);
    }

    if (new Set(labels).size !== labels.length) {
      issues.push(`${prefix}: option labels are duplicated.`);
    }

    if (
      !question.correct_option ||
      !labels.includes(question.correct_option)
    ) {
      issues.push(`${prefix}: select a valid correct option.`);
    }

    if (
      !["source_answer_key", "admin_provided"].includes(
        question.answer_source,
      )
    ) {
      issues.push(`${prefix}: answer source is not approved.`);
    }

    if (question.warnings.length > 0) {
      issues.push(`${prefix}: resolve extraction warnings.`);
    }
  });

  return issues;
}