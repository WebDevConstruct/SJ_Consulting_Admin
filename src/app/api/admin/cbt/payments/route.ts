import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.object({
  payment_request_id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  access_duration_days: z.number().int().min(1).max(3650).optional(),
  admin_note: z.string().max(500).nullable().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_access")
      .select("id, role, is_active")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (adminError) throw adminError;

    if (!admin) {
      return NextResponse.json(
        { error: "You do not have admin access." },
        { status: 403 },
      );
    }

    const { data: requests, error: requestsError } =
      await supabase
        .from("course_payment_requests")
        .select(
          `
          id,
          user_id,
          course_id,
          amount,
          currency,
          payment_method,
          status,
          claimed_at,
          receipt_sent_at,
          approved_at,
          rejected_at,
          expires_at,
          admin_note,
          created_at,
          updated_at,
          course:courses (
            course_code,
            course_title
          )
        `,
        )
        .in("status", [
          "payment_claimed",
          "receipt_sent",
          "approved",
          "rejected",
        ])
        .order("updated_at", { ascending: false });

    if (requestsError) throw requestsError;

    const paymentRequests = requests ?? [];

    const userIds = Array.from(
      new Set(
        paymentRequests.map(
          (request) => request.user_id,
        ),
      ),
    );
//console.log("USERiD", userIds)
    let usersById = new Map<
      string,
      {
        full_name: string | null;
        email: string | null;
      }
    >();

    if (userIds.length > 0) {
      const { data: userRows, error: usersError } =
        await supabase
          .from("users")
          .select("id, full_name, email")
          .in("id", userIds);
      if (usersError) throw usersError;

      usersById = new Map(
        (userRows ?? []).map((row) => [
          row.id,
          {
            full_name: row.full_name ?? null,
            email: row.email ?? null,
          },
        ]),
      );
    }

    const enrichedRequests = paymentRequests.map(
      (request) => {
        const student = usersById.get(request.user_id);

        return {
          ...request,
          student: student ?? {
            full_name: null,
            email: null,
          },
        };
      },
    );

    return NextResponse.json({
      success: true,
      payment_requests: enrichedRequests,
    });
  } catch (error) {
    console.error(
      "GET admin course payments failed:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to load payment requests." },
      { status: 500 },
    );
  }
}



export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 }
    );
  }

  const body = await request.json();
  const {
    action,
    payment_request_id: paymentRequestId,
    rejection_reason: rejectionReason,
    admin_note: adminNote,
  } = body;

  if (!paymentRequestId) {
    return NextResponse.json(
      { error: "payment_request_id is required." },
      { status: 400 }
    );
  }

  if (action === "reject") {
    if (!rejectionReason?.trim()) {
      return NextResponse.json(
        { error: "A rejection reason is required." },
        { status: 400 }
      );
    }

    const { error } = await supabase.rpc(
      "admin_reject_course_payment",
      {
        p_request_id: paymentRequestId,
        p_admin_user_id: user.id,
        p_rejection_reason: rejectionReason.trim(),
        p_admin_note: adminNote ?? null,
      }
    );

    if (error) {
      console.error("Admin course payment rejection failed:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment request rejected.",
    });
  }

  if (action === "approve") {
    const { error } = await supabase.rpc(
      "admin_approve_course_payment",
      {
        p_request_id: paymentRequestId,
        p_admin_user_id: user.id,
        p_admin_note: adminNote ?? null,
      }
    );

    if (error) {
      console.error("Admin course payment approval failed:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Payment approved and course access granted.",
    });
  }

  return NextResponse.json(
    { error: "Unsupported action." },
    { status: 400 }
  );
}