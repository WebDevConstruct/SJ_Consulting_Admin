"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import DeleteBatchModal from "@/components/questions/DeleteBatchModal";
import {createClient} from "@lib/supabase/client";
import {useRouter} from "next/navigation";

type BatchStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "rejected";

type Subject = {
  id: string;
  name: string;
};

type ExamType = {
  id: string;
  name: string;
};

type Batch = {
  id: string;
  title: string;
  subject_id: string;
  subject_name: string;
  exam_type_id: string;
  exam_type_name: string;
  exam_year: string;
  question_count: number;
  missing_answer_count: number;
  warning_question_count: number;
  status: BatchStatus;
  created_at: string;
};

type BatchListResponse = {
  batches: Batch[];
  total_batches: number;
};

type MetadataResponse = {
  subjects: Subject[];
  exam_types: ExamType[];
};

type ViewFilter = "all" | "attention" | "published";

const YEARS = ["2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018"];
const PAGE_SIZE = 12;
const MAX_QUESTIONS = 100;

// Client-side guardrail; enforce your actual upload limit server-side too.
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 " +
  "text-base text-stone-900 outline-none transition " +
  "focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15 " +
  "disabled:cursor-not-allowed disabled:bg-stone-100";

const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition " +
  "hover:bg-teal-900 focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-teal-800 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-xl border " +
  "border-stone-300 bg-white px-4 py-2.5 text-sm font-medium " +
  "text-stone-700 transition hover:bg-stone-50 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

async function readResponse<T>(response: Response): Promise<T> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new Error(
      `The server returned an unreadable response (${response.status}).`,
    );
  }

  if (!response.ok) {
    const body = payload as {
      error?: string;
      message?: string;
    };

    throw new Error(
      body?.error ||
        body?.message ||
        `Request failed (${response.status}).`,
    );
  }

  return payload as T;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusDetails(status: BatchStatus) {
  switch (status) {
    case "approved":
      return {
        label: "Published",
        className: "bg-teal-50 text-teal-800 ring-teal-700/15",
      };
    case "reviewing":
      return {
        label: "Needs review",
        className: "bg-amber-50 text-amber-800 ring-amber-700/15",
      };
    case "rejected":
      return {
        label: "Rejected",
        className: "bg-rose-50 text-rose-800 ring-rose-700/15",
      };
    default:
      return {
        label: "Processing",
        className: "bg-stone-100 text-stone-700 ring-stone-500/15",
      };
  }
}


const cleanUpExtractionBatches = async(selectedBatchId : string)=> {
   
    const supabase = createClient();
     const session = (await supabase.auth.getSession()).data.session;
     const accessToken = session?.access_token
   const response =  await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cleanup-extraction-batch`,
  {
   
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken || ""}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    },
    body: JSON.stringify({
      batch_id: selectedBatchId,
      confirm: true,
    }),
  },
);
if(response.ok){
     if(window !== undefined){
        window.location.reload();
     }
}
}

function BatchCard({ batch }: { batch: Batch }) {
  const status = statusDetails(batch.status);
  const [deleteBatch, setDeleteBatch] = useState(false)
  const capacity = Math.min(
    100,
    Math.max(0, (batch.question_count / MAX_QUESTIONS) * 100),
  );

  return (
    <article className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-teal-800/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-stone-600">
          {batch.exam_type_name}
        </span>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-sm font-medium text-teal-800">
          {batch.subject_name} · {batch.exam_year}
        </p>

        <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-900">
          {batch.title}
        </h2>

        <p className="mt-2 text-xs text-stone-500">
          Created {formatDate(batch.created_at)}
        </p>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-stone-700">
            {batch.question_count} questions
          </span>
          <span className="text-stone-500">
            {MAX_QUESTIONS} maximum
          </span>
        </div>

        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-teal-700"
            style={{ width: `${capacity}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {batch.missing_answer_count > 0 ? (
          <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
            {batch.missing_answer_count} missing answers
          </span>
        ) : (
          <span className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600">
            {batch.question_count > 0
              ? "No missing answers reported"
              : "No questions extracted yet"}
          </span>
        )}

        {batch.warning_question_count > 0 && (
          <span className="rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-900">
            {batch.warning_question_count} questions flagged
          </span>
        )}
      </div>
      
       
           <div className="flex gap-5  md:flex-row flex-col mt-auto pt-6">
        <Link
          href={`/admin/questions/batches/${batch.id}`}
          className={`${secondaryButtonClass} w-full md:w-1/2 w-full justify-between`}
        >
          <span>Open batch</span>
          <span aria-hidden="true">→</span>
        </Link>
        <button onClick={async()=> {
        setDeleteBatch(true)
        }}
        className="h-full md:w-1/2 py-3 w-full bg-red-800 text-white rounded-lg">
         Delete Batch
        </button>
      </div>
       
       {deleteBatch && (
         <DeleteBatchModal
           batch={batch}
           onClose={() => setDeleteBatch(false)}
           onConfirm={async () => {
             await  cleanUpExtractionBatches(batch.id);
             setDeleteBatch(false);
           }}
         />
       )}
    </article>
  );
}

