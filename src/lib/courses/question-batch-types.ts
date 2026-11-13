import { DraftQuestion } from "../questions/batch-schema";
export type CourseBatchStatus =
  | "pending"
  | "reviewing"
  | "approved"
  | "rejected";

export interface CourseBatchParent {
  id: string;
  college_name: string;
  course_code: string;
  course_title: string;
  status: "draft" | "published" | "archived";
}

export interface CourseQuestionBatch {
  id: string;
  title: string;

  course_id: string;
  course_code: string;
  course_title: string;
  college_name: string;

  exam_year: string | null;
  status: CourseBatchStatus;

  question_count: number;
  missing_answer_count: number;
  warning_question_count: number;

  created_at: string;
  updated_at: string;
}

export interface CourseBatchListResponse {
  course: CourseBatchParent;
  batches: CourseQuestionBatch[];
  total_batches: number;
  page: number;
  page_size: number;

  limits: {
    max_file_bytes: number;
    max_extracted_characters: number;
    max_questions: number;
  };
}

export interface CourseBatchCreatedResponse {
  success: boolean;
  course_id: string;
  batch_id: string;
  status: "pending";
  extraction_status: "not_started";
  message: string;
}

export type CourseBatchSavedResponse = {
  batch_id: string;
  status: "reviewing";
  question_count: number;
  updated_at: string;
};

export type CourseBatchWorkspace = {
  batch: {
    id: string;
    course_id: string;
    title: string;
    exam_year: number | null;
    status: "pending" | "reviewing" | "approved" | "archived";
    original_filename: string;
    raw_text: string;
    extraction_warnings: string[];
    question_count: number;
    updated_at: string;
  };

  course: {
    id: string;
    course_code: string;
    course_title: string;
    college_name: string;
    status: "draft" | "active" | "archived";
  };
questions : {
  questions: DraftQuestion[];
}

  editable: boolean;

  source_url: string | null;
  source_warning: string | null;
};