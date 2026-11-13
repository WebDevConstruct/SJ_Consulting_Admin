"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  publicationIssues,
  type DraftQuestion,
} from "@/lib/questions/batch-schema";

import {
  courseApprovalSchema,
} from "@/lib/courses/question-publication-schema";

import type {
  CourseBatchSavedResponse,
  CourseBatchWorkspace,
} from "@/lib/courses/question-batch-types";

import {
  buttonClass,
  errorMessage,
  inputClass,
  panelClass,
  primaryClass,
  requestJson,
} from "@/lib/courses/batch-ui";
import { type Route} from "next"

type Filter = "all" | "missing" | "warnings";

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

export default function CourseBatchWorkspacePage() {
  const { courseId, batchId } = useParams<{
    courseId: string;
    batchId: string;
  }>();

  const endpoint =
    `/api/admin/courses/${courseId}/question-batches/${batchId}`;

  const backHref = `/admin/courses/${courseId}/batches`;

  const [workspace, setWorkspace] =
    useState<CourseBatchWorkspace | null>(null);

  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showSource, setShowSource] = useState(false);

  const actionLock = useRef(false);
  const loadGeneration = useRef(0);

  function applyWorkspace(result: CourseBatchWorkspace) {
    setWorkspace(result);
    setQuestions(result.questions?.questions ?? []);
   // console.log("Questions Array", result?.questions)
    setSelected(result.questions.questions?.length ? 0 : null);
    setDirty(false);
    setReviewed(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++loadGeneration.current;

    setLoading(true);
    setError("");
    setWorkspace(null);
    setQuestions([]);
    setDirty(false);
    setReviewed(false);
    setSelected(null);

    requestJson<CourseBatchWorkspace>(
      endpoint,
      { signal: controller.signal },
    )
      .then((result) => {
     //   console.log("The then promise", result)
        console.log("Draft Payload",result?.questions)
        if (!controller.signal.aborted) applyWorkspace(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(error));
        }
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          loadGeneration.current === generation
        ) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
      loadGeneration.current++;
    };
  }, [endpoint]);

  useEffect(() => {
    if (!dirty && !busy) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  const editable = workspace?.editable === true;
  const disabled = !editable || Boolean(busy);

  const missingCount = questions.filter(
    (question) =>
      question.question_type === "multiple_choice" &&
      !question.correct_option,
  ).length;

  const warningCount = questions.filter(
    (question) => question.warnings.length > 0,
  ).length;

  // Preserve existing checks, then add course-specific rules.
  const courseValidation = courseApprovalSchema.safeParse({
    reviewed: true,
    questions,
  });

  const issues = [
    ...new Set([
      ...publicationIssues(questions),
      ...(courseValidation.success
        ? []
        : courseValidation.error.issues.map(
            (issue) =>
              `${issue.path.join(".")}: ${issue.message}`,
          )),
    ]),
  ];

  const visible = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => {
      if (
        filter === "missing" &&
        (
          question.question_type !== "multiple_choice" ||
          Boolean(question.correct_option)
        )
      ) return false;

      if (
        filter === "warnings" &&
        question.warnings.length === 0
      ) return false;

      const term = search.trim().toLowerCase();

      return !term ||
        question.question_number.toLowerCase().includes(term) ||
        question.question_text.toLowerCase().includes(term);
    });

  const current =
    selected === null ? null : questions[selected];

  function updateQuestion(
    changes: Partial<DraftQuestion>,
  ) {
    if (disabled || selected === null) return;

    setQuestions((previous) =>
      previous.map((question, index) =>
        index === selected
          ? { ...question, ...changes }
          : question,
      ),
    );

    setDirty(true);
    setReviewed(false);
    setMessage("");
  }

  function addQuestion() {
    if (disabled || questions.length >= 100) return;

    const question: DraftQuestion = {
      question_number: "",
      question_type: "multiple_choice",
      question_text: "",
      options: [
        { label: "A", text: "" },
        { label: "B", text: "" },
        { label: "C", text: "" },
        { label: "D", text: "" },
      ],
      subquestions: [],
      correct_option: null,
      explanation: "",
      source_page: null,
      answer_source: "not_provided",
      warnings: [],
    };

    setSelected(questions.length);
    setQuestions((previous) => [...previous, question]);
    setDirty(true);
    setReviewed(false);
  }

  async function saveDraft() {
    if (!workspace) throw new Error("Batch is not loaded.");

    const result = await requestJson<CourseBatchSavedResponse>(
      endpoint,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_updated_at: workspace.batch.updated_at,
          questions,
        }),
      },
    );

    setWorkspace((previous) =>
      previous
        ? {
            ...previous,
            batch: {
              ...previous.batch,
              status: "reviewing",
              updated_at: result.updated_at,
            },
          }
        : previous,
    );

    setDirty(false);
  }

  async function runAction(
    label: string,
    action: () => Promise<void>,
  ) {
    if (actionLock.current) return;

    actionLock.current = true;
    setBusy(label);
    setError("");
    setMessage("");

    try {
      await action();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      actionLock.current = false;
      setBusy("");
    }
  }

  async function reloadWorkspace() {
    const result =
      await requestJson<CourseBatchWorkspace>(endpoint);

    applyWorkspace(result);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-paper-soft p-8 text-ink dark:bg-ink dark:text-paper">
        Loading course batch workspace…
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="min-h-screen bg-paper-soft p-8 text-ink dark:bg-ink dark:text-paper">
        <Link href={backHref as Route} className={buttonClass}>
          ← Course batches
        </Link>
        <p role="alert" className="mt-6 whitespace-pre-wrap">
          {error || "Batch not found."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper-soft text-ink dark:bg-ink dark:text-paper">
      <div className="mx-auto max-w-content px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href={backHref as Route}
          className={buttonClass}
          onClick={(event) => {
            if (
              busy ||
              (dirty && !window.confirm("Leave without saving changes?"))
            ) {
              event.preventDefault();
            }
          }}
        >
          ← {workspace.course.course_code} batches
        </Link>

        <header className="mt-6 flex flex-col justify-between gap-5 lg:flex-row">
          <div>
            <p className="text-sm text-gold-700 dark:text-gold-200">
              {workspace.course.course_code}
              {" · "}
              {workspace.course.course_title}
              {" · "}
              {workspace.batch.exam_year ?? "Undated source"}
            </p>

            <h1 className="mt-2 font-display text-3xl font-bold">
              {workspace.batch.title}
            </h1>

            <p className="mt-3 text-sm text-ink/65 dark:text-paper/65">
              {questions.length}/100 questions
              {" · "}{missingCount} missing answers
              {" · "}{warningCount} flagged
              {" · "}{workspace.batch.status}
              {dirty ? " · Unsaved changes" : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-2">
            <button
              className={buttonClass}
              onClick={() => setShowSource((value) => !value)}
            >
              {showSource ? "Hide source" : "Source text"}
            </button>

            {workspace.source_url && (
              <a
                href={workspace.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass}
              >
                Original file ↗
              </a>
            )}

            <button
              className={buttonClass}
              disabled={disabled || questions.length >= 100}
              onClick={addQuestion}
            >
              + Question
            </button>

            <button
              className={primaryClass}
              disabled={disabled || !dirty}
              onClick={() =>
                void runAction("Saving draft…", async () => {
                  await saveDraft();
                  setMessage("Draft saved.");
                })
              }
            >
              Save draft
            </button>

            <button
              className={buttonClass}
              disabled={Boolean(busy)}
              onClick={() => {
                if (
                  dirty &&
                  !window.confirm("Discard changes and reload?")
                ) return;

                void runAction("Reloading…", reloadWorkspace);
              }}
            >
              Reload
            </button>
          </div>
        </header>

        {error && (
          <p role="alert" className={`${panelClass} mt-5 whitespace-pre-wrap text-sm`}>
            {error}
          </p>
        )}

        {(busy || message) && (
          <p role="status" className={`${panelClass} mt-5 text-sm`}>
            {busy || message}
          </p>
        )}

        {!editable && (
          <p className={`${panelClass} mt-5 text-sm`}>
            This workspace is read-only because the batch is no longer
            editable or its course is archived.
          </p>
        )}

        {workspace.source_warning && (
          <p className={`${panelClass} mt-5 text-sm`}>
            {workspace.source_warning}
          </p>
        )}

        {showSource && (
          <section className={`${panelClass} mt-5`}>
            <h2 className="font-semibold">
              {workspace.batch.original_filename}
            </h2>

            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-7">
              {workspace.batch.raw_text || "No saved source text."}
            </pre>
          </section>
        )}

        {workspace.batch.extraction_warnings.length > 0 && (
          <details className={`${panelClass} mt-5`}>
            <summary className="cursor-pointer text-sm font-semibold">
              Extraction notes ({workspace.batch.extraction_warnings.length})
            </summary>

            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
              {workspace.batch.extraction_warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </details>
        )}

        {questions.length === 0 && editable && (
          <section className={`${panelClass} mt-6 text-center`}>
            <h2 className="font-display text-2xl">Your source is ready</h2>
            <p className="mt-3 text-sm leading-7">
              Extract a review draft or add questions manually.
              Extraction does not publish questions.
            </p>

            <button
              className={`
                 ${primaryClass} mt-5`}
              disabled={disabled}
              onClick={() =>
                void runAction("Extracting questions…", async () => {
                  if (dirty) await saveDraft();

                  const result = await requestJson<{
                    total_questions: number;
                  }>(`${endpoint}/extract`, {
                    method: "POST",
                  });

                  await reloadWorkspace();

                  setMessage(
                    result.total_questions
                      ? `${result.total_questions} draft questions extracted. Review every question.`
                      : "No questions were recognised. Review the source and enter questions manually.",
                  );
                })
              }
            >
              Start / retry extraction
            </button>
          </section>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
          <aside className={`${panelClass} self-start`}>
            <input
              className={inputClass}
              aria-label="Search questions"
              placeholder="Find question number or text…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {(["all", "missing", "warnings"] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`${buttonClass} !px-3 !py-2 capitalize ${
                    filter === value
                      ? "!border-gold-400"
                      : ""
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[650px] space-y-2 overflow-y-auto">
              {visible.map(({ question, index }) => (
                <button
                  key={index}
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    selected === index
                      ? "border-gold-500 bg-gold-50 dark:bg-gold-400/10"
                      : "border-paper-line dark:border-ink-line"
                  }`}
                >
                  <span className="text-xs font-semibold text-gold-700 dark:text-gold-200">
                    Question {question.question_number || "—"}
                  </span>
                  <p className="mt-1 line-clamp-2 text-sm">
                    {question.question_text || "Untitled question"}
                  </p>
                  <p className="mt-2 text-xs text-ink/60 dark:text-paper/60">
                    {question.question_type === "essay"
                      ? "Essay — draft only"
                      : question.correct_option
                        ? `Answer: ${question.correct_option}`
                        : "Answer missing"}
                    {question.warnings.length ? " · Flagged" : ""}
                  </p>
                </button>
              ))}

              {!visible.length && (
                <p className="py-8 text-center text-sm">
                  No matching questions.
                </p>
              )}
            </div>
          </aside>

          <section className={panelClass}>
            {current && selected !== null ? (
              <div className="space-y-5">
                <div className="flex justify-between gap-3">
                  <h2 className="font-display text-2xl">
                    {editable ? "Review question" : "Question details"}
                  </h2>

                  <button
                    className={buttonClass}
                    disabled={disabled}
                    onClick={() => {
                      if (!window.confirm("Remove this draft question?")) return;

                      setQuestions((previous) =>
                        previous.filter((_, index) => index !== selected),
                      );
                      setSelected(null);
                      setDirty(true);
                      setReviewed(false);
                    }}
                  >
                    Remove
                  </button>
                </div>

                <fieldset disabled={disabled} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Source question number">
                      <input
                        className={inputClass}
                        value={current.question_number}
                        onChange={(event) =>
                          updateQuestion({ question_number: event.target.value })
                        }
                      />
                    </Field>

                    <Field label="Question type">
                      <select
                        className={inputClass}
                        value={current.question_type}
                        onChange={(event) =>
                          updateQuestion({
                            question_type: event.target.value as
                              | "multiple_choice"
                              | "essay",
                            correct_option: null,
                            answer_source: "not_provided",
                          })
                        }
                      >
                        <option value="multiple_choice">Multiple choice</option>
                        <option value="essay">Essay — draft only</option>
                      </select>
                    </Field>
                  </div>

                  <Field label="Question text and shared context">
                    <textarea
                      rows={7}
                      className={inputClass}
                      value={current.question_text}
                      onChange={(event) =>
                        updateQuestion({ question_text: event.target.value })
                      }
                    />
                  </Field>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">Options</h3>

                    <div className="space-y-3">
                      {current.options.map((option, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <input
                            aria-label={`Option ${index + 1} label`}
                            className={`${inputClass} !w-20 shrink-0`}
                            value={option.label}
                            maxLength={5}
                            onChange={(event) =>
                              updateQuestion({
                                options: current.options.map((item, position) =>
                                  position === index
                                    ? { ...item, label: event.target.value }
                                    : item,
                                ),
                                correct_option: null,
                                answer_source: "not_provided",
                              })
                            }
                          />

                          <textarea
                            aria-label={`Option ${index + 1} text`}
                            rows={2}
                            className={inputClass}
                            value={option.text}
                            onChange={(event) =>
                              updateQuestion({
                                options: current.options.map((item, position) =>
                                  position === index
                                    ? { ...item, text: event.target.value }
                                    : item,
                                ),
                              })
                            }
                          />

                          <button
                            className={`${buttonClass} !px-3`}
                            aria-label={`Remove option ${index + 1}`}
                            onClick={() =>
                              updateQuestion({
                                options: current.options.filter(
                                  (_, position) => position !== index,
                                ),
                                correct_option: null,
                                answer_source: "not_provided",
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <p className="mt-2 text-xs text-ink/60 dark:text-paper/60">
                      Published option labels use 1–5 uppercase letters or digits.
                    </p>

                    <button
                      className={`${buttonClass} mt-3`}
                      disabled={disabled || current.options.length >= 30}
                      onClick={() =>
                        updateQuestion({
                          options: [...current.options, { label: "", text: "" }],
                        })
                      }
                    >
                      + Option
                    </button>
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold">Subquestions</h3>

                    <div className="space-y-3">
                      {current.subquestions.map((part, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <input
                            aria-label={`Subquestion ${index + 1} label`}
                            className={`${inputClass} !w-20 shrink-0`}
                            value={part.label}
                            onChange={(event) =>
                              updateQuestion({
                                subquestions: current.subquestions.map(
                                  (item, position) =>
                                    position === index
                                      ? { ...item, label: event.target.value }
                                      : item,
                                ),
                              })
                            }
                          />

                          <textarea
                            aria-label={`Subquestion ${index + 1} text`}
                            className={inputClass}
                            value={part.text}
                            onChange={(event) =>
                              updateQuestion({
                                subquestions: current.subquestions.map(
                                  (item, position) =>
                                    position === index
                                      ? { ...item, text: event.target.value }
                                      : item,
                                ),
                              })
                            }
                          />

                          <button
                            className={`${buttonClass} !px-3`}
                            aria-label={`Remove subquestion ${index + 1}`}
                            onClick={() =>
                              updateQuestion({
                                subquestions: current.subquestions.filter(
                                  (_, position) => position !== index,
                                ),
                              })
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      className={`${buttonClass} mt-3`}
                      onClick={() =>
                        updateQuestion({
                          subquestions: [
                            ...current.subquestions,
                            { label: "", text: "" },
                          ],
                        })
                      }
                    >
                      + Subquestion
                    </button>
                  </div>

                  <Field label="Correct option">
                    <select
                      className={inputClass}
                      value={current.correct_option ?? ""}
                      disabled={disabled || current.question_type !== "multiple_choice"}
                      onChange={(event) =>
                        updateQuestion({
                          correct_option: event.target.value || null,
                          answer_source: event.target.value
                            ? "admin_provided"
                            : "not_provided",
                        })
                      }
                    >
                      <option value="">Answer not supplied</option>
                      {current.options.map((option, index) => (
                        <option
                          key={index}
                          value={option.label}
                          disabled={!option.label.trim()}
                        >
                          {option.label || "Unlabelled option"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <p className="text-xs text-ink/60 dark:text-paper/60">
                    Answer source: {current.answer_source}
                  </p>

                  <Field label="Explanation — optional">
                    <textarea
                      rows={4}
                      className={inputClass}
                      value={current.explanation}
                      onChange={(event) =>
                        updateQuestion({ explanation: event.target.value })
                      }
                    />
                  </Field>

                  <Field label="Source page — optional">
                    <input
                      type="number"
                      min={1}
                      max={2147483647}
                      step={1}
                      className={inputClass}
                      value={current.source_page ?? ""}
                      onChange={(event) =>
                        updateQuestion({
                          source_page: event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  {current.warnings.length > 0 && (
                    <section className="rounded-xl border border-gold-300 p-4">
                      <h3 className="text-sm font-semibold">
                        Verify against the source before resolving
                      </h3>

                      {current.warnings.map((warning, index) => (
                        <div key={index} className="mt-3 flex items-start justify-between gap-3">
                          <p className="text-sm leading-6">{warning}</p>

                          <button
                            className={buttonClass}
                            onClick={() =>
                              updateQuestion({
                                warnings: current.warnings.filter(
                                  (_, position) => position !== index,
                                ),
                              })
                            }
                          >
                            Resolved
                          </button>
                        </div>
                      ))}
                    </section>
                  )}
                </fieldset>
              </div>
            ) : (
              <p className="py-16 text-center text-sm">
                Select a question or add one to begin reviewing.
              </p>
            )}
          </section>
        </section>

        {editable && (
          <section className={`${panelClass} mt-6`}>
            <h2 className="font-display text-2xl">Publication review</h2>

            {issues.length > 0 ? (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  {issues.length} publication requirements remain
                </summary>

                <ul className="mt-3 max-h-56 list-disc space-y-2 overflow-y-auto pl-5 text-sm">
                  {issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="mt-3 text-sm">
                Structural checks passed. Academic accuracy still requires
                your source review.
              </p>
            )}

            <label className="mt-5 flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-gold-600"
                checked={reviewed}
                disabled={disabled}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              I reviewed every question, context, warning, and correct answer.
            </label>

            <button
              className={`${primaryClass} mt-5`}
              disabled={disabled || !reviewed || issues.length > 0}
              onClick={() => {
                if (
                  !window.confirm(
                    `Publish ${questions.length} questions for ${workspace.course.course_code}?`,
                  )
                ) return;

                void runAction("Publishing batch…", async () => {
                  if (dirty) await saveDraft();

                  const result = await requestJson<{ message: string }>(
                    `${endpoint}/approve`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        reviewed: true,
                        questions,
                      }),
                    },
                  );

                  await reloadWorkspace();
                  setMessage(result.message);
                });
              }}
            >
              Publish {questions.length} questions
            </button>
          </section>
        )}
      </div>
    </main>
  );
}