type CreateBatchModalProps = {
  subjects: Subject[];
  examTypes: ExamType[];
  metadataLoading: boolean;
  metadataError: string;
  onClose: () => void;
  onCreated: (batchId: string) => void;
};

function CreateBatchModal({
  subjects,
  examTypes,
  metadataLoading,
  metadataError,
  onClose,
  onCreated,
}: CreateBatchModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subjectId, setSubjectId] = useState("");
  const [examTypeId, setExamTypeId] = useState("");
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");

  useEffect(() => {
    dialogRef.current?.showModal();

    return () => {
      dialogRef.current?.close();
    };
  }, []);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError("");

    if (!selected) {
      setFile(null);
      return;
    }

    if (!/\.(txt|pdf)$/i.test(selected.name)) {
      setFile(null);
      event.target.value = "";
      setError("Choose a .txt file or a text-based .pdf.");
      return;
    }

    if (selected.size > MAX_FILE_BYTES) {
      setFile(null);
      event.target.value = "";
      setError("Choose a file smaller than 10 MB.");
      return;
    }

    setFile(selected);
  }

  function uploadBatch(form: FormData): Promise<{ batch_id: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "/api/admin/question-batches");
      xhr.withCredentials = true;
      xhr.timeout = 180_000;

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;

        setProgress(Math.round((event.loaded / event.total) * 100));
      };

      xhr.upload.onload = () => {
        setPhase("Upload sent. Waiting for the server…");
      };

      xhr.onerror = () => {
        reject(new Error("Network error. Check the library before retrying."));
      };

      xhr.ontimeout = () => {
        reject(
          new Error(
            "The request timed out. Refresh the library before uploading again.",
          ),
        );
      };

      xhr.onload = () => {
        let result: {
          batch_id?: string;
          error?: string;
        };

        try {
          result = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error("The server returned an unreadable response."));
          return;
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(result.error || "Could not create the batch."));
          return;
        }

        if (!result.batch_id) {
          reject(new Error("The response is missing the batch ID."));
          return;
        }

        resolve({ batch_id: result.batch_id });
      };

      xhr.send(form);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!subjectId || !examTypeId || !YEARS.includes(year) || !file) {
      setError("Select an exam, subject, year, and document.");
      return;
    }

    setSubmitting(true);
    setProgress(0);
    setPhase("Uploading document…");

    try {
      const form = new FormData();

      form.append("subject_id", subjectId);
      form.append("exam_type_id", examTypeId);
      form.append("exam_year", year);
      form.append("title", title.trim());
      form.append("file", file);

      const result = await uploadBatch(form);
      onCreated(result.batch_id);
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setSubmitting(false);
      setPhase("");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="create-batch-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border-0 bg-[#faf9f6] p-0 text-stone-900 shadow-2xl backdrop:bg-stone-950/50"
    >
      <form onSubmit={submit}>
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
              Question library
            </p>
            <h2
              id="create-batch-title"
              className="mt-2 text-2xl font-semibold tracking-tight"
            >
              Create a question batch
            </h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Group up to 100 questions under one exam, subject, and year.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close create batch"
            className="rounded-lg px-3 py-1 text-2xl text-stone-500 hover:bg-stone-200 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 p-6">
          {(error || metadataError) && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
            >
              {error || metadataError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>Exam type</span>
              <select
                required
                value={examTypeId}
                onChange={(event) => setExamTypeId(event.target.value)}
                disabled={metadataLoading || submitting}
                className={inputClass}
              >
                <option value="">
                  {metadataLoading ? "Loading…" : "Select exam"}
                </option>
                {examTypes.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Subject</span>
              <select
                required
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                disabled={metadataLoading || submitting}
                className={inputClass}
              >
                <option value="">Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Exam year</span>
              <select
                required
                value={year}
                onChange={(event) => setYear(event.target.value)}
                disabled={submitting}
                className={inputClass}
              >
                <option value="">Select year</option>
                {YEARS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>
                Batch label{" "}
                <span className="font-normal text-stone-500">
                  (optional)
                </span>
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={submitting}
                maxLength={100}
                placeholder="e.g. Paper 1"
                className={inputClass}
              />
            </label>
          </div>

          <div>
            <label
              htmlFor="batch-file"
              className="text-sm font-medium"
            >
              Source document
            </label>

            <input
              ref={fileInputRef}
              id="batch-file"
              type="file"
              accept=".txt,.pdf"
              onChange={chooseFile}
              disabled={submitting}
              className="sr-only"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="mt-2 w-full rounded-xl border-2 border-dashed border-stone-300 bg-white px-5 py-7 text-center transition hover:border-teal-700 disabled:opacity-50"
            >
              <span className="block text-sm font-semibold text-teal-900">
                {file ? file.name : "Choose a document"}
              </span>
              <span className="mt-2 block text-xs text-stone-500">
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace`
                  : "TXT or text-based PDF · Maximum 10 MB"}
              </span>
            </button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Images and scanned PDFs are unsupported. Missing answers can
            be completed during review, but unanswered questions cannot
            be published for automatic grading.
          </div>

          {submitting && (
            <div role="status" aria-live="polite">
              <div className="flex justify-between text-sm text-stone-600">
                <span>{phase}</span>
                <span>{progress}% uploaded</span>
              </div>
              <progress
                value={progress}
                max={100}
                className="mt-2 h-2 w-full accent-teal-800"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-stone-200 p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={secondaryButtonClass}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              submitting ||
              metadataLoading ||
              Boolean(metadataError)
            }
            className={primaryButtonClass}
          >
            {submitting ? "Creating batch…" : "Create and review →"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function QuestionLibraryPage() {
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState("");

  const [batches, setBatches] = useState<Batch[]>([]);
  const [totalBatches, setTotalBatches] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examTypeId, setExamTypeId] = useState("");
  const [year, setYear] = useState("");
  const [view, setView] = useState<ViewFilter>("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMetadata() {
      try {
        const response = await fetch(
          "/api/admin/question-batches/metadata",
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const result = await readResponse<MetadataResponse>(response);

        setSubjects(result.subjects);
        setExamTypes(result.exam_types);
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setMetadataError(errorMessage(error));
        }
      } finally {
        if (!controller.signal.aborted) {
          setMetadataLoading(false);
        }
      }
    }

    void loadMetadata();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadBatches() {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
        view,
      });

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (subjectId) params.set("subject_id", subjectId);
      if (examTypeId) params.set("exam_type_id", examTypeId);
      if (year) params.set("exam_year", year);

      try {
        const response = await fetch(
          `/api/admin/question-batches?${params.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );

        const result = await readResponse<BatchListResponse>(response);

        setBatches(result.batches);
        console.log("Checking Batches ID", result.batches)
        setTotalBatches(result.total_batches);
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setError(errorMessage(error));
          setBatches([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadBatches();
    return () => controller.abort();
  }, [
    page,
    debouncedSearch,
    subjectId,
    examTypeId,
    year,
    view,
    refreshKey,
  ]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const totalPages = Math.max(1, Math.ceil(totalBatches / PAGE_SIZE));

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setSubjectId("");
    setExamTypeId("");
    setYear("");
    setView("all");
    setPage(1);
  }

  const tabs: { value: ViewFilter; label: string }[] = [
    { value: "all", label: "All batches" },
    { value: "attention", label: "Needs attention" },
    { value: "published", label: "Published" },
  ];

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
              SJ Consult / Academic resources
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Question Library
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              Organise past questions by exam, subject, and year.
              Open a batch to review its questions and complete missing answers.
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className={`${primaryButtonClass} shrink-0`}
          >
            <span aria-hidden="true">＋</span>
            Create batch
          </button>
        </header>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
          <div
            className="flex gap-2 overflow-x-auto border-b border-stone-100 pb-4"
            aria-label="Batch views"
          >
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setView(tab.value);
                  setPage(1);
                }}
                aria-pressed={view === tab.value}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                  view === tab.value
                    ? "bg-teal-900 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <input
              type="search"
              aria-label="Search batches"
              placeholder="Search batch title…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
            />

            <select
              aria-label="Filter by exam"
              value={examTypeId}
              onChange={(event) => {
                setExamTypeId(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All exams</option>
              {examTypes.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by subject"
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by year"
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">All years</option>
              {YEARS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <button
              onClick={clearFilters}
              className={secondaryButtonClass}
            >
              Reset
            </button>
          </div>
        </section>

        <div
          className="my-5 flex items-center justify-between gap-3 text-sm text-stone-600"
          aria-live="polite"
        >
          <p>
            {loading
              ? "Loading batches…"
              : `${totalBatches} matching ${
                  totalBatches === 1 ? "batch" : "batches"
                }`}
          </p>

          <button
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
            className="rounded-lg px-3 py-2 font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-40"
          >
            Refresh
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 p-6"
          >
            <h2 className="font-semibold text-rose-900">
              Could not load question batches
            </h2>
            <p className="mt-2 text-sm text-rose-800">{error}</p>
            <button
              onClick={() => setRefreshKey((value) => value + 1)}
              className={`${secondaryButtonClass} mt-4`}
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            aria-label="Loading question batches"
            aria-busy="true"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-72 animate-pulse rounded-2xl border border-stone-200 bg-white"
              />
            ))}
          </div>
        ) : batches.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-800">
              ≡
            </div>
            <h2 className="mt-5 text-xl font-semibold">
              No batches found
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
              Create a question batch, or adjust your filters to find
              an existing upload.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className={`${primaryButtonClass} mt-6`}
            >
              Create batch
            </button>
          </section>
        ) : (
          <>
            <section
              aria-label="Question batches"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {batches.map((batch) => (
                <BatchCard key={batch.id} batch={batch} />
              ))}
            </section>

            <nav
              aria-label="Batch pagination"
              className="mt-8 flex items-center justify-between border-t border-stone-200 pt-5"
            >
              <button
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
                className={secondaryButtonClass}
              >
                ← Previous
              </button>

              <span className="text-sm text-stone-600">
                Page {page} of {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
                className={secondaryButtonClass}
              >
                Next →
              </button>
            </nav>
          </>
        )}
      </div>

      {modalOpen && (
        <CreateBatchModal
          subjects={subjects}
          examTypes={examTypes}
          metadataLoading={metadataLoading}
          metadataError={metadataError}
          onClose={closeModal}
          onCreated={(batchId) => {
            setModalOpen(false);
            router.push(`/admin/questions/batches/${batchId}`);
          }}
        />
      )}
    </main>
  );
}