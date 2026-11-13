import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import {
  assertSameOrigin,
  BatchHttpError,
  handleBatchError,
  jsonResponse,
  requireQuestionOwner,
} from "@/lib/question-batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const courseSchema = z.object({
  action: z.literal("save_course"),
  id: z.string().uuid().nullable(),
  college_name: z.string().trim().min(1).max(200),
  course_code: z.string().trim().min(1).max(40),
  course_title: z.string().trim().min(1).max(250),
  short_description: z.string().trim().max(250),
  objective: z.string().trim().max(5000),
  status: z.enum(["draft", "published", "archived"]),
  price_amount: z.union([
    z.coerce.number().min(0).max(99_999_999),
    z.null(),
  ]).optional(),
  price_currency: z.enum(["NGN", "USD"]).default("NGN"),
  original_price_amount: z.union([
    z.coerce.number().min(0).max(99_999_999),
    z.null(),
  ]).optional(),
  pricing_note: z.string().trim().max(300).nullable().optional(),
}).strict();
const offeringSchema = z.object({
  action: z.literal("save_offering"),
  id: z.string().uuid().nullable(),
  course_id: z.string().uuid(),
  faculty_name: z.string().trim().min(1).max(200),
  department_name: z.string().trim().min(1).max(200),
  level: z.string().trim().min(1).max(40),
  academic_session_label: z.string().trim().max(40),
  is_active: z.boolean(),
}).strict();

const saveSchema = z.discriminatedUnion("action", [
  courseSchema,
  offeringSchema,
]);

const listSchema = z.object({
  search: z.string().max(200),
  status: z.enum(["all", "draft", "published", "archived"]),
  page: z.coerce.number().int().min(1).max(100_000),
});

function throwRpcError(error: {
  code?: string;
  message: string;
}): never {
  if (error.code === "23505") {
    throw new BatchHttpError(
      409,
      "This course code or academic assignment already exists.",
    );
  }

  if (error.code === "42501") {
    throw new BatchHttpError(403, "An active owner account is required.");
  }

  if (error.code === "P0002") {
    throw new BatchHttpError(404, "The requested course or assignment was not found.");
  }

  if (
    error.code === "22023" ||
    error.code === "23514" ||
    error.code === "23502"
  ) {
    throw new BatchHttpError(
      400,
      "Check the required fields and their allowed lengths.",
    );
  }

  console.error("Course RPC failed:", error);

  throw new BatchHttpError(
    500,
    "Unable to complete the course request.",
  );
}

export async function GET(request: Request) {
  try {
    await requireQuestionOwner();

    const params = new URL(request.url).searchParams;

    const validation = listSchema.safeParse({
      search: params.get("search") ?? "",
      status: params.get("status") ?? "all",
      page: params.get("page") ?? "1",
    });

    if (!validation.success) {
      throw new BatchHttpError(400, "Invalid course filters.");
    }

    const { search, status, page } = validation.data;
    const pageSize = 12;

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "admin_list_courses",
      {
        p_search: search,
        p_status: status === "all" ? null : status,
        p_limit: pageSize,
        p_offset: (page - 1) * pageSize,
      },
    );

    if (error) throwRpcError(error);

    return jsonResponse(data);
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireQuestionOwner();

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new BatchHttpError(400, "Invalid JSON request.");
    }

    const validation = saveSchema.safeParse(body);

    if (!validation.success) {
      throw new BatchHttpError(
        400,
        validation.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      );
    }

    const supabase = await createClient();
    const input = validation.data;

   if (input.action === "save_course") {
const normalizedPriceAmount =
  input.price_amount === null ||
  input.price_amount === null ||
  input.price_amount === undefined
    ? null
    : Number(input.price_amount);

const normalizedOriginalPriceAmount =
  input.original_price_amount === null||
  input.original_price_amount === null ||
  input.original_price_amount === undefined
    ? null
    : Number(input.original_price_amount);

const normalizedPricingNote =
  input.pricing_note?.trim() || null;

  const { data, error } = await supabase.rpc(
    "admin_save_course",
    {
      p_course_id: input.id,
      p_college_name: input.college_name,
      p_course_code: input.course_code,
      p_course_title: input.course_title,
      p_short_description: input.short_description,
      p_objective: input.objective,
      p_status: input.status,
      p_price_amount: normalizedPriceAmount,
      p_price_currency: input.price_currency,
      p_original_price_amount: normalizedOriginalPriceAmount,
      p_pricing_note: normalizedPricingNote,
    },
  );

  if (error) throwRpcError(error);

  return jsonResponse({
    success: true,
    course: data,
    message: input.id ? "Course updated." : "Course created.",
  });
}
    const { data, error } = await supabase.rpc(
      "admin_save_course_offering",
      {
        p_offering_id: input.id,
        p_course_id: input.course_id,
        p_faculty_name: input.faculty_name,
        p_department_name: input.department_name,
        p_level: input.level,
        p_academic_session_label: input.academic_session_label,
        p_is_active: input.is_active,
      },
    );

    if (error) throwRpcError(error);

    return jsonResponse({
      success: true,
      offering: data,
      message: input.id
        ? "Academic assignment updated."
        : "Academic assignment added.",
    });
  } catch (error: unknown) {
    return handleBatchError(error);
  }
}