"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  Check,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type Course = {
  id: string;
  course_title: string;
  course_code: string;
  short_description: string | null;
};

type CourseTopic = {
  id: string;
  course_id: string;
  title: string;
  summary: string;
  content: string;
  position: number;
  is_published: boolean;
};

type TopicForm = {
  id: string | null;
  title: string;
  summary: string;
  content: string;
  position: number;
  is_published: boolean;
};

const emptyTopicForm: TopicForm = {
  id: null,
  title: "",
  summary: "",
  content: "",
  position: 1,
  is_published: true,
};

export default function AdminStudyCoursesPage() {
  const supabase = createClient();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const [topics, setTopics] = useState<CourseTopic[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);

  const [topicForm, setTopicForm] = useState<TopicForm>(emptyTopicForm);
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [isDeletingTopicId, setIsDeletingTopicId] = useState<string | null>(
    null
  );

  const [status, setStatus] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const loadCourses = useCallback(async () => {
    setIsLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("courses")
        .select("id, course_title, course_code, short_description")
        .order("course_title", { ascending: true });

      if (error) {
        console.error("Failed to load courses:", error);
        return;
      }

      setCourses((data ?? []) as unknown as Course[]);
    } catch (error) {
      console.error("Unexpected course loading error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [router, supabase]);

  const loadTopics = useCallback(async (course: Course) => {
    setSelectedCourse(course);
    setTopics([]);
    setTopicForm(emptyTopicForm);
    setIsEditingTopic(false);
    setStatus(null);
    setIsLoadingTopics(true);

    try {
      const { data, error } = await supabase
        .from("course_topics")
        .select(
          "id, course_id, title, summary, content, position, is_published"
        )
        .eq("course_id", course.id)
        .order("position", { ascending: true });

      if (error) {
        console.error("Failed to load course topics:", error);
        setStatus({
          kind: "error",
          message: error.message,
        });
        return;
      }

      setTopics((data ?? []) as CourseTopic[]);
    } catch (error) {
      console.error("Unexpected topic loading error:", error);
      setStatus({
        kind: "error",
        message: "Could not load the topics for this course.",
      });
    } finally {
      setIsLoadingTopics(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleStartNewTopic = () => {
    const nextPosition = topics.length + 1;

    setTopicForm({
      ...emptyTopicForm,
      position: nextPosition,
    });
    setIsEditingTopic(true);
    setStatus(null);
  };

  const handleEditTopic = (topic: CourseTopic) => {
    setTopicForm({
      id: topic.id,
      title: topic.title,
      summary: topic.summary,
      content: topic.content,
      position: topic.position,
      is_published: topic.is_published,
    });
    setIsEditingTopic(true);
    setStatus(null);
  };

  const handleSaveTopic = async () => {
    if (!selectedCourse) return;

    if (!topicForm.title.trim()) {
      setStatus({
        kind: "error",
        message: "Please enter a topic title.",
      });
      return;
    }

    setIsSavingTopic(true);
    setStatus(null);

    try {
      const payload = {
        course_id: selectedCourse.id,
        title: topicForm.title.trim(),
        summary: topicForm.summary.trim(),
        content: topicForm.content,
        position: topicForm.position,
        is_published: topicForm.is_published,
        updated_at: new Date().toISOString(),
      };

      if (topicForm.id) {
        const { error } = await supabase
          .from("course_topics")
          .update(payload)
          .eq("id", topicForm.id);

        if (error) {
          throw error;
        }

        setTopics((previousTopics) =>
          previousTopics
            .map((topic) =>
              topic.id === topicForm.id
                ? {
                    ...topic,
                    ...payload,
                  }
                : topic
            )
            .sort((a, b) => a.position - b.position)
        );

        setStatus({
          kind: "success",
          message: "Topic updated successfully.",
        });
      } else {
        const { data, error } = await supabase
          .from("course_topics")
          .insert(payload)
          .select(
            "id, course_id, title, summary, content, position, is_published"
          )
          .single();

        if (error) {
          throw error;
        }

        setTopics((previousTopics) =>
          [...previousTopics, data as CourseTopic].sort(
            (a, b) => a.position - b.position
          )
        );

        setStatus({
          kind: "success",
          message: "Topic added successfully.",
        });
      }

      setTopicForm(emptyTopicForm);
      setIsEditingTopic(false);
    } catch (error) {
      console.error("Failed to save course topic:", error);

      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not save this topic. Please try again.",
      });
    } finally {
      setIsSavingTopic(false);
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    setIsDeletingTopicId(topicId);
    setStatus(null);

    try {
      const { error } = await supabase
        .from("course_topics")
        .delete()
        .eq("id", topicId);

      if (error) {
        throw error;
      }

      setTopics((previousTopics) =>
        previousTopics.filter((topic) => topic.id !== topicId)
      );

      setStatus({
        kind: "success",
        message: "Topic deleted successfully.",
      });
    } catch (error) {
      console.error("Failed to delete course topic:", error);

      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not delete this topic. Please try again.",
      });
    } finally {
      setIsDeletingTopicId(null);
    }
  };

  const handleTogglePublished = async (topic: CourseTopic) => {
    setStatus(null);

    try {
      const nextPublished = !topic.is_published;

      const { error } = await supabase
        .from("course_topics")
        .update({
          is_published: nextPublished,
          updated_at: new Date().toISOString(),
        })
        .eq("id", topic.id);

      if (error) {
        throw error;
      }

      setTopics((previousTopics) =>
        previousTopics.map((currentTopic) =>
          currentTopic.id === topic.id
            ? {
                ...currentTopic,
                is_published: nextPublished,
              }
            : currentTopic
        )
      );
    } catch (error) {
      console.error("Failed to update topic publication status:", error);

      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not update the topic status.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 dark:bg-ink">
        <Loader2 className="h-8 w-8 animate-spin text-gold-500 dark:text-gold-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper px-5 py-8 dark:bg-ink md:px-10 md:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => router.push("/admin/home")}
          className="focus-gold flex items-center gap-2 text-[13.5px] font-medium text-current/70 hover:text-gold-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to admin dashboard
        </button>

        <div className="mt-8">
          <div className="h-[2px] w-12 bg-gold-metal" />

          <h1 className="mt-6 font-display text-[28px] leading-tight sm:text-[32px]">
            Study for courses
          </h1>

          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-current/65">
            Select a course, add topics to its outline, and manage the summary
            and study notes students will see.
          </p>
        </div>

        {status ? (
          <p
            role="status"
            className={`mt-6 rounded-sm px-4 py-3 text-[13px] ${
              status.kind === "success"
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            {status.message}
          </p>
        ) : null}

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-sm border border-paper-line bg-paper-soft p-6 dark:border-ink-line dark:bg-ink-surface">
            <h2 className="font-display text-[18px]">Courses</h2>

            <div className="mt-5 flex flex-col gap-3">
              {courses.length === 0 ? (
                <p className="text-[13.5px] text-current/60">
                  No courses are available yet.
                </p>
              ) : (
                courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => loadTopics(course)}
                    className={`focus-gold w-full rounded-sm border px-4 py-3 text-left transition-colors ${
                      selectedCourse?.id === course.id
                        ? "border-gold-400 bg-gold-400/5"
                        : "border-paper-line hover:border-gold-400/50 dark:border-ink-line"
                    }`}
                  >
                    <p className="text-[11.5px] font-medium uppercase tracking-wide text-current/45">
                      {course.course_code}
                    </p>

                    <p className="mt-1 truncate font-display text-[15.5px]">
                      {course.course_title}
                    </p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-sm border border-paper-line bg-paper-soft p-6 dark:border-ink-line dark:bg-ink-surface lg:col-span-2">
            {!selectedCourse ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <BookOpenText className="h-8 w-8 text-gold-500 dark:text-gold-300" />
                <h2 className="mt-4 font-display text-[20px]">
                  Select a course
                </h2>
                <p className="mt-2 max-w-sm text-[13.5px] text-current/60">
                  Choose a course on the left to manage its study topics and
                  notes.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-medium uppercase tracking-wide text-current/45">
                      {selectedCourse.course_code}
                    </p>

                    <h2 className="mt-1 font-display text-[22px]">
                      {selectedCourse.course_title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartNewTopic}
                    className="focus-gold flex items-center gap-2 rounded-sm border border-gold-400 bg-gold-metal-soft px-4 py-2.5 text-[13.5px] font-semibold text-ink shadow-gold"
                  >
                    <Plus className="h-4 w-4" />
                    Add topic
                  </button>
                </div>

                {isLoadingTopics ? (
                  <div className="mt-6 flex items-center gap-3 text-current/60">
                    <Loader2 className="h-5 w-5 animate-spin text-gold-500 dark:text-gold-300" />
                    <span className="text-[13.5px]">Loading topics...</span>
                  </div>
                ) : (
                  <>
                    {isEditingTopic ? (
                      <div className="mt-6 rounded-sm border border-paper-line bg-paper p-6 dark:border-ink-line dark:bg-ink-soft">
                        <div className="flex items-center justify-between gap-4">
                          <h3 className="font-display text-[18px]">
                            {topicForm.id ? "Edit topic" : "Add new topic"}
                          </h3>

                          <button
                            type="button"
                            onClick={() => {
                              setTopicForm(emptyTopicForm);
                              setIsEditingTopic(false);
                            }}
                            className="focus-gold rounded-sm border border-paper-line px-3 py-2 text-[12.5px] text-current/60 dark:border-ink-line"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-5">
                          <div>
                            <label
                              htmlFor="topic-title"
                              className="block text-[13.5px] font-medium text-current/80"
                            >
                              Topic title
                            </label>

                            <input
                              id="topic-title"
                              value={topicForm.title}
                              onChange={(event) =>
                                setTopicForm((previousForm) => ({
                                  ...previousForm,
                                  title: event.target.value,
                                }))
                              }
                              placeholder="e.g. Introduction to Entrepreneurship"
                              className="focus-gold mt-2 w-full rounded-sm border border-paper-line bg-paper px-4 py-3 text-[14.5px] dark:border-ink-line dark:bg-ink-surface"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="topic-summary"
                              className="block text-[13.5px] font-medium text-current/80"
                            >
                              Short summary
                            </label>

                            <textarea
                              id="topic-summary"
                              value={topicForm.summary}
                              onChange={(event) =>
                                setTopicForm((previousForm) => ({
                                  ...previousForm,
                                  summary: event.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="Write a short, relevant overview of this topic."
                              className="focus-gold mt-2 w-full resize-y rounded-sm border border-paper-line bg-paper px-4 py-3 text-[14.5px] dark:border-ink-line dark:bg-ink-surface"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor="topic-content"
                              className="block text-[13.5px] font-medium text-current/80"
                            >
                              Study notes
                            </label>

                            <textarea
                              id="topic-content"
                              value={topicForm.content}
                              onChange={(event) =>
                                setTopicForm((previousForm) => ({
                                  ...previousForm,
                                  content: event.target.value,
                                }))
                              }
                              rows={12}
                              placeholder="Write the full study notes for this topic. Use line breaks, headings and bullet points where needed."
                              className="focus-gold mt-2 w-full resize-y rounded-sm border border-paper-line bg-paper px-4 py-3 text-[14.5px] dark:border-ink-line dark:bg-ink-surface"
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="topic-position"
                                className="block text-[13.5px] font-medium text-current/80"
                              >
                                Outline position
                              </label>

                              <input
                                id="topic-position"
                                type="number"
                                min={1}
                                value={topicForm.position}
                                onChange={(event) =>
                                  setTopicForm((previousForm) => ({
                                    ...previousForm,
                                    position:
                                      Number(event.target.value) || 1,
                                  }))
                                }
                                className="focus-gold mt-2 w-full rounded-sm border border-paper-line bg-paper px-4 py-3 text-[14.5px] dark:border-ink-line dark:bg-ink-surface"
                              />
                            </div>

                            <div className="flex items-end">
                              <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-paper-line px-4 py-3 dark:border-ink-line">
                                <input
                                  type="checkbox"
                                  checked={topicForm.is_published}
                                  onChange={(event) =>
                                    setTopicForm((previousForm) => ({
                                      ...previousForm,
                                      is_published: event.target.checked,
                                    }))
                                  }
                                  className="h-4 w-4 accent-gold-500"
                                />

                                <span className="text-[13.5px] font-medium text-current/80">
                                  Publish this topic
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveTopic}
                          disabled={isSavingTopic}
                          className="focus-gold mt-6 flex w-full items-center justify-center gap-2 rounded-sm border border-gold-400 bg-gold-metal-soft px-6 py-3 text-[14px] font-semibold text-ink shadow-gold sm:w-auto"
                        >
                          {isSavingTopic ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              {topicForm.id ? "Save changes" : "Add topic"}
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-6">
                        {topics.length === 0 ? (
                          <div className="rounded-sm border border-paper-line bg-paper p-6 text-center dark:border-ink-line dark:bg-ink-soft">
                            <BookOpenText className="mx-auto h-7 w-7 text-gold-500 dark:text-gold-300" />
                            <p className="mt-3 text-[14px] text-current/60">
                              No topics have been added to this course yet.
                            </p>

                            <button
                              type="button"
                              onClick={handleStartNewTopic}
                              className="focus-gold mt-5 rounded-sm border border-gold-400 bg-gold-metal-soft px-5 py-2.5 text-[13.5px] font-semibold text-ink"
                            >
                              Add the first topic
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {topics.map((topic, index) => (
                              <div
                                key={topic.id}
                                className="rounded-sm border border-paper-line bg-paper p-5 dark:border-ink-line dark:bg-ink-soft"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-[11.5px] font-medium uppercase tracking-wide text-current/45">
                                      Topic {index + 1} · Position{" "}
                                      {topic.position}
                                    </p>

                                    <h3 className="mt-1 font-display text-[17px]">
                                      {topic.title}
                                    </h3>

                                    <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-current/60">
                                      {topic.summary ||
                                        "No summary has been added yet."}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePublished(topic)}
                                      className={`focus-gold flex items-center gap-1.5 rounded-sm border px-3 py-2 text-[12.5px] font-medium ${
                                        topic.is_published
                                          ? "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
                                          : "border-paper-line text-current/60 dark:border-ink-line"
                                      }`}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      {topic.is_published
                                        ? "Published"
                                        : "Unpublished"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleEditTopic(topic)}
                                      className="focus-gold rounded-sm border border-gold-400 bg-gold-metal-soft px-3 py-2 text-[12.5px] font-semibold text-ink"
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteTopic(topic.id)
                                      }
                                      disabled={
                                        isDeletingTopicId === topic.id
                                      }
                                      className="focus-gold flex items-center gap-1.5 rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12.5px] font-medium text-red-600 disabled:opacity-50 dark:text-red-400"
                                    >
                                      {isDeletingTopicId === topic.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}