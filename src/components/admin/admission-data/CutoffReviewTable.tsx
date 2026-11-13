"use client";

import { useMemo, useState } from "react";
import { updateCutoffReviewStatus } from "@/lib/admission-data/admission-data-service/admission-data-service";
import type {
  AdmissionCutoffCategory,
  ProgrammeSessionCutoff,
  ProgrammeSessionRequirement,
} from "@/lib/admission-data/type";

interface CutoffReviewTableProps {
  requirements: ProgrammeSessionRequirement[];
  cutoffs: ProgrammeSessionCutoff[];
  categories: AdmissionCutoffCategory[];
  onReviewChanged: () => void;
}

export default function CutoffReviewTable({
  requirements,
  cutoffs,
  categories,
  onReviewChanged,
}: CutoffReviewTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);

  const cutoffsByRequirement = useMemo(() => {
    const grouped = new Map<string, ProgrammeSessionCutoff[]>();

    for (const cutoff of cutoffs) {
      const current = grouped.get(
        cutoff.programme_session_requirement_id,
      );

      grouped.set(
        cutoff.programme_session_requirement_id,
        current ? [...current, cutoff] : [cutoff],
      );
    }

    return grouped;
  }, [cutoffs]);

  async function handleReview(
    cutoffId: string,
    status: "approved" | "rejected",
  ) {
    setUpdatingId(cutoffId);
    setTableError(null);

    try {
      await updateCutoffReviewStatus(cutoffId, status);
      onReviewChanged();
    } catch (reviewError) {
      setTableError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to update cut-off review status.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
        Merit and catchment cut-offs
      </h2>

      {requirements.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No programme cut-off records are available yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-3">Programme</th>
                <th className="px-3 py-3">Merit</th>
                <th className="px-3 py-3">Ekiti</th>
                <th className="px-3 py-3">Lagos</th>
                <th className="px-3 py-3">Ogun</th>
                <th className="px-3 py-3">Ondo</th>
                <th className="px-3 py-3">Osun</th>
                <th className="px-3 py-3">Oyo</th>
                <th className="px-3 py-3">Review</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {requirements.map((requirement) => {
                const programmeCutoffs =
                  cutoffsByRequirement.get(requirement.id) ?? [];

                const cutoffByCode = new Map(
                  programmeCutoffs.map((cutoff) => [
                    cutoff.admission_cutoff_categories?.code ?? "",
                    cutoff,
                  ]),
                );

                return (
                  <tr key={requirement.id}>
                    <td className="px-3 py-4 font-medium text-neutral-900 dark:text-white">
                      {requirement.programme_name}
                    </td>

                    {[
                      "merit",
                      "catchment_ekiti",
                      "catchment_lagos",
                      "catchment_ogun",
                      "catchment_ondo",
                      "catchment_osun",
                      "catchment_oyo",
                    ].map((code) => {
                      const cutoff = cutoffByCode.get(code);

                      return (
                        <td
                          key={code}
                          className="px-3 py-4 text-neutral-700 dark:text-neutral-300"
                        >
                          {cutoff ? cutoff.score.toFixed(3) : "—"}
                        </td>
                      );
                    })}

                    <td className="px-3 py-4">
                      <div className="flex flex-col gap-2">
                        {programmeCutoffs.map((cutoff) => (
                          <div
                            key={cutoff.id}
                            className="flex items-center gap-2"
                          >
                            <span className="text-xs text-neutral-500 dark:text-neutral-400">
                              {cutoff.admission_cutoff_categories?.label}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                void handleReview(cutoff.id, "approved")
                              }
                              disabled={updatingId === cutoff.id}
                              className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void handleReview(cutoff.id, "rejected")
                              }
                              disabled={updatingId === cutoff.id}
                              className="rounded bg-red-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
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