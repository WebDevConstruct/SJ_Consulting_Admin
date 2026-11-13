"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import Link from "next/link";

import type {
  Course,
  CourseListResponse,
  CourseOffering,
  CourseStatus,
} from "@/lib/courses/types";

const PAGE_SIZE = 12;

const inputClass =
  "w-full rounded-xl border border-paper-line bg-paper px-3.5 py-3 " +
  "text-base text-ink outline-none transition " +
  "focus:border-gold-500 focus:ring-2 focus:ring-gold-400/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "dark:border-ink-line dark:bg-ink-surface dark:text-paper";

const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-gold-500/30 bg-gold-metal-soft px-5 py-3 " +
  "text-sm font-semibold text-ink transition hover:brightness-105 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-paper-line bg-paper px-4 py-2.5 text-sm " +
  "font-medium text-ink transition hover:bg-paper-soft " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "dark:border-ink-line dark:bg-ink-soft dark:text-paper " +
  "dark:hover:bg-ink-surface";

async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
  });

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(`Unreadable server response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload.error || "Unable to complete the request.");
  }

  return payload as T;
}

function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to complete the request.";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: CourseStatus }) {
  const styles = {
    draft:
      "border-paper-line bg-paper-soft text-ink/70 " +
      "dark:border-ink-line dark:bg-ink-surface dark:text-paper/70",
    published:
      "border-gold-300 bg-gold-50 text-gold-700 " +
      "dark:border-gold-600 dark:bg-gold-400/10 dark:text-gold-200",
    archived:
      "border-paper-line bg-paper-surface text-ink/60 " +
      "dark:border-ink-line dark:bg-ink dark:text-paper/60",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function EditorDialog({
  title,
  description,
  busy,
  dirty,
  onClose,
  children,
}: {
  title: string;
  description: string;
  busy: boolean;
  dirty: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => {
    if (busy) return;

    if (dirty && !window.confirm("Discard your unsaved changes?")) {
      return;
    }

    onClose();
  }, [busy, dirty, onClose]);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();

    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (!dirty) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="course-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="
        m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl
        overflow-y-auto rounded-2xl border border-paper-line
        bg-ivory p-0 text-ink
        backdrop:bg-ink/60
        dark:border-ink-line dark:bg-ink-soft dark:text-paper
      "
    >
      <header className="flex items-start justify-between gap-4 border-b border-paper-line p-6 dark:border-ink-line">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-700 dark:text-gold-200">
            Undergraduate resources
          </p>

          <h2
            id="course-editor-title"
            className="mt-2 font-display text-3xl"
          >
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-ink/65 dark:text-paper/65">
            {description}
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          aria-label="Close editor"
          onClick={close}
          className={`${secondaryClass} !px-3`}
        >
          ×
        </button>
      </header>

      {children}
    </dialog>
  );
}

function CourseEditor({
  course,
  onClose,
  onSaved,
}: {
  course: Course | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({
    college_name: course?.college_name ?? "",
    course_code: course?.course_code ?? "",
    course_title: course?.course_title ?? "",
    short_description: course?.short_description ?? "",
    objective: course?.objective ?? "",
    status: course?.status ?? ("draft" as CourseStatus),
    price_amount:
      course?.price_amount !== null && course?.price_amount !== undefined
        ? String(course.price_amount)
        : "",
    price_currency: course?.price_currency ?? "NGN",
    original_price_amount:
      course?.original_price_amount !== null &&
      course?.original_price_amount !== undefined
        ? String(course.original_price_amount)
        : "",
    pricing_note: course?.pricing_note ?? "",
  });

  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function change<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    if (
      form.status !== course?.status &&
      form.status !== "draft" &&
      !window.confirm(`Save this course as ${form.status}?`)
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const priceAmount =
        form.price_amount.trim() === ""
          ? null
          : Number(form.price_amount);

      const originalPriceAmount =
        form.original_price_amount.trim() === ""
          ? null
          : Number(form.original_price_amount);

      const result = await requestJson<{ message: string }>(
        "/api/admin/courses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_course",
            id: course?.id ?? null,
            college_name: form.college_name,
            course_code: form.course_code,
            course_title: form.course_title,
            short_description: form.short_description,
            objective: form.objective,
            status: form.status,
            price_amount: priceAmount,
            price_currency: form.price_currency,
            original_price_amount: originalPriceAmount,
            pricing_note: form.pricing_note.trim() || null,
          }),
        },
      );

      onSaved(result.message);
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <EditorDialog
      title={course ? "Edit course" : "Create a course"}
      description="Save the course details, pricing, then assign its faculty, department, and level."
      busy={busy}
      dirty={dirty}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-5 p-6">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
            >
              {error}
            </p>
          )}

          <Field label="College / institution">
            <input
              required
              maxLength={200}
              className={inputClass}
              value={form.college_name}
              onChange={(event) =>
                change("college_name", event.target.value)
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Course code">
              <input
                required
                maxLength={40}
                placeholder="e.g. GST 101"
                className={inputClass}
                value={form.course_code}
                onChange={(event) =>
                  change("course_code", event.target.value)
                }
              />
            </Field>

            <Field label="Status">
              <select
                className={inputClass}
                value={form.status}
                onChange={(event) =>
                  change("status", event.target.value as CourseStatus)
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>

          <Field label="Course title">
            <input
              required
              maxLength={250}
              className={inputClass}
              value={form.course_title}
              onChange={(event) =>
                change("course_title", event.target.value)
              }
            />
          </Field>

          <Field label="Short description">
            <input
              maxLength={250}
              placeholder="A concise description for the course card"
              className={inputClass}
              value={form.short_description}
              onChange={(event) =>
                change("short_description", event.target.value)
              }
            />
          </Field>

          <Field label="Learning objective">
            <textarea
              rows={5}
              maxLength={5000}
              className={inputClass}
              value={form.objective}
              onChange={(event) => change("objective", event.target.value)}
            />
          </Field>

          <div className="rounded-2xl border border-gold-200 bg-gold-50 p-5 dark:border-gold-700 dark:bg-gold-400/10">
            <h3 className="font-display text-lg">Course pricing</h3>
            <p className="mt-1 text-xs leading-6 text-gold-700 dark:text-gold-200">
              Leave the price empty to make this course free. Add an original
              price only if you want to show a crossed-out former price.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Price amount">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Leave empty for free"
                  className={inputClass}
                  value={form.price_amount}
                  onChange={(event) =>
                    change("price_amount", event.target.value)
                  }
                />
              </Field>

              <Field label="Currency">
                <select
                  className={inputClass}
                  value={form.price_currency}
                  onChange={(event) =>
                    change(
                      "price_currency",
                      event.target.value as "NGN" | "USD"
                    )
                  }
                >
                  <option value="NGN">Nigerian Naira (₦)</option>
                  <option value="USD">US Dollar ($)</option>
                </select>
              </Field>

              <Field label="Original price — optional">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 25000"
                  className={inputClass}
                  value={form.original_price_amount}
                  onChange={(event) =>
                    change(
                      "original_price_amount",
                      event.target.value
                    )
                  }
                />
              </Field>

              <Field label="Pricing note — optional">
                <input
                  maxLength={300}
                  placeholder="Includes CBT access and study materials"
                  className={inputClass}
                  value={form.pricing_note}
                  onChange={(event) =>
                    change("pricing_note", event.target.value)
                  }
                />
              </Field>
            </div>
          </div>

          <p className="rounded-xl bg-gold-50 p-4 text-xs leading-6 text-gold-700 dark:bg-gold-400/10 dark:text-gold-200">
            Publishing sets the catalogue status. It does not grant paid
            access or publish any questions.
          </p>
        </fieldset>

        <footer className="flex justify-end border-t border-paper-line p-6 dark:border-ink-line">
          <button disabled={busy} className={primaryClass}>
            {busy
              ? "Saving…"
              : course
                ? "Save changes"
                : "Create course"}
          </button>
        </footer>
      </form>
    </EditorDialog>
  );
}

function OfferingEditor({
  course,
  offering,
  onClose,
  onSaved,
}: {
  course: Course;
  offering: CourseOffering | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({
    faculty_name: offering?.faculty_name ?? "",
    department_name: offering?.department_name ?? "",
    level: offering?.level ?? "",
    academic_session_label: offering?.academic_session_label ?? "",
    is_active: offering?.is_active ?? true,
  });

  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function change<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const result = await requestJson<{ message: string }>(
        "/api/admin/courses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_offering",
            id: offering?.id ?? null,
            course_id: course.id,
            ...form,
          }),
        },
      );

      onSaved(result.message);
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <EditorDialog
      title={offering ? "Edit academic assignment" : "Assign course"}
      description={`${course.course_code} · ${course.college_name}`}
      busy={busy}
      dirty={dirty}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="space-y-5 p-6">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
            >
              {error}
            </p>
          )}

          <Field label="Faculty">
            <input
              required
              maxLength={200}
              className={inputClass}
              value={form.faculty_name}
              onChange={(event) =>
                change("faculty_name", event.target.value)
              }
            />
          </Field>

          <Field label="Department">
            <input
              required
              maxLength={200}
              className={inputClass}
              value={form.department_name}
              onChange={(event) =>
                change("department_name", event.target.value)
              }
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level">
              <input
                required
                maxLength={40}
                className={inputClass}
                value={form.level}
                onChange={(event) => change("level", event.target.value)}
              />
            </Field>

            <Field label="Academic session — optional">
              <input
                maxLength={40}
                placeholder="e.g. 2026/2027"
                className={inputClass}
                value={form.academic_session_label}
                onChange={(event) =>
                  change("academic_session_label", event.target.value)
                }
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                change("is_active", event.target.checked)
              }
              className="h-4 w-4 accent-gold-600"
            />
            Academic assignment is active
          </label>

          <p className="text-xs leading-6 text-ink/65 dark:text-paper/65">
            Use the same faculty, department, and level values used by your
            undergraduate onboarding form. Blank academic session means this
            assignment is not limited to one session.
          </p>
        </fieldset>

        <footer className="flex justify-end border-t border-paper-line p-6 dark:border-ink-line">
          <button disabled={busy} className={primaryClass}>
            {busy ? "Saving…" : "Save assignment"}
          </button>
        </footer>
      </form>
    </EditorDialog>
  );
}

type EditorState =
  | { kind: "course"; course: Course | null }
  | {
      kind: "offering";
      course: Course;
      offering: CourseOffering | null;
    }
  | null;

export default function CourseLibraryPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<CourseStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          search: debouncedSearch,
          status,
          page: String(page),
        });

        const result = await requestJson<CourseListResponse>(
          `/api/admin/courses?${params}`,
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;

        const lastPage = Math.max(
          1,
          Math.ceil(result.total / PAGE_SIZE),
        );

        if (page > lastPage) {
          setPage(lastPage);
          return;
        }

        setCourses(result.items);
        setTotal(result.total);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(messageFrom(requestError));
          setCourses([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [debouncedSearch, status, page, refreshKey]);

  const closeEditor = useCallback(() => setEditor(null), []);

  function saved(notice: string) {
    setEditor(null);
    setMessage(notice);
    setRefreshKey((value) => value + 1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="min-h-screen bg-paper-soft text-ink dark:bg-ink dark:text-paper">
      <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700 dark:text-gold-200">
              SJ Consult / Undergraduate resources
            </p>

            <h1 className="mt-3 font-display text-4xl font-bold tracking-tightest">
              Course Library
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/65 dark:text-paper/65">
              Create courses, set their pricing, and assign them to the right
              academic profiles. Question batches and paid access are managed
              separately.
            </p>
          </div>

          <button
            onClick={() => setEditor({ kind: "course", course: null })}
            className={`${primaryClass} shrink-0`}
          >
            <span aria-hidden="true">＋</span>
            Add course
          </button>
        </header>

        {message && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-gold-200 bg-gold-50 p-4 text-sm text-gold-700 dark:border-gold-600 dark:bg-gold-400/10 dark:text-gold-200"
          >
            {message}
          </p>
        )}

        <section className="mt-8 rounded-2xl border border-paper-line bg-paper p-5 dark:border-ink-line dark:bg-ink-soft">
          <div className="flex flex-wrap gap-2">
            {(["all", "draft", "published", "archived"] as const).map(
              (value) => (
                <button
                  key={value}
                  aria-pressed={status === value}
                  onClick={() => {
                    setStatus(value);
                    setPage(1);
                  }}
                  className={`${secondaryClass} capitalize ${
                    status === value
                      ? "!border-gold-400 !bg-gold-50 !text-gold-700 dark:!bg-gold-400/10 dark:!text-gold-200"
                      : ""
                  }`}
                >
                  {value === "all" ? "All courses" : value}
                </button>
              ),
            )}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              aria-label="Search courses"
              placeholder="Search course code, title, or college…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
            />

            <button
              className={secondaryClass}
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setStatus("all");
                setPage(1);
              }}
            >
              Reset
            </button>
          </div>
        </section>

        <div className="my-5 flex items-center justify-between gap-3">
          <p
            role="status"
            className="text-sm text-ink/65 dark:text-paper/65"
          >
            {loading
              ? "Loading courses…"
              : error
                ? "Course list unavailable"
                : `${total} matching ${total === 1 ? "course" : "courses"}`}
          </p>

          <button
            disabled={loading}
            className={secondaryClass}
            onClick={() => setRefreshKey((value) => value + 1)}
          >
            Refresh
          </button>
        </div>

        {error ? (
          <section
            role="alert"
            className="rounded-2xl border border-gold-300 bg-paper p-6 dark:bg-ink-soft"
          >
            <h2 className="font-semibold">Could not load courses</h2>
            <p className="mt-2 text-sm">{error}</p>

            <button
              className={`${secondaryClass} mt-4`}
              onClick={() => setRefreshKey((value) => value + 1)}
            >
              Try again
            </button>
          </section>
        ) : loading ? (
          <div
            aria-label="Loading courses"
            aria-busy="true"
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="h-80 animate-pulse rounded-2xl border border-paper-line bg-paper motion-reduce:animate-none dark:border-ink-line dark:bg-ink-soft"
              />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-paper-line bg-paper p-12 text-center dark:border-ink-line dark:bg-ink-soft">
            <h2 className="font-display text-3xl">No courses found</h2>

            <p className="mt-3 text-sm text-ink/65 dark:text-paper/65">
              Add your first course or adjust the current filters.
            </p>

            <button
              className={`${primaryClass} mt-6`}
              onClick={() => setEditor({ kind: "course", course: null })}
            >
              Add course
            </button>
          </section>
        ) : (
          <>
            <section
              aria-label="Courses"
              className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {courses.map((course) => (
                <article
                  key={course.id}
                  className="flex flex-col rounded-2xl border border-paper-line bg-paper p-6 transition-colors hover:border-gold-400 dark:border-ink-line dark:bg-ink-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-xl border border-gold-200 bg-gold-50 px-3 py-2 text-sm font-semibold text-gold-700 dark:border-gold-600 dark:bg-gold-400/10 dark:text-gold-200">
                      {course.course_code}
                    </span>

                    <StatusBadge status={course.status} />
                  </div>

                  <p className="mt-5 text-xs text-ink/60 dark:text-paper/60">
                    {course.college_name}
                  </p>

                  <h2 className="mt-2 font-display text-2xl">
                    {course.course_title}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-ink/65 dark:text-paper/65">
                    {course.short_description ||
                      "No short description added."}
                  </p>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-display text-xl">
                      {course.price_amount === null
                        ? "Free"
                        : new Intl.NumberFormat("en-NG", {
                            style: "currency",
                            currency: course.price_currency,
                            minimumFractionDigits: 0,
                          }).format(course.price_amount)}
                    </span>

                    {course.original_price_amount ? (
                      <span className="text-sm line-through text-ink/45 dark:text-paper/45">
                        {new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: course.price_currency,
                          minimumFractionDigits: 0,
                        }).format(course.original_price_amount)}
                      </span>
                    ) : null}
                  </div>

                  <details className="mt-5 border-t border-paper-line pt-4 dark:border-ink-line">
                    <div className="flex justify-between">
                      <summary className="cursor-pointer text-sm font-medium">
                        Academic assignments ({course.offerings.length})
                      </summary>

                      <Link
                        href={`/admin/courses/${course.id}/batches`}
                        className={primaryClass}
                      >
                        Manage question batches →
                      </Link>
                    </div>

                    <div className="mt-3 space-y-2">
                      {course.offerings.length === 0 && (
                        <p className="text-xs leading-6 text-ink/60 dark:text-paper/60">
                          No academic profiles assigned yet.
                        </p>
                      )}

                      {course.offerings.map((offering) => (
                        <button
                          key={offering.id}
                          type="button"
                          onClick={() =>
                            setEditor({
                              kind: "offering",
                              course,
                              offering,
                            })
                          }
                          className="w-full rounded-xl border border-paper-line p-3 text-left text-xs leading-6 hover:border-gold-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 dark:border-ink-line"
                        >
                          <span className="block font-semibold">
                            {offering.department_name} · {offering.level}
                          </span>

                          <span className="block text-ink/65 dark:text-paper/65">
                            {offering.faculty_name}
                          </span>

                          <span className="block text-ink/65 dark:text-paper/65">
                            {offering.academic_session_label ||
                              "All academic sessions"}
                            {" · "}
                            {offering.is_active ? "Active" : "Inactive"}
                          </span>

                          <span className="text-gold-700 dark:text-gold-200">
                            Edit assignment →
                          </span>
                        </button>
                      ))}
                    </div>
                  </details>

                  <div className="mt-auto flex flex-wrap gap-2 pt-6">
                    <button
                      className={secondaryClass}
                      onClick={() =>
                        setEditor({ kind: "course", course })
                      }
                    >
                      Edit course
                    </button>

                    <button
                      className={secondaryClass}
                      onClick={() =>
                        setEditor({
                          kind: "offering",
                          course,
                          offering: null,
                        })
                      }
                    >
                      + Assignment
                    </button>
                  </div>
                </article>
              ))}
            </section>

            <nav
              aria-label="Course pagination"
              className="mt-8 flex items-center justify-between gap-3 border-t border-paper-line pt-5 dark:border-ink-line"
            >
              <button
                className={secondaryClass}
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                ← Previous
              </button>

              <span className="text-sm text-ink/65 dark:text-paper/65">
                Page {page} of {totalPages}
              </span>

              <button
                className={secondaryClass}
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next →
              </button>
            </nav>
          </>
        )}
      </div>

      {editor?.kind === "course" && (
        <CourseEditor
          key={editor.course?.id ?? "new-course"}
          course={editor.course}
          onClose={closeEditor}
          onSaved={saved}
        />
      )}

      {editor?.kind === "offering" && (
        <OfferingEditor
          key={editor.offering?.id ?? `new-${editor.course.id}`}
          course={editor.course}
          offering={editor.offering}
          onClose={closeEditor}
          onSaved={saved}
        />
      )}
    </main>
  );
}