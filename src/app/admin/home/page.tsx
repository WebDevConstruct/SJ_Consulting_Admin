"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CreditCard,
  FileQuestion,
  Newspaper,
  PenLine,
  RefreshCw,
  User,
} from "lucide-react";
import { type Route } from "next"
import { StatCard } from "@/components/stat-card";
import { createClient } from "@lib/supabase/client";
import { useAppContext } from "../../../../Context";

type AdminMetrics = {
  total_cbt_payments: number;
  pending_cbt_payments: number;
  approved_cbt_payments: number;
  total_blogs: number;
  published_blogs: number;
  draft_blogs: number;
  total_announcements: number;
  published_announcements: number;
  draft_announcements: number;
  total_questions: number;
  total_courses: number;
  published_courses: number;
  recent_announcements: {
    id: string;
    title: string;
    category: string;
    is_published: boolean;
    created_at: string;
  }[];
  recent_blogs: {
    id: string;
    title: string;
    is_published: boolean;
    created_at: string;
  }[];
};

type CountRow = {
  count: number;
};

const supabase = createClient();

export default function AdminHomePage() {
  const { userAuthInfo } = useAppContext();

  const [metrics, setMetrics] = useState<AdminMetrics | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      const [
        cbtPayments,
        pendingPayments,
        approvedPayments,
        blogs,
        publishedBlogs,
        draftBlogs,
        announcements,
        publishedAnnouncements,
        draftAnnouncements,
        questions,
        courses,
        publishedCourses,
        recentAnnouncements,
        recentBlogs,
      ] = await Promise.all([
        supabase
          .from("course_payment_requests")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("course_payment_requests")
          .select("id", {
            count: "exact",
            head: true,
          })
          .in("status", [
            "pending_payment",
            "payment_claimed",
            "receipt_sent",
          ]),
        supabase
          .from("course_payment_requests")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("status", "approved"),
        supabase
          .from("blogs")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("blogs")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("is_published", true),
        supabase
          .from("blogs")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("is_published", false),
        supabase
          .from("announcements")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("announcements")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("is_published", true),
        supabase
          .from("announcements")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("is_published", false),
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("courses")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("courses")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("status", "published"),
        supabase
          .from("announcements")
          .select(
            "id, title, category, is_published, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("blogs")
          .select(
            "id, title, is_published, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const requests = [
        cbtPayments,
        pendingPayments,
        approvedPayments,
        blogs,
        publishedBlogs,
        draftBlogs,
        announcements,
        publishedAnnouncements,
        draftAnnouncements,
        questions,
        courses,
        publishedCourses,
        recentAnnouncements,
        recentBlogs,
      ];

      const failedRequest = requests.find(
        (request) => request.error,
      );

      if (failedRequest?.error) {
        throw failedRequest.error;
      }

      const count = (result: { count: number | null }) =>
        result.count ?? 0;

      setMetrics({
        total_cbt_payments: count(cbtPayments),
        pending_cbt_payments: count(pendingPayments),
        approved_cbt_payments: count(approvedPayments),
        total_blogs: count(blogs),
        published_blogs: count(publishedBlogs),
        draft_blogs: count(draftBlogs),
        total_announcements: count(announcements),
        published_announcements: count(
          publishedAnnouncements,
        ),
        draft_announcements: count(draftAnnouncements),
        total_questions: count(questions),
        total_courses: count(courses),
        published_courses: count(publishedCourses),
        recent_announcements:
          (recentAnnouncements.data ?? []) as AdminMetrics["recent_announcements"],
        recent_blogs:
          (recentBlogs.data ?? []) as AdminMetrics["recent_blogs"],
      });
    } catch (loadError) {
      console.error("Admin metrics failed:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load admin metrics.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const displayName =
    userAuthInfo?.username ||
   
    "Admin";

  return (
    <div className="space-y-8">
      <div className="flex w-full items-center justify-between gap-5">
        <h1 className="font-display text-[26px] uppercase leading-tight sm:text-[30px]">
          Welcome back, {displayName} 👋
        </h1>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadMetrics}
            disabled={refreshing}
            aria-label="Refresh dashboard metrics"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-300 bg-paper-soft text-ink transition hover:bg-gold-metal-soft disabled:opacity-50 dark:border-gold-400/40 dark:bg-ink-soft dark:text-paper"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
          </button>

          <Link
            href="/admin/profile"
            aria-label="Open admin profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-300 bg-paper-soft text-ink dark:border-gold-400/40 dark:bg-ink-soft dark:text-paper"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-[32px] bg-ink p-7 text-paper sm:p-10">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.22em] text-gold-200">
            SJ Consulting Limited · Control room
          </p>

          <h1 className="mt-4 font-display text-4xl leading-tight tracking-tightest sm:text-6xl">
            Welcome to where the magic happens.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
            Track course payments, publish announcements, manage
            blogs, prepare aspirant questions, and maintain
            undergraduate course content from one control room.
          </p>

          <Link
            href={`/admin/cbt-payments` as Route}
            className="mt-7 inline-flex rounded-full bg-gold-metal px-5 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Review CBT payments
          </Link>
        </div>

        <div className="mt-10 border-t border-white/10 pt-5 text-xs text-white/45">
          Live operational metrics update directly from your
          Supabase database.
        </div>
      </section>

      {error && (
        <section
          role="alert"
          className="rounded-2xl border border-paper-line bg-paper p-5 text-sm text-ink/70 dark:border-ink-line dark:bg-ink-soft dark:text-paper/70"
        >
          {error}
        </section>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-gold-600">
              At a glance
            </p>

            <h2 className="mt-1 font-display text-3xl tracking-tightest">
              The pulse of the work.
            </h2>
          </div>

          <span className="text-sm text-black/45 dark:text-white/45">
            Live database metrics
          </span>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((placeholder) => (
              <div
                key={placeholder}
                className="h-36 animate-pulse rounded-3xl border border-paper-line bg-paper dark:border-ink-line dark:bg-ink-surface"
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="CBT payments"
              value={metrics?.total_cbt_payments ?? 0}
              detail={`${metrics?.pending_cbt_payments ?? 0} awaiting action`}
              accent
            />

            <StatCard
              label="Approved payments"
              value={metrics?.approved_cbt_payments ?? 0}
              detail="Courses currently unlocked"
            />

            <StatCard
              label="Blogs"
              value={metrics?.total_blogs ?? 0}
              detail={`${metrics?.published_blogs ?? 0} published · ${
                metrics?.draft_blogs ?? 0
              } drafts`}
            />

            <StatCard
              label="Announcements"
              value={metrics?.total_announcements ?? 0}
              detail={`${metrics?.published_announcements ?? 0} published · ${
                metrics?.draft_announcements ?? 0
              } drafts`}
            />

            <StatCard
              label="Aspirant questions"
              value={metrics?.total_questions ?? 0}
              detail="Questions available for CBT sessions"
            />

            <StatCard
              label="Undergraduate courses"
              value={metrics?.total_courses ?? 0}
              detail={`${metrics?.published_courses ?? 0} published`}
            />

            <StatCard
              label="Published content"
              value={
                (metrics?.published_blogs ?? 0) +
                (metrics?.published_announcements ?? 0) +
                (metrics?.published_courses ?? 0)
              }
              detail="Blogs, announcements, and courses"
            />

            <StatCard
              label="Draft content"
              value={
                (metrics?.draft_blogs ?? 0) +
                (metrics?.draft_announcements ?? 0)
              }
              detail="Blogs and announcements awaiting publication"
            />
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <article className="rounded-3xl border border-paper-line bg-paper p-6 dark:border-ink-line dark:bg-ink-surface">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gold-600">
                Recent activity
              </p>

              <h2 className="mt-2 font-display text-2xl tracking-tightest">
                What has been updated.
              </h2>
            </div>

            <Link
              href="/admin/information"
              className="rounded-full border border-gold-400 bg-gold-metal-soft px-4 py-2 text-xs font-semibold text-ink dark:text-paper"
            >
              Manage information
            </Link>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Newspaper className="h-4 w-4 text-gold-600 dark:text-gold-300" />
                Latest announcements
              </h3>

              <ul className="mt-3 space-y-3">
                {(metrics?.recent_announcements ?? []).map(
                  (announcement) => (
                    <li
                      key={announcement.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-paper-line bg-paper-soft p-4 dark:border-ink-line dark:bg-ink"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {announcement.title}
                        </p>

                        <p className="mt-1 text-xs capitalize text-ink/55 dark:text-paper/55">
                          {announcement.category} ·{" "}
                          {new Date(
                            announcement.created_at,
                          ).toLocaleDateString()}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          announcement.is_published
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : "bg-gold-400/10 text-gold-700 dark:text-gold-200"
                        }`}
                      >
                        {announcement.is_published
                          ? "Published"
                          : "Draft"}
                      </span>
                    </li>
                  ),
                )}

                {(metrics?.recent_announcements ?? []).length ===
                  0 && (
                  <li className="rounded-xl border border-paper-line bg-paper-soft p-4 text-sm text-ink/60 dark:border-ink-line dark:bg-ink dark:text-paper/60">
                    No announcements have been created yet.
                  </li>
                )}
              </ul>
            </div>

            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <PenLine className="h-4 w-4 text-gold-600 dark:text-gold-300" />
                Latest blogs
              </h3>

              <ul className="mt-3 space-y-3">
                {(metrics?.recent_blogs ?? []).map((blog) => (
                  <li
                    key={blog.id}
                    className="flex items-start justify-between gap-4 rounded-xl border border-paper-line bg-paper-soft p-4 dark:border-ink-line dark:bg-ink"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {blog.title}
                      </p>

                      <p className="mt-1 text-xs text-ink/55 dark:text-paper/55">
                        {new Date(
                          blog.created_at,
                        ).toLocaleDateString()}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        blog.is_published
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-gold-400/10 text-gold-700 dark:text-gold-200"
                      }`}
                    >
                      {blog.is_published
                        ? "Published"
                        : "Draft"}
                    </span>
                  </li>
                ))}

                {(metrics?.recent_blogs ?? []).length === 0 && (
                  <li className="rounded-xl border border-paper-line bg-paper-soft p-4 text-sm text-ink/60 dark:border-ink-line dark:bg-ink dark:text-paper/60">
                    No blogs have been created yet.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </article>

        <article className="rounded-3xl border border-gold-300 bg-paper-surface p-6 dark:border-gold-400/30 dark:bg-ink-surface">
          <p className="text-xs uppercase tracking-[0.18em] text-gold-700">
            Quick actions
          </p>

          <h2 className="mt-2 font-display text-2xl tracking-tightest">
            Manage the platform.
          </h2>

          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/admin/cbt-payments` as Route}
              className="flex items-center gap-3 rounded-2xl border border-paper-line bg-paper p-4 transition hover:bg-gold-metal-soft dark:border-ink-line dark:bg-ink"
            >
              <CreditCard className="h-5 w-5 text-gold-600 dark:text-gold-300" />

              <div>
                <p className="text-sm font-semibold">
                  CBT payments
                </p>

                <p className="text-xs text-ink/55 dark:text-paper/55">
                  Review claims and approve course access
                </p>
              </div>
            </Link>

            <Link
              href="/admin/courses"
              className="flex items-center gap-3 rounded-2xl border border-paper-line bg-paper p-4 transition hover:bg-gold-metal-soft dark:border-ink-line dark:bg-ink"
            >
              <BookOpen className="h-5 w-5 text-gold-600 dark:text-gold-300" />

              <div>
                <p className="text-sm font-semibold">
                  Undergraduate courses
                </p>

                <p className="text-xs text-ink/55 dark:text-paper/55">
                  Manage courses, offerings, and pricing
                </p>
              </div>
            </Link>

            <Link
              href="/admin/questions"
              className="flex items-center gap-3 rounded-2xl border border-paper-line bg-paper p-4 transition hover:bg-gold-metal-soft dark:border-ink-line dark:bg-ink"
            >
              <FileQuestion className="h-5 w-5 text-gold-600 dark:text-gold-300" />

              <div>
                <p className="text-sm font-semibold">
                  Aspirant questions
                </p>

                <p className="text-xs text-ink/55 dark:text-paper/55">
                  Manage question batches and CBT content
                </p>
              </div>
            </Link>

            <Link
              href="/admin/blogs"
              className="flex items-center gap-3 rounded-2xl border border-paper-line bg-paper p-4 transition hover:bg-gold-metal-soft dark:border-ink-line dark:bg-ink"
            >
              <PenLine className="h-5 w-5 text-gold-600 dark:text-gold-300" />

              <div>
                <p className="text-sm font-semibold">
                  Blog posts
                </p>

                <p className="text-xs text-ink/55 dark:text-paper/55">
                  Publish stories and institutional insight
                </p>
              </div>
            </Link>
          </div>

          <p className="mt-6 text-sm leading-6 text-ink/60 dark:text-paper/60">
            The dashboard should make the next good decision obvious:
            what needs publishing, what needs review, and what has
            already reached the people who need it.
          </p>
        </article>
      </section>
    </div>
  );
}