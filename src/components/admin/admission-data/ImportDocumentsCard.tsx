"use client";

import { useRef, useState } from "react";
import {
  triggerDocumentExtraction,
  uploadAdmissionDocument,
} from "@/lib/admission-data/admission-data-service/admission-data-service";
import type { AdmissionImportDocument } from "@/lib/admission-data/type";
import {createClient} from "@lib/supabase/client";

interface ImportDocumentsCardProps {
  importId: string;
  documents: AdmissionImportDocument[];
  onDocumentsChanged: () => void;
}

type DocumentType =
  | "admission_requirements"
  | "cutoff_marks";

const DOCUMENT_LABELS: Record<DocumentType, string> = {
  admission_requirements: "Admission requirements",
  cutoff_marks: "Merit and catchment cut-offs",
};

export default function ImportDocumentsCard({
  importId,
  documents,
  onDocumentsChanged,
}: ImportDocumentsCardProps) {
  const requirementsInputRef =
    useRef<HTMLInputElement>(null);
  const cutoffInputRef = useRef<HTMLInputElement>(null);

 
  const [processingType, setProcessingType] =
    useState<DocumentType | null>(null);
  const [actionError, setActionError] = useState<
    string | null
  >(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const documentByType = new Map(
    documents.map((document) => [
      document.document_type,
      document,
    ]),
  );

  async function handleFileSelected(
    documentType: DocumentType,
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setProcessingType(documentType);
    setActionError(null);
    setSuccessMessage(null);

    try {
      if (file.type !== "application/pdf") {
        throw new Error(
          "Please select a PDF document.",
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error(
          "PDF must be 5MB or smaller.",
        );
      }

      await uploadAdmissionDocument(
        importId,
        documentType,
        file,
      );

      const extractionResult =
        await triggerDocumentExtraction(
          importId,
          documentType,
        );

      const result = await extractionResult.json();
      const skipped = result?.skipped ?? [];

      if (skipped.length > 0) {
        setSuccessMessage(
          `Extraction completed. ${skipped.length} record(s) need review because they could not be matched.`,
        );
      } else {
        setSuccessMessage(
          `Extraction completed. ${result.recordsCreated} record(s) created.`,
        );
      }

      onDocumentsChanged();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to upload and extract this document.",
      );
    } finally {
      setProcessingType(null);

      if (documentType === "admission_requirements") {
        if (requirementsInputRef.current) {
          requirementsInputRef.current.value = "";
        }
      } else if (cutoffInputRef.current) {
        cutoffInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-white">
        Source documents
      </h2>

      <p className="mb-5 text-sm text-neutral-600 dark:text-neutral-400">
        Upload both PDFs. They are stored in Supabase and automatically sent
        to Cloudflare for structured extraction.
      </p>

      <div className="space-y-4">
        {(
          [
            "admission_requirements",
            "cutoff_marks",
          ] as DocumentType[]
        ).map((documentType) => {
          const document = documentByType.get(
            documentType,
          );

          const inputRef =
            documentType === "admission_requirements"
              ? requirementsInputRef
              : cutoffInputRef;

          return (
            <div
              key={documentType}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">
                    {DOCUMENT_LABELS[documentType]}
                  </p>

                  {document ? (
                    <>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {document.file_name}
                      </p>

                      <span className="mt-1 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        {document.processing_status.replace(
                          /_/g,
                          " ",
                        )}
                      </span>
                    </>
                  ) : (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      No document uploaded yet.
                    </p>
                  )}
                </div>

                <div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/pdf"
                    disabled={
                      processingType === documentType
                    }
                    onChange={(event) =>
                      void handleFileSelected(
                        documentType,
                        event,
                      )
                    }
                    className="block w-full cursor-pointer rounded-lg border border-neutral-300 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white dark:border-neutral-700 dark:file:bg-white dark:file:text-neutral-900"
                  />
                </div>
              </div>

              {processingType === documentType ? (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  Uploading and extracting…
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {successMessage ? (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {successMessage}
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {actionError}
        </div>
      ) : null}
    </div>
  );
}