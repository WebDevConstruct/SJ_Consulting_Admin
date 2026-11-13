"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getAcademicSessions,
  getCutoffCategories,
  getCutoffs,
  getImportDocuments,
  getInstitutions,
  getRequirements,
} from "@/lib/admission-data/admission-data-service/admission-data-service";
import type {
  AcademicSession,
  AdmissionCutoffCategory,
  AdmissionImport,
  AdmissionImportDocument,
  Institution,
  ProgrammeSessionCutoff,
  ProgrammeSessionRequirement,
} from "@/lib/admission-data/type";
import ImportCreateForm from "./ImportCreateForm";
import ImportDocumentsCard from "./ImportDocumentsCard";
import RequirementsReviewTable from "./RequirementsReviewTable";
import CutoffReviewTable from "./CutoffReviewTable";
import PublishImportButton from "./PublishImportButton";

export default function AdmissionDataPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [activeImport, setActiveImport] = useState<AdmissionImport | null>(
    null,
  );
  const [documents, setDocuments] = useState<AdmissionImportDocument[]>([]);
  const [requirements, setRequirements] = useState<
    ProgrammeSessionRequirement[]
  >([]);
  const [cutoffs, setCutoffs] = useState<ProgrammeSessionCutoff[]>([]);
  const [categories, setCategories] = useState<AdmissionCutoffCategory[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadImportData = useCallback(
    async (importId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const [documentsData, requirementsData, cutoffData] =
          await Promise.all([
            getImportDocuments(importId),
            getRequirements(importId),
            getCutoffs(importId),
          ]);

        setDocuments(documentsData);
        setRequirements(requirementsData);
        setCutoffs(cutoffData);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load admission import data.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);

      try {
        const [institutionData, sessionData, categoryData] =
          await Promise.all([
            getInstitutions(),
            getAcademicSessions(),
            getCutoffCategories(),
          ]);
console.log(await getInstitutions())
        setInstitutions(institutionData);
        setSessions(sessionData);
        setCategories(categoryData);
      } catch (initialError) {
        setError(
          initialError instanceof Error
            ? initialError.message
            : "Unable to load admission data setup.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadInitialData();
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
          Admission Data
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Upload an institution’s admission-requirements document and
          merit/catchment cut-off document, review extracted records, then
          publish them for student eligibility checks.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <ImportCreateForm
        institutions={institutions}
        sessions={sessions}
        activeImport={activeImport}
        onImportCreated={(createdImport) => {
          setActiveImport(createdImport);
          void loadImportData(createdImport.id);
        }}
      />

      {activeImport ? (
        <section className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {activeImport.institutions?.name ?? "Selected institution"}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {activeImport.academic_sessions?.label} admission session
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  activeImport.status === "published"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : activeImport.status === "needs_review"
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                }`}
              >
                {activeImport.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

     <ImportDocumentsCard
  importId={activeImport.id}
  documents={documents}
  onDocumentsChanged={() =>
    void loadImportData(activeImport.id)
  }
/>
          <RequirementsReviewTable
            requirements={requirements}
            onReviewChanged={() => void loadImportData(activeImport.id)}
          />

          <CutoffReviewTable
            requirements={requirements}
            cutoffs={cutoffs}
            categories={categories}
            onReviewChanged={() => void loadImportData(activeImport.id)}
          />

          <PublishImportButton
            importId={activeImport.id}
            isPublished={activeImport.status === "published"}
            onPublished={() => void loadImportData(activeImport.id)}
          />
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          Select an institution and academic session to begin.
        </div>
      )}

      {isLoading ? (
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          Loading admission data…
        </p>
      ) : null}
    </div>
  );
}