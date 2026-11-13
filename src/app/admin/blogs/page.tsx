"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteBlog,
  getAdminBlogs,
  toggleBlogPublished,
  type AdminBlogRow,
} from "@/lib/admin-blogs";
import type { Route} from "next";

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BlogsPage() {
  const [blogs, setBlogs] = useState<AdminBlogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBlogs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const data = await getAdminBlogs();
    setBlogs(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadBlogs();
  }, [loadBlogs]);

  const stats = useMemo(() => {
    const published = blogs.filter((blog) => blog.is_published).length;
    const drafts = blogs.filter((blog) => !blog.is_published).length;
    const latest = blogs[0];

    return {
      published,
      drafts,
      latest,
    };
  }, [blogs]);

  const filteredBlogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return blogs.filter((blog) => {
      const matchesSearch =
        !query ||
        blog.title.toLowerCase().includes(query) ||
        blog.slug.toLowerCase().includes(query) ||
        (blog.admin_access?.username ?? "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "published" && blog.is_published) ||
        (statusFilter === "draft" && !blog.is_published);

      return matchesSearch && matchesStatus;
    });
  }, [blogs, search, statusFilter]);

  async function handleTogglePublish(blog: AdminBlogRow) {
    setBusyId(blog.id);
    setErrorMessage(null);

    try {
      await toggleBlogPublished(blog.id, !blog.is_published);
      await loadBlogs();
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not update the publishing status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(blog: AdminBlogRow) {
    const confirmed = window.confirm(
      `Delete “${blog.title}”? This will also remove its content blocks.`
    );

    if (!confirmed) return;

    setBusyId(blog.id);
    setErrorMessage(null);

    try {
      await deleteBlog(blog.id);
      await loadBlogs();
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not delete this blog post.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-gold-600">
            Editorial operations
          </p>
          <h1 className="mt-2 font-display text-5xl tracking-tightest">
            Blog posts
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/55">
            Create, review, publish, and manage the stories, performance
            insights, and internal perspectives shared with the SJ Consulting
            audience.
          </p>
        </div>

        <Link
          href="/admin/blogs/new"
          className="rounded-full bg-gold-metal px-5 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
        >
          New blog post
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-3xl border border-paper-line bg-paper p-5 dark:border-ink-line dark:bg-ink-surface">
          <p className="text-xs uppercase tracking-[.16em] text-black/45 dark:text-white/45">
            Published
          </p>
          <p className="mt-4 font-display text-4xl">
            {isLoading ? "—" : stats.published}
          </p>
        </article>

        <article className="rounded-3xl border border-paper-line bg-paper p-5 dark:border-ink-line dark:bg-ink-surface">
          <p className="text-xs uppercase tracking-[.16em] text-black/45 dark:text-white/45">
            Drafts
          </p>
          <p className="mt-4 font-display text-4xl">
            {isLoading ? "—" : stats.drafts}
          </p>
        </article>

        <article className="rounded-3xl border border-gold-300 bg-gold-50 p-5 dark:border-gold-700 dark:bg-gold-700">
          <p className="text-xs uppercase tracking-[.16em] text-gold-700 dark:text-gold-100">
            Latest movement
          </p>
          <p className="mt-4 font-display text-xl">
            {isLoading
              ? "Loading"
              : stats.latest
                ? `${stats.latest.title} · ${formatDate(stats.latest.updated_at)}`
                : "No posts yet"}
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-paper-line bg-paper p-6 dark:border-ink-line dark:bg-ink-surface">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl">Post register</h2>
            <p className="mt-1 text-sm text-black/50 dark:text-white/50">
              {filteredBlogs.length} of {blogs.length} posts
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, slug, or author"
              className="w-full rounded-full border border-paper-line bg-paper-soft px-4 py-2.5 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink sm:w-72"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | "published" | "draft"
                )
              }
              className="rounded-full border border-paper-line bg-paper-soft px-4 py-2.5 text-sm outline-none focus:border-gold-500 dark:border-ink-line dark:bg-ink"
            >
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6">
          {isLoading ? (
            <div className="rounded-2xl border border-dashed border-paper-line bg-paper-soft p-10 text-center dark:border-ink-line dark:bg-ink">
              <p className="font-display text-xl">Loading blog posts…</p>
            </div>
          ) : filteredBlogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-paper-line bg-paper-soft p-10 text-center dark:border-ink-line dark:bg-ink">
              <p className="font-display text-2xl">
                {blogs.length === 0
                  ? "Your editorial workspace is ready."
                  : "No posts match this filter."}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-black/45 dark:text-white/45">
                {blogs.length === 0
                  ? "Create your first blog post to begin building the SJ Consulting editorial library."
                  : "Try a different search term or publishing status."}
              </p>

              {blogs.length === 0 ? (
                <Link
                  href="/admin/blogs/new"
                  className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:opacity-90 dark:bg-gold-metal dark:text-ink"
                >
                  Create first blog post
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-[.14em] text-black/45 dark:text-white/45">
                    <th className="px-4 pb-2">Post</th>
                    <th className="px-4 pb-2">Created by</th>
                    <th className="px-4 pb-2">Status</th>
                    <th className="px-4 pb-2">Published</th>
                    <th className="px-4 pb-2">Updated</th>
                    <th className="px-4 pb-2 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBlogs.map((blog) => (
                    <tr
                      key={blog.id}
                      className="rounded-2xl bg-paper-soft dark:bg-ink"
                    >
                      <td className="rounded-l-2xl px-4 py-4">
                        <div className="flex items-center gap-3">
                          {blog.cover_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={blog.cover_image_url}
                              alt={blog.title}
                              className="h-12 w-16 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="h-12 w-16 rounded-xl bg-black/5 dark:bg-white/10" />
                          )}

                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {blog.title}
                            </p>
                            <p className="truncate text-xs text-black/45 dark:text-white/45">
                              /{blog.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-medium">
                          {blog.admin_access?.username ?? "Unknown admin"}
                        </p>
                        <p className="text-xs capitalize text-black/45 dark:text-white/45">
                          {blog.admin_access?.role ?? "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            blog.is_published
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200"
                          }`}
                        >
                          {blog.is_published ? "Published" : "Draft"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-sm">
                        {formatDate(blog.published_at)}
                      </td>

                      <td className="px-4 py-4 text-sm">
                        {formatDate(blog.updated_at)}
                      </td>

                      <td className="rounded-r-2xl px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => void handleTogglePublish(blog)}
                            disabled={busyId === blog.id}
                            className="rounded-full border border-paper-line px-3 py-1.5 text-xs font-semibold transition hover:border-gold-500 disabled:opacity-50 dark:border-ink-line"
                          >
                            {blog.is_published ? "Unpublish" : "Publish"}
                          </button>

                          <Link
                            href={`/admin/blogs/${blog.id}/edit` as Route}
                            className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper transition hover:opacity-90 dark:bg-gold-metal dark:text-ink"
                          >
                            Edit
                          </Link>

                          <button
                            onClick={() => void handleDelete(blog)}
                            disabled={busyId === blog.id}
                            className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <Link
        href="/admin/information"
        className="inline-block text-sm font-semibold text-gold-700 hover:underline dark:text-gold-300"
      >
        ← Back to information operations
      </Link>
    </div>
  );
}
