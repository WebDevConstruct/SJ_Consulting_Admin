"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  AdmissionImport,
  AdmissionImportDocument,
  AdmissionCutoffCategory,
  ProgrammeSessionCutoff,
  ProgrammeSessionRequirement,
} from "@lib/admission-data/type";

const supabase = createClient()
export async function getInstitutions() {
    
  const { data, error } = await supabase
    .from("institutions")
    .select("id, name, short_name")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data;
}

export async function getAcademicSessions() {
  const { data, error } = await supabase
    .from("academic_sessions")
    .select("id, label, start_year, end_year")
    .order("start_year", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getOrCreateImport(
  institutionId: string,
  sessionId: string,
) {

  const existing = await supabase
    .from("admission_data_imports")
    .select("*")
    .eq("institution_id", institutionId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data) {
    return existing.data as AdmissionImport;
  }
const {data : UserData, error : userError} = await supabase?.auth?.getUser()


  const { data, error } = await supabase
    .from("admission_data_imports")
    .insert({
      institution_id: institutionId,
      session_id: sessionId,
      status: "awaiting_documents",
      created_by : UserData?.user?.id || ""
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as AdmissionImport;
}

export async function getImportDocuments(importId: string) {
  const { data, error } = await supabase
    .from("admission_import_documents")
    .select("*")
    .eq("import_id", importId)
    .order("document_type");

  if (error) throw error;
  return data as AdmissionImportDocument[];
}

export async function getRequirements(importId: string) {
  const { data, error } = await supabase
    .from("programme_session_requirements")
    .select("*")
    .eq("import_id", importId)
    .order("faculty_name")
    .order("department_name");

  if (error) throw error;
  return data as ProgrammeSessionRequirement[];
}

export async function getCutoffCategories() {
  const { data, error } = await supabase
    .from("admission_cutoff_categories")
    .select("id, code, label, category_type, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;
  return data as AdmissionCutoffCategory[];
}

export async function getCutoffs(importId: string) {
  const { data, error } = await supabase
.from("programme_session_cutoffs")
    .select(
      `
      id,
      programme_session_requirement_id,
      cutoff_category_id,
      score,
      review_status,
      is_published,
      admission_cutoff_categories (
        id,
        code,
        label,
        category_type,
        sort_order
      )
    `
    )
    .eq("import_id", importId);

  if (error) throw error;
  return data as unknown as ProgrammeSessionCutoff[];
}

export async function updateRequirementReviewStatus(
  requirementId: string,
  reviewStatus: "approved" | "rejected" | "needs_review",
) {
  const { error } = await supabase
    .from("programme_session_requirements")
    .update({
      review_status: reviewStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requirementId);

  if (error) throw error;
}

export async function updateCutoffReviewStatus(
  cutoffId: string,
  reviewStatus: "approved" | "rejected" | "needs_review",
) {
  const { error } = await supabase
    .from("programme_session_cutoffs")
    .update({
      review_status: reviewStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cutoffId);

  if (error) throw error;
}

// UPLOADING OF DOCUMENTS BY THE ADMIN
export async function uploadAdmissionDocument(
  importId: string,
  documentType: "admission_requirements" | "cutoff_marks",
  file: File,
 
) {
  const fileExtension = file.name.split(".").pop();
 const {data, error} =  await supabase?.auth?.getUser()
  const storagePath = `${importId}/${documentType}.${fileExtension}`;
console.log("File TYpe", file);
  const { data: uploadData, error: uploadError } =
    await supabase.storage
      .from("admission-documents")
      .upload(storagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

  if (uploadError) {
    alert(uploadError);
    throw uploadError;
  }

  const { data: documentData, error: documentError } =
    await supabase
      .from("admission_import_documents")
      .upsert(
        {
          import_id: importId,
          document_type: documentType,
          file_name: file.name,
          storage_bucket: "admission-documents",
          storage_path: storagePath,
          mime_type: file.type,
          file_size_bytes: file.size,
          processing_status: "uploaded",
          created_by : data?.user?.id || ""
        },
        {
          onConflict: "import_id,document_type",
        },
      )
      .select("*")
      .single();
console.log(data?.user?.id);
  if (documentError) {
    throw documentError;
  }

  return {
    upload: uploadData,
    document: documentData,
  };
}

export async function publishImport(importId: string) {
  const { data: requirements, error: requirementsError } = await supabase
    .from("programme_session_requirements")
    .select("id, review_status")
    .eq("import_id", importId);

  if (requirementsError) throw requirementsError;

  const unapprovedRequirements =
    requirements?.filter((item) => item.review_status !== "approved") ?? [];

  if (unapprovedRequirements.length > 0) {
    throw new Error(
      `${unapprovedRequirements.length} programme requirement(s) still need approval.`,
    );
  }

  const { data: cutoffs, error: cutoffsError } = await supabase
    .from("programme_session_cutoffs")
    .select("id, review_status")
    .eq("import_id", importId);

  if (cutoffsError) throw cutoffsError;

  const unapprovedCutoffs =
    cutoffs?.filter((item) => item.review_status !== "approved") ?? [];

  if (unapprovedCutoffs.length > 0) {
    throw new Error(
      `${unapprovedCutoffs.length} cut-off record(s) still need approval.`,
    );
  }

  const { error: requirementPublishError } = await supabase
    .from("programme_session_requirements")
    .update({
      is_published: true,
      review_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("import_id", importId);

  if (requirementPublishError) throw requirementPublishError;

  const { error: cutoffPublishError } = await supabase
    .from("programme_session_cutoffs")
    .update({
      is_published: true,
      review_status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("import_id", importId);

  if (cutoffPublishError) throw cutoffPublishError;

  const { error: importPublishError } = await supabase
    .from("admission_data_imports")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", importId);

  if (importPublishError) throw importPublishError;
}

export async function triggerDocumentExtraction(
  importId: string,
  documentType: "admission_requirements" | "cutoff_marks",
) {
    const session = (await supabase.auth.getSession()).data.session;
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-content`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        resource : "admission_data",
        action : "extract",
        importId,
        documentType,
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    alert(message)
    throw new Error(message || "Failed to start document extraction.");
  }

  return response.json();
}