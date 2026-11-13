import { randomUUID } from "node:crypto";
import { extractText } from "unpdf";
import { z } from "zod";

import {
  assertSameOrigin,
  BatchHttpError,
  getPrivilegedClient,
  handleBatchError,
  jsonResponse,
  MAX_FILE_BYTES,
  QUESTION_BUCKET,
  requireQuestionOwner,
} from "@/lib/question-batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = {
  params: Promise<{
    courseId: string;
  }>;
};

// Keep aligned with the existing extraction route's guardrail.
// Reject oversized extracted text before storing a batch that
// the current extractor cannot process.
const MAX_EXTRACTION_CHARACTERS = 40_000;

const listSchema = z.object({
  page: z.coerce.number()
    .int()
    .min(1)
    .max(100_000)
    .default(1),

  page_size: z.coerce.number()
    .int()
    .min(1)
    .max(50)
    .default(12),

  view: z.enum([
    "all",
    "attention",
    "published",
  ]).default("all"),

  search: z.string()
    .trim()
    .max(100)
    .optional(),

  exam_year: z.string()
    .regex(/^[0-9]{4}$/, "Use a four-digit source-paper year.")
    .optional(),
});

const createBatchSchema = z.object({
  title: z.string().trim().max(100),

  // Optional source-paper year.
  // This is not the student's level or offering academic session.
  exam_year: z.string()
    .regex(/^[0-9]{4}$/, "Use a four-digit source-paper year.")
    .nullable(),
});

function validationMessage(error: z.ZodError) {
  return error.issues
    .map(
      (issue) =>
        `${issue.path.join(".") || "request"}: ${issue.message}`,
    )
    .join("; ");
}

async function getCourseId(context: Context) {
  const { courseId } = await context.params;

  const validation = z.string().uuid().safeParse(courseId);

  if (!validation.success) {
    throw new BatchHttpError(400, "Invalid course ID.");
  }

  return validation.data;
}

function escapeLike(value: string) {
  return value.replace(
    /[\\%_]/g,
    (character) => `\\${character}`,
  );
}

function cleanOriginalFilename(value: string) {
  const name = value
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();

  return name || "source-document";
}

async function extractSourceText(
  bytes: Uint8Array,
  extension: "txt" | "pdf",
) {
  let textContent: string;

  if (extension === "txt") {
    try {
      textContent = new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes);
    } catch {
      throw new BatchHttpError(
        422,
        "The TXT document must use UTF-8 encoding.",
      );
    }

    if (textContent.includes("\u0000")) {
      throw new BatchHttpError(
        422,
        "The TXT document appears to contain binary data.",
      );
    }
  } else {
    const header = new TextDecoder().decode(
      bytes.slice(0, Math.min(bytes.length, 1024)),
    );

    if (!header.includes("%PDF-")) {
      throw new BatchHttpError(
        422,
        "The selected file does not have a recognisable PDF header.",
      );
    }

    try {
      const pdf = await extractText(bytes, {
        mergePages: false,
      });

      const pages = Array.isArray(pdf.text)
        ? pdf.text
        : [pdf.text];

      const containsText = pages.some(
        (page) => page.trim().length > 0,
      );

      if (!containsText) {
        throw new BatchHttpError(
          422,
          "The PDF has no extractable text. Scanned PDFs are unsupported.",
        );
      }

      textContent = pages
        .map(
          (page, index) =>
            `--- PAGE ${index + 1} ---\n${page}`,
        )
        .join("\n\n");
    } catch (error: unknown) {
      if (error instanceof BatchHttpError) {
        throw error;
      }

      console.error("Course source PDF extraction failed:", error);

      throw new BatchHttpError(
        422,
        "The PDF could not be read. Use an unlocked, text-based PDF.",
      );
    }
  }

  if (textContent.includes("\u0000")) {
    throw new BatchHttpError(
      422,
      "The extracted document contains unsupported null characters.",
    );
  }

  if (!textContent.trim()) {
    throw new BatchHttpError(
      422,
      "The document contains no readable text.",
    );
  }

  if (textContent.length > MAX_EXTRACTION_CHARACTERS) {
    throw new BatchHttpError(
      413,
      "The extracted text exceeds the current 40,000-character " +
        "question-extraction limit. Split the source into smaller " +
        "question-aware documents before uploading.",
    );
  }

  return textContent;
}

// ============================================================
// GET
// /api/admin/courses/[courseId]/question-batches
//
// Returns course metadata and only this course's batch summaries.
// Does not return question bodies, source text, or draft JSON.
// ============================================================

export async function GET(
  request: Request,
  context: Context,
) {
  try {
    await requireQuestionOwner();

    const courseId = await getCourseId(context);
    const url = new URL(request.url);

    const validation = listSchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );

    if (!validation.success) {
      throw new BatchHttpError(
        400,
        validationMessage(validation.error),
      );
    }

    const filters = validation.data;
    const supabase = getPrivilegedClient();

    const {
      data: course,
      error: courseError,
    } = await supabase
      .from("courses")
      .select(
        "id, college_name, course_code, course_title, status",
      )
      .eq("id", courseId)
      .maybeSingle()
  

    if (courseError) throw courseError;
    console.log(course)
    if (!course) {
      throw new BatchHttpError(404, "Course not found.");
    }

    let query = supabase
      .from("course_question_batch_summaries")
      .select(
        [
          "id",
          "title",
          "course_id",
          "course_code",
          "course_title",
          "college_name",
          "exam_year",
          "status",
          "created_at",
          "updated_at",
          "question_count",
          "missing_answer_count",
          "warning_question_count",
        ].join(","),
        { count: "exact" },
      )
      .eq("course_id", courseId);

    if (filters.search) {
      query = query.ilike(
        "title",
        `%${escapeLike(filters.search)}%`,
      );
    }

    if (filters.exam_year) {
      query = query.eq("exam_year", filters.exam_year);
    }

    if (filters.view === "published") {
      query = query.eq("status", "approved");
    }

    if (filters.view === "attention") {
      query = query.or(
        [
          "status.eq.pending",
          "status.eq.reviewing",
          "missing_answer_count.gt.0",
          "warning_question_count.gt.0",
        ].join(","),
      );
    }

    const from = (filters.page - 1) * filters.page_size;
    const to = from + filters.page_size - 1;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return jsonResponse({
      course,
      batches: data ?? [],
      total_batches: count ?? 0,
      page: filters.page,
      page_size: filters.page_size,
      limits: {
        max_file_bytes: MAX_FILE_BYTES,
        max_extracted_characters: MAX_EXTRACTION_CHARACTERS,
        max_questions: 100,
      },
    });
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}

