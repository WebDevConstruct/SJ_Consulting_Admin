'use client';

import { useState } from 'react';
import { createClient } from '@lib/supabase/client';
import { extractText } from 'unpdf';
import { Upload, Loader2, CheckCircle, Trash2, Save } from 'lucide-react';



const supabase = createClient()

const SUBJECT_COMBINATION_SUBJECTS = [
  { id: 0, subject: "English Language" },
  { id: 1, subject: "Mathematics" },
  { id: 2, subject: "Further Mathematics" },
  { id: 3, subject: "Physics" },
  { id: 4, subject: "Chemistry" },
  { id: 5, subject: "Biology" },
  { id: 6, subject: "Economics" },
  { id: 7, subject: "Government" },
  { id: 8, subject: "Geography" },
  { id: 9, subject: "History" },
  { id: 10, subject: "Literature-in-English" },
  { id: 11, subject: "CRS/IRS" },
  { id: 12, subject: "French" },
  { id: 13, subject: "Agricultural Science" },
  { id: 14, subject: "Commerce" },
  { id: 15, subject: "Financial Accounting" },
  { id: 16, subject: "Fine Arts" },
  { id: 17, subject: "Technical Drawing" },
  { id: 18, subject: "Igbo" },
  { id: 19, subject: "Yoruba" },
  { id: 20, subject: "Arabic" },
  { id: 21, subject: "Civic Education" },
  { id: 22, subject: "Data Processing/Computer Studies" },
  { id: 23, subject: "Music" },
  { id: 24, subject: "Business Management/Studies" },
  { id: 25, subject: "Nigerian Language" }
];



