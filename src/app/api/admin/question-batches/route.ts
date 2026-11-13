

import { randomUUID } from "node:crypto";
import { extractText } from "unpdf";
import { z } from "zod";

import {
  ALLOWED_YEARS,
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

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

const listSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(100_000)
    .default(1),

  page_size: z.coerce
    .number()
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

  subject_id: z.string()
    .trim()
    .min(1)
    .max(200)
    .optional(),

  exam_type_id: z.string()
    .trim()
    .min(1)
    .max(100)
    .optional(),

  exam_year: z.enum(ALLOWED_YEARS).optional(),
});

const createBatchSchema = z.object({
  subject_id: z.string().trim().min(1).max(200),
  exam_type_id: z.string().trim().min(1).max(100),
  exam_year: z.enum(ALLOWED_YEARS),
  title: z.string().trim().max(100),
});

function validationMessage(error: z.ZodError): string {
  return error.issues
    .map(
      (issue) =>
        `${issue.path.join(".") || "request"}: ${issue.message}`,
    )
    .join("; ");
}

// -----------------------------------------------------------------------------
// GET /api/admin/question-batches
//
// Returns batch summaries, not individual question bodies.
// -----------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    await requireQuestionOwner();

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

    let query = supabase
      .from("question_batch_summaries")
      .select(
        [
          "id",
          "title",
          "subject_id",
          "subject_name",
          "exam_type_id",
          "exam_type_name",
          "exam_year",
          "question_count",
          "missing_answer_count",
          "warning_question_count",
          "status",
          "created_at",
        ].join(","),
        {
          count: "exact",
        },
      );

    if (filters.subject_id) {
      query = query.eq(
        "subject_id",
        filters.subject_id,
      );
    }

    if (filters.exam_type_id) {
      query = query.eq(
        "exam_type_id",
        filters.exam_type_id,
      );
    }

    if (filters.exam_year) {
      query = query.eq(
        "exam_year",
        filters.exam_year,
      );
    }

    if (filters.search) {
      // Treat SQL LIKE wildcard characters as literal input.
      const escapedSearch = filters.search.replace(
        /[\\%_]/g,
        (character) => `\\${character}`,
      );

      query = query.ilike(
        "title",
        `%${escapedSearch}%`,
      );
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

    const from =
      (filters.page - 1) * filters.page_size;

    const to =
      from + filters.page_size - 1;

    const {
      data,
      error,
      count,
    } = await query
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      throw error;
    }

    return jsonResponse({
      batches: data ?? [],
      total_batches: count ?? 0,
      page: filters.page,
      page_size: filters.page_size,
    });
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}

// -----------------------------------------------------------------------------
// POST /api/admin/question-batches
//
// Reads the document, uploads it to private Storage,
// and creates a pending question_imports record.
//
// AI extraction is started separately from the batch workspace.
// -----------------------------------------------------------------------------

export async function POST(request: Request) {
  let uploadedPath: string | null = null;

  try {
    assertSameOrigin(request);

    const user = await requireQuestionOwner();
    const supabase = getPrivilegedClient();

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !contentType
        .toLowerCase()
        .includes("multipart/form-data")
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

    let form: FormData;

    try {
      form = await request.formData();
    } catch {
      throw new BatchHttpError(
        400,
        "The upload form could not be read.",
      );
    }

    const validation = createBatchSchema.safeParse({
      subject_id: form.get("subject_id"),
      exam_type_id: form.get("exam_type_id"),
      exam_year: form.get("exam_year"),
      title: form.get("title") ?? "",
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
        "The document exceeds the allowed file size.",
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

    const [
      subjectResult,
      examResult,
    ] = await Promise.all([
      supabase
        .from("subjects")
        .select("id, name")
        .eq("id", fields.subject_id)
        .maybeSingle(),

      supabase
        .from("question_exam_types")
        .select("id, name")
        .eq("id", fields.exam_type_id)
        .maybeSingle(),
    ]);

    if (subjectResult.error) {
      throw subjectResult.error;
    }

    if (examResult.error) {
      throw examResult.error;
    }

    if (!subjectResult.data) {
      throw new BatchHttpError(
        400,
        "The selected subject does not exist.",
      );
    }

    if (!examResult.data) {
      throw new BatchHttpError(
        400,
        "The selected exam type does not exist.",
      );
    }

    const bytes = new Uint8Array(
      await file.arrayBuffer(),
    );

    let textContent = "";

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
        bytes.slice(
          0,
          Math.min(bytes.length, 1024),
        ),
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

        console.error(
          "Question PDF extraction failed:",
          error,
        );

        throw new BatchHttpError(
          422,
          "The PDF could not be read. Use an unlocked, text-based PDF.",
        );
      }
    }

    if (!textContent.trim()) {
      throw new BatchHttpError(
        422,
        "The document contains no readable text.",
      );
    }

    if (textContent.length > 1_000_000) {
      throw new BatchHttpError(
        413,
        "The extracted text is too large. Split the document.",
      );
    }

    const batchId = randomUUID();

    const storagePath =
      `${user.id}/${batchId}/source.${extension}`;

    const title =
      fields.title ||
      `${examResult.data.name} · ` +
        `${subjectResult.data.name} · ` +
        `${fields.exam_year} · ` +
        batchId.slice(0, 8);

    const {
      error: uploadError,
    } = await supabase.storage
      .from(QUESTION_BUCKET)
      .upload(storagePath, bytes, {
        contentType:
          extension === "pdf"
            ? "application/pdf"
            : "text/plain; charset=utf-8",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    uploadedPath = storagePath;

    const {
      error: insertError,
    } = await supabase
      .from("question_imports")
      .insert({
        id: batchId,
        title,
        exam_type_id: fields.exam_type_id,
        subject_id: fields.subject_id,
        exam_year: fields.exam_year,
        storage_path: storagePath,
        original_filename: file.name,
        uploaded_by: user.id,
        status: "pending",
        raw_text: textContent,
        draft_payload: null,
        extraction_method: null,
        extraction_warnings: [],
      });

    if (insertError) {
      throw insertError;
    }

    // The saved import now references this source file.
    uploadedPath = null;

    return jsonResponse(
      {
        success: true,
        batch_id: batchId,
        status: "pending",
        extraction_status: "not_started",
        message:
          "Document saved. Open the batch to extract and review questions.",
      },
      201,
    );
  } catch (error: unknown) {
    if (uploadedPath) {
      try {
        const supabase = getPrivilegedClient();

        const {
          error: cleanupError,
        } = await supabase.storage
          .from(QUESTION_BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error(
            "Question source cleanup failed:",
            {
              storagePath: uploadedPath,
              error: cleanupError,
            },
          );
        }
      } catch (cleanupError: unknown) {
        console.error(
          "Unable to clean up question source:",
          cleanupError,
        );
      }
    }

    return handleBatchError(error);
  }
}