// ============================================================
// POST
// /api/admin/courses/[courseId]/question-batches
//
// multipart/form-data:
//   title       optional
//   exam_year   optional four-digit source-paper year
//   file        required TXT or text-based PDF
//
// Course association comes from the URL, not the form body.
//
// This saves readable source text.
// AI question extraction is a separate request.
// ============================================================

export async function POST(
  request: Request,
  context: Context,
) {
  let uploadedPath: string | null = null;

  try {
    assertSameOrigin(request);

    const user = await requireQuestionOwner();
    const courseId = await getCourseId(context);
    const supabase = getPrivilegedClient();

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType.toLowerCase().includes("multipart/form-data")
    ) {
      throw new BatchHttpError(
        415,
        "Submit the document using multipart/form-data.",
      );
    }

    const contentLength = Number(
      request.headers.get("content-length") || 0,
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_FILE_BYTES + 256_000
    ) {
      throw new BatchHttpError(
        413,
        "The upload exceeds the allowed request size.",
      );
    }

    const {
      data: course,
      error: courseError,
    } = await supabase
      .from("courses")
      .select("id, course_code, course_title, status")
      .eq("id", courseId)
      .maybeSingle();

    if (courseError) throw courseError;

    if (!course) {
      throw new BatchHttpError(404, "Course not found.");
    }

    if (course.status === "archived") {
      throw new BatchHttpError(
        409,
        "Restore the archived course before creating a batch.",
      );
    }

    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      throw new BatchHttpError(
        400,
        "The upload form could not be read.",
      );
    }

    const rawYear = form.get("exam_year");

    const validation = createBatchSchema.safeParse({
      title: form.get("title") ?? "",
      exam_year:
        typeof rawYear === "string"
          ? rawYear.trim() || null
          : rawYear,
    });

    if (!validation.success) {
      throw new BatchHttpError(
        400,
        validationMessage(validation.error),
      );
    }

    const fields = validation.data;
    const file = form.get("file");

    if (!(file instanceof File)) {
      throw new BatchHttpError(
        400,
        "Select a source document.",
      );
    }

    if (file.size === 0) {
      throw new BatchHttpError(
        400,
        "The selected document is empty.",
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new BatchHttpError(
        413,
        "The document exceeds the 10 MB file limit.",
      );
    }

    const filename = file.name.toLowerCase();

    const extension = filename.endsWith(".pdf")
      ? "pdf"
      : filename.endsWith(".txt")
        ? "txt"
        : null;

    if (!extension) {
      throw new BatchHttpError(
        415,
        "Only .txt and text-based .pdf documents are supported.",
      );
    }

    const bytes = new Uint8Array(
      await file.arrayBuffer(),
    );

    const rawText = await extractSourceText(
      bytes,
      extension,
    );

    const batchId = randomUUID();

    const storagePath =
      `courses/${user.id}/${courseId}/${batchId}/source.${extension}`;

    const title =
      fields.title ||
      [
        course.course_code,
        fields.exam_year,
        batchId.slice(0, 8),
      ].filter(Boolean).join(" · ");

    const { error: uploadError } = await supabase.storage
      .from(QUESTION_BUCKET)
      .upload(storagePath, bytes, {
        contentType:
          extension === "pdf"
            ? "application/pdf"
            : "text/plain; charset=utf-8",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    uploadedPath = storagePath;

    const { error: insertError } = await supabase
      .from("question_import_courses")
      .insert({
        id: batchId,
        course_id: courseId,
        title,
        exam_year: fields.exam_year,

        storage_bucket: QUESTION_BUCKET,
        storage_path: storagePath,
        original_filename: cleanOriginalFilename(file.name),

        uploaded_by: user.id,
        status: "pending",

        raw_text: rawText,
        extraction_payload: null,
        draft_payload: null,
        extraction_method: null,
        extraction_warnings: [],
      });

    if (insertError) throw insertError;

    // Source file now belongs to a successfully saved batch.
    uploadedPath = null;

    return jsonResponse(
      {
        success: true,
        course_id: courseId,
        batch_id: batchId,
        status: "pending",
        extraction_status: "not_started",
        message:
          "Document saved. Open the batch to extract and review its questions.",
      },
      201,
    );
  } catch (error: unknown) {
    if (uploadedPath) {
      try {
        const supabase = getPrivilegedClient();

        const { error: cleanupError } = await supabase.storage
          .from(QUESTION_BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error("Course source cleanup failed:", {
            storagePath: uploadedPath,
            error: cleanupError,
          });
        }
      } catch (cleanupError: unknown) {
        console.error(
          "Unable to clean up course source:",
          cleanupError,
        );
      }
    }

    return handleBatchError(error);
  }
}