export const DocumentUploadWithReview =()=>  {

    
  const [selectedSubject, setSelectedSubject] = useState(SUBJECT_COMBINATION_SUBJECTS[1].subject);
  const [examYear, setExamYear] = useState('2025');
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<any[] | null>(null);
  const [isReviewedApproved, setIsReviewedApproved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [currentImportId, setCurrentImportId] =
  useState<string | null>(null);

const [sourceText, setSourceText] = useState("");
const [importWarnings, setImportWarnings] =
  useState<string[]>([]);

  // 1. Extract text locally and call the Supabase Edge Function
  const handleUploadAndExtract = async (e: React.FormEvent) => {
    
 if (!file) {
  alert("Please select a file.");
  return;
}

setLoading(true);
setSuccessMessage("");
setIsReviewedApproved(false);

try {
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error("Please sign in again.");
  }

  if (authData.user.app_metadata?.role !== "admin") {
    throw new Error("Admin access is required.");
  }

  if (!selectedSubject || !examYear) {
    throw new Error("Select a subject and year.");
  }

  const filename = file.name.toLowerCase();
  let textContent = "";

  if (filename.endsWith(".txt")) {
    textContent = await file.text();
  } else if (filename.endsWith(".pdf")) {
    const bytes = new Uint8Array(await file.arrayBuffer());

    const pdfData = await extractText(bytes, {
      mergePages: false,
    });

    textContent = Array.isArray(pdfData.text)
      ? pdfData.text
          .map(
            (pageText, index) =>
              `--- PAGE ${index + 1} ---\n${pageText}`,
          )
          .join("\n\n")
      : pdfData.text;
  } else {
    throw new Error("Upload a .txt or text-based .pdf file.");
  }

  if (!textContent.trim()) {
    throw new Error(
      "No readable text was found. Scanned PDFs are unsupported.",
    );
  }

  const importId = crypto.randomUUID();
  const extension = filename.endsWith(".pdf") ? "pdf" : "txt";
  const storagePath =
    `${authData.user.id}/${importId}/source.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("question-documents")
    .upload(storagePath, file, {
      upsert: false,
      contentType:
        extension === "pdf"
          ? "application/pdf"
          : "text/plain",
    });

  if (uploadError) throw uploadError;

  const { error: importError } = await supabase
    .from("question_imports")
    .insert({
      id: importId,
      subject_id: selectedSubject,
      exam_year: String(examYear),
      storage_path: storagePath,
      uploaded_by: authData.user.id,
      status: "pending",
      raw_text: textContent,
    });

  if (importError) {
    throw new Error(
      "The file was uploaded, but its import record could not be saved. " +
      importError.message,
    );
  }

  setCurrentImportId(importId);
  setSourceText(textContent);

  const {
    data: extraction,
    error: extractionError,
  } = await supabase.functions.invoke("extract-Json-from-pdf", {
    body: {
      textContent,
      subject: selectedSubject,
      year: Number(examYear),
    },
  });

  if (extractionError) throw extractionError;

  if (!extraction?.success) {
    throw new Error(
      extraction?.error || "Question extraction failed.",
    );
  }

  if (!Array.isArray(extraction.questions)) {
    throw new Error("Extraction response has no question array.");
  }

  const { error: draftError } = await supabase
    .from("question_imports")
    .update({
      status: "reviewing",
      draft_payload: {
        questions: extraction.questions,
      },
      extraction_method: extraction.extraction_method,
      extraction_warnings: extraction.warnings ?? [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", importId);

  if (draftError) throw draftError;

  setExtractedData(extraction.questions);
  setImportWarnings(extraction.warnings ?? []);

  if (extraction.requires_manual_entry) {
    alert(
      "Automatic extraction could not identify questions. " +
      "The source is saved and available for manual review.",
    );
  }
} catch (error: unknown) {
  console.error(error);

  alert(
    error instanceof Error
      ? error.message
      : "Document extraction failed.",
  );
} finally {
  setLoading(false);
}
};

  const handleQuestionChange = (
  index: number,
  field: string,
  value: unknown,
) => {
  if (!extractedData) return;

  const updated = [...extractedData];
  updated[index] = {
    ...updated[index],
    [field]: value,
  };

  setExtractedData(updated);
  setIsReviewedApproved(false);
};

const handleDeleteQuestion = (index: number) => {
  if (!extractedData) return;

  setExtractedData(
    extractedData.filter((_, i) => i !== index),
  );

  setIsReviewedApproved(false);
};




  // 2. Final Approval and Bulk Insertion to Supabase Table
  const handleFinalPublish = async () => {
    const {data , error} = await supabase.auth.getUser()
    if (!isReviewedApproved) {
      alert('Please confirm the review status before publishing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        reviewed: true,
        subject: selectedSubject,
        year: Number(examYear),
        questions: extractedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: data?.user?.id,
      };

      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to insert into database');

      setSuccessMessage(result.message);
      setExtractedData(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`max-w-4xl mx-auto p-6 bg-white dark:bg-dark-card border border-light-border
         dark:border-dark-border rounded-2xl shadow-xl space-y-8`}>
      <div className="border-b border-light-border dark:border-dark-border pb-4">
        <h2 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">
          Admin Question Import & Review Workflow
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Select subject, specify exam year, upload document, and process via Supabase Edge Function.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
          <CheckCircle className="w-5 h-5" /> {successMessage}
        </div>
      )}

      {/* Upload Form */}
      {!extractedData && (
        <form onSubmit={handleUploadAndExtract} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Select Subject
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-dark-bg border border-light-border dark:border-dark-border text-xs font-semibold text-slate-900 dark:text-white cursor-pointer"
              >
                {SUBJECT_COMBINATION_SUBJECTS.map((sub) => (
                  <option key={sub.id} value={sub.subject}>
                    {sub.subject}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Exam Year (e.g. 2025)
              </label>
              <input
                type="text"
                value={examYear}
                onChange={(e) => setExamYear(e.target.value)}
                placeholder="2025"
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-dark-bg border border-light-border dark:border-dark-border text-xs font-semibold text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Upload Document (.txt or text-based .pdf)
            </label>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-dark-bg border border-light-border dark:border-dark-border text-xs file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-gold-500/10 file:text-gold-500 cursor-pointer"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gold-500 text-dark-bg font-semibold text-xs flex items-center justify-center gap-2 hover:brightness-110 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? 'Processing via Edge Function...' : 'Extract Questions via Edge Function'}
          </button>
        </form>
      )}

      {/* Review Editor */}
      {extractedData && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gold-500/10 p-4 rounded-xl border border-gold-500/30">
            <div>
              <span className="text-xs font-bold text-gold-600 dark:text-gold-400 uppercase tracking-wider">
                Reviewing Batch: {selectedSubject} ({examYear})
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Total Extracted: {extractedData.length} questions.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white dark:bg-dark-card p-3 rounded-lg border border-light-border dark:border-dark-border shadow-sm">
              <input
                type="checkbox"
                id="review-approval-toggle"
                checked={isReviewedApproved}
                onChange={(e) => setIsReviewedApproved(e.target.checked)}
                className="w-4 h-4 accent-gold-500 cursor-pointer"
              />
              <label htmlFor="review-approval-toggle" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                Review & Approved (True)
              </label>
            </div>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {extractedData.map((q, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-dark-bg border border-light-border dark:border-dark-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gold-500">
                    Question #{q.question_number}
                  </span>
                  <button
                    onClick={() => handleDeleteQuestion(idx)}
                    className="text-red-500 hover:text-red-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <textarea
                  value={q.question_text}
                  onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-dark-card border border-light-border dark:border-dark-border text-xs font-medium"
                  rows={2}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {q.options?.map((opt: any, optIdx: number) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <span className="w-5 font-bold text-xs text-gold-500">{opt.label}:</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const newOpts = [...q.options];
                          newOpts[optIdx].text = e.target.value;
                          handleQuestionChange(idx, 'options', newOpts);
                        }}
                        className="flex-grow p-1.5 rounded-lg bg-white dark:bg-dark-card border border-light-border dark:border-dark-border text-xs"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Correct Option</label>
                    <input
                      type="text"
                      value={q.correct_option || ''}
                      onChange={(e) => handleQuestionChange(idx, 'correct_option', e.target.value)}
                      className="w-full p-2 rounded-lg bg-white dark:bg-dark-card border border-light-border dark:border-dark-border text-xs font-bold text-gold-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-1">Explanation</label>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) => handleQuestionChange(idx, 'explanation', e.target.value)}
                      className="w-full p-2 rounded-lg bg-white dark:bg-dark-card border border-light-border dark:border-dark-border text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-light-border dark:border-dark-border">
            <button
              onClick={() => setExtractedData(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-bg cursor-pointer"
            >
              Cancel / Re-upload
            </button>

            <button
              onClick={handleFinalPublish}
              disabled={!isReviewedApproved || isSubmitting}
              className={`px-8 py-3 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                isReviewedApproved && !isSubmitting
                  ? 'bg-gold-500 text-dark-bg hover:brightness-110 shadow-lg shadow-gold-500/20'
                  : 'bg-slate-300 dark:bg-dark-border text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Publishing to Supabase...' : 'Approve & Bulk Publish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}