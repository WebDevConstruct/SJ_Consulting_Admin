import Link from "next/link";
import { AnnouncementTable } from "@/components/announcements/announcement-table";

export default function InformationPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-gold-600">
            Content operations
          </p>

          <h1 className="mt-2 font-display text-5xl tracking-tightest">
            Information
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55 dark:text-white/55">
            Create, review, publish, update, and retire the information
            that powers the customer-facing experience.
          </p>
        </div>

        <Link
          href="/admin/information/new"
          className="rounded-full bg-gold-metal px-5 py-3 text-sm font-semibold text-ink"
        >
          New information
        </Link>
      </section>

      <AnnouncementTable />
    </div>
  );
}