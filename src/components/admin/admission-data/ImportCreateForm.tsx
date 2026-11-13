"use client";

import { useState } from "react";
import { getOrCreateImport } from "@/lib/admission-data/admission-data-service/admission-data-service";
import type {
  AcademicSession,
  AdmissionImport,
  Institution,
} from "@/lib/admission-data/type";

interface ImportCreateFormProps {
  institutions: Institution[];
  sessions: AcademicSession[];
  activeImport: AdmissionImport | null;
  onImportCreated: (importRecord: AdmissionImport) => void;
}

export default function ImportCreateForm({
  institutions,
  sessions,
  activeImport,
  onImportCreated,
}: ImportCreateFormProps) {
  const [institutionId, setInstitutionId] = useState(
    activeImport?.institution_id ?? "",
  );
  const [sessionId, setSessionId] = useState(
    activeImport?.session_id ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!institutionId || !sessionId) {
      setFormError("Select both an institution and an academic session.");
      return;
    }

    setIsSubmitting(true);

    try {
      const importRecord = await getOrCreateImport(
        institutionId,
        sessionId,
      );

      onImportCreated(importRecord);
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create or load the admission import.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
        Create or open admission import
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Institution
          </span>

          <select
            value={institutionId}
            onChange={(event) => setInstitutionId(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">Select institution</option>

            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Academic session
          </span>

          <select
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">Select session</option>

            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {formError ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {isSubmitting ? "Loading…" : "Open admission data"}
      </button>
    </form>
  );
}