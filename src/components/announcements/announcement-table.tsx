// src/features/announcements/announcement-table.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getAdminAnnouncements } from "./admin-announcements";
import type {
  AnnouncementCategory,
  AnnouncementRecord,
} from "@/types/announcement";

const categories: Array<{
  value: "" | AnnouncementCategory;
  label: string;
}> = [
  { value: "", label: "All categories" },
  { value: "mentorship", label: "Mentorship" },
  { value: "unilag", label: "College / UNILAG" },
  { value: "jamb", label: "Exam body / JAMB" },
  { value: "accommodation", label: "Accommodation" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function AnnouncementTable() {
  const [announcements, setAnnouncements] = useState<
    AnnouncementRecord[]
  >([]);
  const [category, setCategory] = useState<
    "" | AnnouncementCategory
  >("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getAdminAnnouncements(
        category || undefined,
      );

      setAnnouncements(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load announcements.",
      );
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  return (
    <section className="rounded-3xl border border-paper-line bg-paper dark:border-ink-line dark:bg-ink-surface">
      <div className="flex flex-col gap-4 border-b border-paper-line p-5 sm:flex-row sm:items-center sm:justify-between dark:border-ink-line">
        <div>
          <h2 className="font-display text-2xl">
            Announcement register
          </h2>
          <p className="mt-1 text-sm text-black/45 dark:text-white/45">
            Manage customer-facing information and drafts.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value as "" | AnnouncementCategory,
              )
            }
            className="rounded-xl border border-paper-line bg-paper-soft px-3 py-2 text-sm outline-none focus:border-gold-400 dark:border-ink-line dark:bg-ink"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadAnnouncements()}
            className="rounded-xl border border-paper-line px-3 py-2 text-sm dark:border-ink-line"
          >
            Refresh
          </button>

          <Link
            href="/admin/information/new"
            className="rounded-xl bg-gold-metal px-3 py-2 text-sm font-semibold text-ink"
          >
            New information
          </Link>
        </div>
      </div>

      <div className="p-5">
        {loading && (
          <div className="rounded-2xl bg-paper-soft p-10 text-center text-sm text-black/50 dark:bg-ink dark:text-white/50">
            Loading announcements…
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadAnnouncements()}
              className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-white"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && announcements.length === 0 && (
          <div className="rounded-2xl border border-dashed border-paper-line bg-paper-soft p-10 text-center dark:border-ink-line dark:bg-ink">
            <p className="font-display text-2xl">
              No announcements found.
            </p>
            <p className="mt-2 text-sm text-black/45 dark:text-white/45">
              Create your first announcement or change the category filter.
            </p>
          </div>
        )}

        {!loading && !error && announcements.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-paper-line text-xs uppercase tracking-[.12em] text-black/45 dark:border-ink-line dark:text-white/45">
                <tr>
                  <th className="px-3 py-3 font-medium">Title</th>
                  <th className="px-3 py-3 font-medium">Category</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {announcements.map((announcement) => (
                  <tr
                    key={announcement.id}
                    className="border-b border-paper-line last:border-0 dark:border-ink-line"
                  >
                    <td className="px-3 py-4">
                      <p className="font-medium">
                        {announcement.title}
                      </p>
                      <p className="mt-1 max-w-sm truncate text-xs text-black/45 dark:text-white/45">
                        {announcement.subtext}
                      </p>
                    </td>

                    <td className="px-3 py-4 capitalize">
                      {announcement.category}
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={
                          announcement.is_published
                            ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700"
                            : "rounded-full bg-gold-100 px-3 py-1 text-xs font-medium text-gold-700"
                        }
                      >
                        {announcement.is_published
                          ? "Published"
                          : "Draft"}
                      </span>
                    </td>

                    <td className="px-3 py-4 text-black/50 dark:text-white/50">
                      {formatDate(announcement?.created_at || "")}
                    </td>

                    <td className="px-3 py-4">
                      <Link
                        className="text-sm font-semibold text-gold-700 hover:underline"
                        href={`/admin/information/${announcement.id}/edit`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}