"use client";

import { useState } from "react";
import { publishImport } from "@/lib/admission-data/admission-data-service/admission-data-service";

interface PublishImportButtonProps {
  importId: string;
  isPublished: boolean;
  onPublished: () => void;
}

export default function PublishImportButton({
  importId,
  isPublished,
  onPublished,
}: PublishImportButtonProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function handlePublish() {
    const confirmed = window.confirm(
      "Publish this admission session? Published records will become available to the student eligibility engine.",
    );

    if (!confirmed) return;

    setIsPublishing(true);
    setPublishError(null);

    try {
      await publishImport(importId);
      onPublished();
    } catch (publishActionError) {
      setPublishError(
        publishActionError instanceof Error
          ? publishActionError.message
          : "Unable to publish this admission session.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  if (isPublished) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        This admission session has been published.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
        Publish admission session
      </h2>

      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        All programme requirements and cut-off records must be approved before
        publishing.
      </p>

      {publishError ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {publishError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handlePublish()}
        disabled={isPublishing}
        className="mt-4 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPublishing ? "Publishing…" : "Publish 2026/2027 data"}
      </button>
    </div>
  );
}