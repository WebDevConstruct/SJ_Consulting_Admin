export type ImportStatus =
  | "awaiting_documents"
  | "processing"
  | "needs_review"
  | "published"
  | "failed"
  | "archived";

export type DocumentType =
  | "admission_requirements"
  | "cutoff_marks";

export type DocumentProcessingStatus =
  | "uploaded"
  | "extracting_text"
  | "extracting_records"
  | "completed"
  | "failed";

export type RequirementSourceStatus =
  | "official_current_session"
  | "official_previous_session"
  | "carried_forward"
  | "inferred_from_cognate_programme"
  | "admin_verified";

export type ReviewStatus =
  | "draft"
  | "needs_review"
  | "approved"
  | "rejected";

export interface Institution {
  id: string;
  name: string;
  short_name: string | null;
}

export interface AcademicSession {
  id: string;
  label: string;
  start_year: number;
  end_year: number;
}

export interface AdmissionImport {
  id: string;
  institution_id: string;
  session_id: string;
  status: ImportStatus;
  created_at: string;
  updated_at: string;
  institutions?: Institution;
  academic_sessions?: AcademicSession;
}

export interface AdmissionImportDocument {
  id: string;
  import_id: string;
  document_type: DocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number | null;
  processing_status: DocumentProcessingStatus;
  extraction_error: string | null;
  created_at: string;
}

export interface UtmeRuleGroup {
  type: "choose_from" | "choose_from_category";
  count: number;
  subjects?: string[];
  categories?: string[];
}

export interface UtmeRule {
  required: string[];
  groups: UtmeRuleGroup[];
}

export interface ProgrammeSessionRequirement {
  id: string;
  institution_id: string;
  session_id: string;
  college_name: string | null;
  faculty_name: string;
  department_name: string;
  programme_slug: string;
  programme_name: string;
  degree: string | null;
  duration_years: number | null;
  track: "science" | "commercial" | "arts" | null;
  utme_subjects_text: string;
  utme_rule: UtmeRule;
  requirements_source_status: RequirementSourceStatus;
  requirements_confidence: number | null;
  review_status: ReviewStatus;
  is_published: boolean;
  special_notes: string | null;
}

export interface AdmissionCutoffCategory {
  id: string;
  code: string;
  label: string;
  category_type: "merit" | "catchment_state" | "other";
  sort_order: number;
}

export interface ProgrammeSessionCutoff {
  id: string;
  programme_session_requirement_id: string;
  cutoff_category_id: string;
  score: number;
  review_status: ReviewStatus;
  is_published: boolean;
  admission_cutoff_categories?: AdmissionCutoffCategory;
}