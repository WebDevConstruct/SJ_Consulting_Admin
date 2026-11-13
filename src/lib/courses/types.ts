export type CourseStatus = "draft" | "published" | "archived";

export interface CourseOffering {
  id: string;
  course_id: string;
  faculty_name: string;
  department_name: string;
  level: string;
  academic_session_label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  college_name: string;
  course_code: string;
  course_title: string;
  short_description: string;
  objective: string;
  status: CourseStatus;
  price_amount: number | null;
  price_currency: "NGN" | "USD";
  original_price_amount: number | null;
  pricing_note: string | null;
  offerings: CourseOffering[];
}

export interface CourseListResponse {
  items: Course[];
  total: number;
  limit: number;
  offset: number;
}