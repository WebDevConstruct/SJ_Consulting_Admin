import {
  getPrivilegedClient,
  handleBatchError,
  jsonResponse,
  requireQuestionOwner,
} from "@/lib/question-batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireQuestionOwner();

    const supabase = getPrivilegedClient();

    const [subjectsResult, examsResult] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, name")
        .order("name", { ascending: true }),

      supabase
        .from("question_exam_types")
        .select("id, name")
        .order("name", { ascending: true }),
    ]);

    if (subjectsResult.error) throw subjectsResult.error;
    if (examsResult.error) throw examsResult.error;

    return jsonResponse({
      subjects: subjectsResult.data ?? [],
      exam_types: examsResult.data ?? [],
    });
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}