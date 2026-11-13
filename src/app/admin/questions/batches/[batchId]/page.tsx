"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  DraftQuestion,
  publicationIssues,
} from "@/lib/questions/batch-schema";

type Batch = {
  id: string;
  title: string;
  subject_id: string;
  subject_name: string;
  exam_type_name: string;
  exam_year: string;
  status: string;
  original_filename: string | null;
  raw_text: string;
  extraction_method: string | null;
  extraction_warnings: string[];
  updated_at: string;
};

type WorkspaceResponse = {
  batch: Batch;
  questions: DraftQuestion[];
  source_url: string | null;
};

type Filter = "all" | "missing" | "warnings";

const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 " +
  "text-base outline-none focus:border-teal-700 focus:ring-2 " +
  "focus:ring-teal-700/15 disabled:bg-stone-100";

const buttonClass =
  "rounded-xl border border-stone-300 bg-white px-4 py-2.5 " +
  "text-sm font-medium text-stone-700 hover:bg-stone-50 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const primaryClass =
  "rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-semibold " +
  "text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50";

async function requestJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(`Unreadable server response (${response.status}).`);
  }

  if (!response.ok) {
    const details = Array.isArray(result.issues)
      ? result.issues
          .map(
            (issue: { field: string; message: string }) =>
              `${issue.field}: ${issue.message}`,
          )
          .join("\n")
      : "";

    throw new Error(
      [result.error || "Request failed.", details]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result as T;
}

export default function BatchWorkspacePage() {
  const { batchId } = useParams<{ batchId: string }>();

  const [batch, setBatch] = useState<Batch | null>(null);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [showSource, setShowSource] = useState(false);

  const endpoint = `/api/admin/question-batches/${batchId}`;

  const load = useCallback(async () => {
    const result = await requestJson<WorkspaceResponse>(endpoint);

    setBatch(result.batch);
    setQuestions(result.questions);
    setSourceUrl(result.source_url);
    setDirty(false);
    setReviewed(false);
  }, [endpoint]);

  useEffect(() => {
    let active = true;

    async function initialise() {
      setLoading(true);

      try {
        const result = await requestJson<WorkspaceResponse>(endpoint);

        if (!active) return;

        setBatch(result.batch);
        setQuestions(result.questions);
        setSourceUrl(result.source_url);
      } catch (error: unknown) {
        if (active) {
          setError(
            error instanceof Error ? error.message : "Unable to load batch.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialise();

    return () => {
      active = false;
    };
  }, [endpoint]);

  useEffect(() => {
    if (!dirty) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const editable =
    batch?.status === "pending" || batch?.status === "reviewing";

  const disabled = !editable || Boolean(busy);

  const missingCount = questions.filter(
    (question) =>
      question.question_type === "multiple_choice" &&
      !question.correct_option,
  ).length;

  const warningCount = questions.filter(
    (question) => question.warnings.length > 0,
  ).length;

  const issues = publicationIssues(questions);

  const visible = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => {
      if (filter === "missing" && question.correct_option) return false;
      if (
        filter === "missing" &&
        question.question_type !== "multiple_choice"
      ) return false;
      if (filter === "warnings" && question.warnings.length === 0) {
        return false;
      }

      const term = search.trim().toLowerCase();

      return (
        !term ||
        question.question_number.toLowerCase().includes(term) ||
        question.question_text.toLowerCase().includes(term)
      );
    });

  function updateQuestion(
    index: number,
    changes: Partial<DraftQuestion>,
  ) {
    if (disabled) return;

    setQuestions((current) =>
      current.map((question, position) =>
        position === index ? { ...question, ...changes } : question,
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

    setQuestions((current) => [...current, question]);
    setSelected(questions.length);
    setDirty(true);
    setReviewed(false);
  }

  async function saveDraft() {
    if (!batch) return;

    const result = await requestJson<{
      success: boolean;
      updated_at: string;
    }>(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expected_updated_at: batch.updated_at,
        questions,
      }),
    });

    setBatch((current) =>
      current
        ? {
            ...current,
            status: "reviewing",
            updated_at: result.updated_at,
          }
        : current,
    );

    setDirty(false);
  }

  async function runAction(
    label: string,
    action: () => Promise<void>,
  ) {
    setBusy(label);
    setError("");
    setMessage("");

    try {
      await action();
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "The action failed.",
      );
    } finally {
      setBusy("");
    }
  }

  const selectedQuestion =
    selected !== null ? questions[selected] : null;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] p-8 text-stone-600">
        Loading batch workspace…
      </main>
    );
  }

  if (!batch) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] p-8">
        <Link href="/admin/questions" className="text-teal-800">
          ← Question Library
        </Link>
        <p role="alert" className="mt-6 text-rose-800">
          {error || "Batch not found."}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-stone-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link
          href="/admin/questions"
          onClick={(event) => {
            if (
              dirty &&
              !window.confirm("Leave without saving your changes?")
            ) {
              event.preventDefault();
            }
          }}
          className="text-sm font-medium text-teal-800"
        >
          ← Question Library
        </Link>

        <header className="mt-6 flex flex-col justify-between gap-5 lg:flex-row">
          <div>
            <p className="text-sm font-medium text-teal-800">
              {batch.exam_type_name} · {batch.subject_name} ·{" "}
              {batch.exam_year}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {batch.title}
            </h1>
            <p className="mt-3 text-sm text-stone-600">
              {questions.length}/100 questions · {missingCount} missing answers
              {" · "}
              {warningCount} flagged · {batch.status}
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

            {sourceUrl && (
              <a
                href={sourceUrl}
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
              + Add question
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
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mt-5 whitespace-pre-wrap rounded-xl bg-rose-50 p-4 text-sm text-rose-800"
          >
            {error}
          </div>
        )}

        {(message || busy) && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-teal-50 p-4 text-sm text-teal-900"
          >
            {busy || message}
          </p>
        )}

        {!editable && (
          <p className="mt-5 rounded-xl border border-stone-300 bg-white p-4 text-sm text-stone-600">
            This batch is read-only. Published revisions require a separate
            versioned editing workflow.
          </p>
        )}

        {showSource && (
          <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-semibold">
              {batch.original_filename || "Original extracted text"}
            </h2>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {batch.raw_text || "No source text is available."}
            </pre>
          </section>
        )}

        {batch.extraction_warnings.length > 0 && (
          <details className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <summary className="cursor-pointer text-sm font-medium text-amber-950">
              Import notes ({batch.extraction_warnings.length})
            </summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-amber-950">
              {batch.extraction_warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </details>
        )}

        {questions.length === 0 && editable && (
          <section className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
            <h2 className="text-xl font-semibold">
              Your source is ready
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-600">
              Extract draft questions using the AI and parser fallback,
              or begin entering questions manually.
            </p>
            <button
              className={`${primaryClass} mt-5`}
              disabled={Boolean(busy)}
              onClick={() =>
                void runAction("Extracting questions…", async () => {
                  if (dirty) await saveDraft();

                  const result = await requestJson<{
                    total_questions: number;
                  }>(`${endpoint}/extract`, { method: "POST" });

                  await load();

                  setMessage(
                    result.total_questions > 0
                      ? `${result.total_questions} draft questions extracted.`
                      : "No questions were recognised. Review the source and add questions manually.",
                  );
                })
              }
            >
              Start / retry extraction
            </button>
          </section>
        )}

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)]">
          <div className="self-start rounded-2xl border border-stone-200 bg-white p-4">
            <input
              className={inputClass}
              placeholder="Find number or question text…"
              aria-label="Search questions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["all", `All (${questions.length})`],
                ["missing", `Missing answers (${missingCount})`],
                ["warnings", `Flagged (${warningCount})`],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilter(value as Filter)}
                  aria-pressed={filter === value}
                  className={`rounded-lg px-3 py-2 text-xs font-medium ${
                    filter === value
                      ? "bg-teal-900 text-white"
                      : "bg-stone-100 text-stone-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[650px] space-y-2 overflow-y-auto">
              {visible.map(({ question, index }) => (
                <button
                  key={index}
                  onClick={() => setSelected(index)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    selected === index
                      ? "border-teal-700 bg-teal-50"
                      : "border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  <span className="text-xs font-semibold text-teal-800">
                    Question {question.question_number || "—"}
                  </span>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-800">
                    {question.question_text || "Untitled question"}
                  </p>
                  <p className="mt-2 text-xs text-stone-500">
                    {question.question_type === "essay"
                      ? "Essay"
                      : question.correct_option
                      ? `Answer: ${question.correct_option}`
                      : "Answer missing"}
                    {question.warnings.length > 0 ? " · Flagged" : ""}
                  </p>
                </button>
              ))}

              {visible.length === 0 && (
                <p className="py-8 text-center text-sm text-stone-500">
                  No matching questions.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            {selectedQuestion && selected !== null ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">
                    {editable ? "Edit question" : "Question details"}
                  </h2>
                  <button
                    className="text-sm text-rose-700 disabled:opacity-40"
                    disabled={disabled}
                    onClick={() => {
                      if (!window.confirm("Remove this question from the draft?")) {
                        return;
                      }

                      setQuestions((current) =>
                        current.filter((_, index) => index !== selected),
                      );
                      setSelected(null);
                      setDirty(true);
                      setReviewed(false);
                    }}
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">
                    <span>Source number</span>
                    <input
                      className={inputClass}
                      disabled={disabled}
                      value={selectedQuestion.question_number}
                      onChange={(event) =>
                        updateQuestion(selected, {
                          question_number: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium">
                    <span>Question type</span>
                    <select
                      className={inputClass}
                      disabled={disabled}
                      value={selectedQuestion.question_type}
                      onChange={(event) =>
                        updateQuestion(selected, {
                          question_type: event.target.value as
                            | "multiple_choice"
                            | "essay",
                        })
                      }
                    >
                      <option value="multiple_choice">Multiple choice</option>
                      <option value="essay">Essay — draft only</option>
                    </select>
                  </label>
                </div>

                <label className="block space-y-2 text-sm font-medium">
                  <span>Question text and shared context</span>
                  <textarea
                    rows={7}
                    className={inputClass}
                    disabled={disabled}
                    value={selectedQuestion.question_text}
                    onChange={(event) =>
                      updateQuestion(selected, {
                        question_text: event.target.value,
                      })
                    }
                  />
                </label>

                <fieldset className="space-y-3">
                  <legend className="mb-2 text-sm font-semibold">
                    Options
                  </legend>

                  {selectedQuestion.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-start gap-2">
                      <input
                        aria-label={`Option ${optionIndex + 1} label`}
                        className={`${inputClass} !w-20`}
                        disabled={disabled}
                        value={option.label}
                        onChange={(event) =>
                          updateQuestion(selected, {
                            options: selectedQuestion.options.map(
                              (item, index) =>
                                index === optionIndex
                                  ? { ...item, label: event.target.value }
                                  : item,
                            ),
                            correct_option: null,
                            answer_source: "not_provided",
                          })
                        }
                      />
                      <textarea
                        aria-label={`Option ${optionIndex + 1} text`}
                        rows={2}
                        className={inputClass}
                        disabled={disabled}
                        value={option.text}
                        onChange={(event) =>
                          updateQuestion(selected, {
                            options: selectedQuestion.options.map(
                              (item, index) =>
                                index === optionIndex
                                  ? { ...item, text: event.target.value }
                                  : item,
                            ),
                          })
                        }
                      />
                      <button
                        aria-label={`Remove option ${optionIndex + 1}`}
                        className={`${buttonClass} !px-3`}
                        disabled={disabled}
                        onClick={() =>
                          updateQuestion(selected, {
                            options: selectedQuestion.options.filter(
                              (_, index) => index !== optionIndex,
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

                  <button
                    className={buttonClass}
                    disabled={disabled || selectedQuestion.options.length >= 30}
                    onClick={() =>
                      updateQuestion(selected, {
                        options: [
                          ...selectedQuestion.options,
                          { label: "", text: "" },
                        ],
                      })
                    }
                  >
                    + Add option
                  </button>
                </fieldset>

                <fieldset className="space-y-3">
                  <legend className="mb-2 text-sm font-semibold">
                    Subquestions
                  </legend>

                  {selectedQuestion.subquestions.map((part, partIndex) => (
                    <div key={partIndex} className="flex items-start gap-2">
                      <input
                        aria-label={`Subquestion ${partIndex + 1} label`}
                        className={`${inputClass} !w-20`}
                        disabled={disabled}
                        value={part.label}
                        onChange={(event) =>
                          updateQuestion(selected, {
                            subquestions: selectedQuestion.subquestions.map(
                              (item, index) =>
                                index === partIndex
                                  ? { ...item, label: event.target.value }
                                  : item,
                            ),
                          })
                        }
                      />
                      <textarea
                        aria-label={`Subquestion ${partIndex + 1} text`}
                        className={inputClass}
                        disabled={disabled}
                        value={part.text}
                        onChange={(event) =>
                          updateQuestion(selected, {
                            subquestions: selectedQuestion.subquestions.map(
                              (item, index) =>
                                index === partIndex
                                  ? { ...item, text: event.target.value }
                                  : item,
                            ),
                          })
                        }
                      />
                      <button
                        className={`${buttonClass} !px-3`}
                        disabled={disabled}
                        aria-label={`Remove subquestion ${partIndex + 1}`}
                        onClick={() =>
                          updateQuestion(selected, {
                            subquestions:
                              selectedQuestion.subquestions.filter(
                                (_, index) => index !== partIndex,
                              ),
                          })
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  <button
                    className={buttonClass}
                    disabled={disabled}
                    onClick={() =>
                      updateQuestion(selected, {
                        subquestions: [
                          ...selectedQuestion.subquestions,
                          { label: "", text: "" },
                        ],
                      })
                    }
                  >
                    + Add subquestion
                  </button>
                </fieldset>

                <label className="block space-y-2 text-sm font-medium">
                  <span>Correct option</span>
                  <select
                    className={inputClass}
                    disabled={
                      disabled ||
                      selectedQuestion.question_type !== "multiple_choice"
                    }
                    value={selectedQuestion.correct_option || ""}
                    onChange={(event) =>
                      updateQuestion(selected, {
                        correct_option: event.target.value || null,
                        answer_source: event.target.value
                          ? "admin_provided"
                          : "not_provided",
                      })
                    }
                  >
                    <option value="">Answer not supplied</option>
                    {selectedQuestion.options.map((option, index) => (
                      <option
                        key={index}
                        value={option.label}
                        disabled={!option.label.trim()}
                      >
                        {option.label || "Unlabelled option"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2 text-sm font-medium">
                  <span>Explanation — optional</span>
                  <textarea
                    rows={4}
                    className={inputClass}
                    disabled={disabled}
                    value={selectedQuestion.explanation}
                    onChange={(event) =>
                      updateQuestion(selected, {
                        explanation: event.target.value,
                      })
                    }
                  />
                </label>

                {selectedQuestion.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-50 p-4">
                    <h3 className="text-sm font-semibold text-amber-950">
                      Resolve after checking the source
                    </h3>

                    {selectedQuestion.warnings.map((warning, index) => (
                      <div
                        key={index}
                        className="mt-3 flex items-start justify-between gap-3"
                      >
                        <p className="text-sm text-amber-950">{warning}</p>
                        <button
                          disabled={disabled}
                          className="shrink-0 text-xs font-semibold text-teal-900"
                          onClick={() =>
                            updateQuestion(selected, {
                              warnings: selectedQuestion.warnings.filter(
                                (_, position) => position !== index,
                              ),
                            })
                          }
                        >
                          Resolved
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-sm text-stone-500">
                Select a question to review it, or add a new question.
              </div>
            )}
          </div>
        </section>

        {editable && (
          <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="text-lg font-semibold">Publication review</h2>

            {issues.length > 0 ? (
              <details className="mt-3 text-sm text-amber-900">
                <summary className="cursor-pointer font-medium">
                  {issues.length} publication requirements remain
                </summary>
                <ul className="mt-3 max-h-48 list-disc space-y-1 overflow-auto pl-5">
                  {issues.map((issue, index) => (
                    <li key={index}>{issue}</li>
                  ))}
                </ul>
              </details>
            ) : (
              <p className="mt-2 text-sm text-teal-800">
                Structural publication checks passed. Confirm the academic
                content and answers before publishing.
              </p>
            )}

            <label className="mt-5 flex items-start gap-3 text-sm text-stone-700">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-teal-800"
                checked={reviewed}
                disabled={Boolean(busy)}
                onChange={(event) => setReviewed(event.target.checked)}
              />
              I reviewed every question, its source context, warnings,
              and correct answer.
            </label>

            <button
              className={`${primaryClass} mt-5`}
              disabled={Boolean(busy) || !reviewed || issues.length > 0}
              onClick={() =>
                void runAction("Publishing batch…", async () => {
                  if (dirty) await saveDraft();

                  const result = await requestJson<{ message: string }>(
                    "/api/admin/approval",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        import_id: batch.id,
                        reviewed: true,
                        questions,
                      }),
                    },
                  );

                  await load();
                  setMessage(result.message);
                })
              }
            >
              Publish {questions.length} questions
            </button>
          </section>
        )}
      </div>
    </main>
  );
}