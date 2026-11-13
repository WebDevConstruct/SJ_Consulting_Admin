"use client";

import { useState } from "react";
import { updateRequirementReviewStatus } from "@/lib/admission-data/admission-data-service/admission-data-service";
import type { ProgrammeSessionRequirement } from "@/lib/admission-data/type";

interface RequirementsReviewTableProps {
  requirements: ProgrammeSessionRequirement[];
  onReviewChanged: () => void;
}

const SOURCE_STATUS_LABELS = {
  official_current_session: "Official — current session",
  official_previous_session: "Official — previous session",
  carried_forward: "Carried forward",
  inferred_from_cognate_programme: "Inferred from cognate programme",
  admin_verified: "Admin verified",
} as const;

export default function RequirementsReviewTable({
  requirements,
  onReviewChanged,
}: RequirementsReviewTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  async function handleReview(
    requirementId: string,
    status: "approved" | "rejected",
  ) {
    setUpdatingId(requirementId);
    setTableError(null);

    try {
      await updateRequirementReviewStatus(requirementId, status);
      onReviewChanged();
    } catch (reviewError) {
      setTableError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to update requirement review status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
        Programme requirements
      </h2>

      {requirements.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No extracted programme requirements are available yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-3">Programme</th>
                <th className="px-3 py-3">Faculty</th>
                <th className="px-3 py-3">UTME requirement</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Review</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {requirements.map((requirement) => (
                <tr key={requirement.id}>
                  <td className="px-3 py-4">
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {requirement.programme_name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {requirement.degree ?? "—"} ·{" "}
                      {requirement.duration_years ?? "—"} years
                    </p>
                  </td>

                  <td className="px-3 py-4 text-neutral-700 dark:text-neutral-300">
                    {requirement.faculty_name}
                  </td>

                  <td className="max-w-sm px-3 py-4 text-neutral-700 dark:text-neutral-300">
                    {requirement.utme_subjects_text}
                  </td>

                  <td className="px-3 py-4">
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      {
                        SOURCE_STATUS_LABELS[
                          requirement.requirements_source_status
                        ]
                      }
                    </span>
                  </td>

                  <td className="px-3 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        requirement.review_status === "approved"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : requirement.review_status === "rejected"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {requirement.review_status.replace(/_/g, " ")}
                    </span>
                  </td>

                  <td className="px-3 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void handleReview(requirement.id, "approved")
                        }
                        disabled={updatingId === requirement.id}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleReview(requirement.id, "rejected")
                        }
                        disabled={updatingId === requirement.id}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tableError ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">
          {tableError}
        </p>
      ) : null}
    </section>
  );
}