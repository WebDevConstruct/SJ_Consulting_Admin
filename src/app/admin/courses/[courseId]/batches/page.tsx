"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type {
  CourseBatchCreatedResponse,
  CourseBatchListResponse,
} from "@/lib/courses/question-batch-types";

import {
  buttonClass,
  errorMessage,
  inputClass,
  panelClass,
  primaryClass,
  requestJson,
} from "@/lib/courses/batch-ui";

const PAGE_SIZE = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function CourseBatchesPage() {

  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState("");
//const [error, setError] = useState("");
const [message, setMessage] = useState("");
// DELETING THE FUNCTION
async function runAction(
  label: string,
  action: () => Promise<void>,
) {
  if (busy) return;

  setBusy(label);
  setError("");
  setMessage("");

  try {
    await action();
  } catch (error) {
    setError(
      error instanceof Error
        ? error.message
        : "Unable to complete the request.",
    );
  } finally {
    setBusy("");
  }
}


  // 
  const endpoint =
    `/api/admin/courses/${courseId}/question-batches`;

  const [data, setData] = useState<CourseBatchListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [view, setView] = useState("all");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const uploadLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
        view,
      });

      if (search.trim()) params.set("search", search.trim());
      if (yearFilter.trim()) params.set("exam_year", yearFilter.trim());

      try {
        const result = await requestJson<CourseBatchListResponse>(
          `${endpoint}?${params}`,
          { signal: controller.signal },
        );

        if (!controller.signal.aborted) setData(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(errorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [endpoint, search, yearFilter, view, page, refresh]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (uploadLock.current) return;

    setUploadError("");

    if (!file) {
      setUploadError("Select a source document.");
      return;
    }

    if (!/\.(txt|pdf)$/i.test(file.name)) {
      setUploadError("Choose a TXT or text-based PDF.");
      return;
    }

    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      setUploadError("Choose a non-empty document no larger than 10 MB.");
      return;
    }

    if (year && !/^\d{4}$/.test(year)) {
      setUploadError("Enter a four-digit source-paper year or leave it blank.");
      return;
    }

    uploadLock.current = true;
    setUploading(true);

    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("file", file);

      if (year) form.append("exam_year", year);

      const result = await requestJson<CourseBatchCreatedResponse>(
        endpoint,
        {
          method: "POST",
          body: form,
        },
      );
 //  alert(result?.course_id)
      router.push(
        `/admin/courses/${courseId}/batches/${result.batch_id}`,
      );
    } catch (error) {
      setUploadError(
        `${errorMessage(error)} Check the batch list before retrying ` +
          "if the connection was interrupted.",
      );
      setRefresh((value) => value + 1);
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }

  const course = data?.course;
  const archived = course?.status === "archived";
  const totalPages = Math.max(
    1,
    Math.ceil((data?.total_batches ?? 0) / PAGE_SIZE),
  );

  return (
    <main className="min-h-screen bg-paper-soft text-ink dark:bg-ink dark:text-paper">
      <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/admin/courses" className={buttonClass}>
          ← Course Library
        </Link>

        <header className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700 dark:text-gold-200">
              Undergraduate / Course question batches
            </p>

            <h1 className="mt-3 font-display text-4xl font-bold">
              {course?.course_code ?? "Course"} question bank
            </h1>

            <p className="mt-3 text-sm text-ink/65 dark:text-paper/65">
              {course
                ? `${course.course_title} · ${course.college_name}`
                : "Loading course details…"}
            </p>
          </div>

          <button
            className={primaryClass}
            disabled={!course || archived || uploading}
            onClick={() => setShowUpload((value) => !value)}
          >
            {showUpload ? "Hide upload form" : "+ Create batch"}
          </button>
        </header>

        {archived && (
          <p className={`${panelClass} mt-6 text-sm`}>
            This course is archived. Existing batches remain viewable,
            but new uploads are disabled.
          </p>
        )}

        {showUpload && !archived && (
          <form onSubmit={upload} className={`${panelClass} mt-6`}>
            <h2 className="font-display text-2xl">Upload course questions</h2>

            <p className="mt-2 text-sm leading-6 text-ink/65 dark:text-paper/65">
              The document belongs to {course?.course_code}. Extraction
              starts separately inside the review workspace.
            </p>

            <fieldset disabled={uploading} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span>Batch label — optional</span>
                  <input
                    className={inputClass}
                    maxLength={100}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. First semester paper"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span>Source-paper year — optional</span>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                    placeholder="e.g. 2024"
                  />
                </label>
              </div>

              <label className="block space-y-2 text-sm">
                <span>Source document</span>
                <input
                  type="file"
                  required
                  accept=".txt,.pdf"
                  className={inputClass}
                  onChange={(event) =>
                    setFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>

              <p className="text-xs leading-6 text-ink/65 dark:text-paper/65">
                TXT or text-based PDF. Maximum 10 MB and 40,000
                extracted characters. Split longer documents at question
                boundaries. Review batches contain at most 100 questions.
              </p>

              {uploadError && (
                <p role="alert" className="whitespace-pre-wrap text-sm">
                  {uploadError}
                </p>
              )}

              <button className={primaryClass} disabled={uploading}>
                {uploading ? "Uploading and reading document…" : "Create and review →"}
              </button>
            </fieldset>
          </form>
        )}

        <section className={`${panelClass} mt-7`}>
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <input
              type="search"
              aria-label="Search course batches"
              placeholder="Search batch title…"
              className={inputClass}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />

            <select
              aria-label="Batch status filter"
              className={inputClass}
              value={view}
              onChange={(event) => {
                setView(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All batches</option>
              <option value="attention">Needs attention</option>
              <option value="published">Published</option>
            </select>

            <input
              aria-label="Filter by source-paper year"
              placeholder="Source year"
              inputMode="numeric"
              maxLength={4}
              className={inputClass}
              value={yearFilter}
              onChange={(event) => {
                setYearFilter(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </section>

        <div className="my-5 flex items-center justify-between gap-3">
          <p role="status" className="text-sm text-ink/65 dark:text-paper/65">
            {loading
              ? "Loading batches…"
              : error
                ? "Unable to load batches"
                : `${data?.total_batches ?? 0} matching batches`}
          </p>

          <button
            className={buttonClass}
            disabled={loading || uploading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            Refresh
          </button>
        </div>

        {error ? (
          <p role="alert" className={`${panelClass} whitespace-pre-wrap`}>
            {error}
          </p>
        ) : loading ? (
          <div className={panelClass}>Loading course batches…</div>
        ) : !data?.batches.length ? (
          <div className={`${panelClass} py-12 text-center`}>
            No matching batches. Create a batch or adjust the filters.
          </div>
        ) : (
          <>
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.batches.map((batch) => (
                <article key={batch.id} className={`${panelClass} flex flex-col`}>
                  <div className="flex justify-between gap-3 text-xs text-gold-700 dark:text-gold-200">
                    <span>{batch.exam_year ?? "Undated source"}</span>
                    <span className="capitalize">
                      {batch.status === "approved" ? "Published" : batch.status}
                    </span>
                  </div>

                  <h2 className="mt-4 font-display text-2xl">
                    {batch.title}
                  </h2>

                  <p className="mt-4 text-sm">
                    {batch.question_count}/100 questions
                  </p>

                  <p className="mt-2 text-xs leading-6 text-ink/65 dark:text-paper/65">
                    {batch.missing_answer_count} missing answers
                    {" · "}
                    {batch.warning_question_count} flagged
                  </p>
       <div className="w-full flex flex-col gap-2">
                  <Link
                    className={`${buttonClass} mt-6 w-full text-center`}
                    href={`/admin/courses/${courseId}/batches/${batch.id}`}
                  >
                    Open workspace
                  </Link>
                  <button
  className={` ${buttonClass} w-full bg-red-600 text-white font-bold `}
  disabled={Boolean(busy)}
  onClick={() => {
    const confirmed = window.confirm(
      "Delete this batch, its draft questions, published questions, and stored source file? This cannot be undone.",
    );

    if (!confirmed) return;

    void runAction("Deleting batch…", async () => {
      await requestJson(`${endpoint}/${batch.id}`, {
        method: "DELETE",
      });

     if(window !== undefined){
      window.location.reload();
     }
    });
  }}
>
  Delete batch
</button>
                  </div>
                </article>
              ))}
            </section>

            <nav aria-label="Batch pagination" className="mt-7 flex items-center justify-between gap-3">
              <button
                className={buttonClass}
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Previous
              </button>

              <span className="text-sm">Page {page} of {totalPages}</span>

              <button
                className={buttonClass}
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next →
              </button>
            </nav>
          </>
        )}
      </div>
    </main>
  );
}