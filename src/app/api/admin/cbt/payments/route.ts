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

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid admin payment action." },
        { status: 400 },
      );
    }

    const {
      payment_request_id,
      action,
      access_duration_days,
      admin_note,
    } = parsed.data;

    const { data: paymentRequest, error: requestError } =
      await supabase
        .from("course_payment_requests")
        .select(
          `
          id,
          user_id,
          course_id,
          status,
          amount,
          currency
        `,
        )
        .eq("id", payment_request_id)
        .maybeSingle();

    if (requestError) throw requestError;

    if (!paymentRequest) {
      return NextResponse.json(
        { error: "Payment request not found." },
        { status: 404 },
      );
    }

    if (
      !["payment_claimed", "receipt_sent"].includes(
        paymentRequest.status,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Only payment_claimed or receipt_sent requests can be approved or rejected.",
        },
        { status: 409 },
      );
    }

    if (action === "reject") {
      const { data: rejectedRequest, error: rejectError } =
        await supabase
          .from("course_payment_requests")
          .update({
            status: "rejected",
            rejected_at: new Date().toISOString(),
            admin_note: admin_note ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment_request_id)
          .in("status", ["payment_claimed", "receipt_sent"])
          .select("*")
          .maybeSingle();

      if (rejectError) throw rejectError;

      if (!rejectedRequest) {
        return NextResponse.json(
          { error: "This request has already been processed." },
          { status: 409 },
        );
      }

      return NextResponse.json({
        success: true,
        payment_request: rejectedRequest,
      });
    }

    const durationDays = access_duration_days ?? 30;
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const token =
      crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");

    const { data: approvedRequest, error: approveError } =
      await supabase
        .from("course_payment_requests")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          admin_note: admin_note ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment_request_id)
        .in("status", ["payment_claimed", "receipt_sent"])
        .select("*")
        .maybeSingle();

    if (approveError) throw approveError;

    if (!approvedRequest) {
      return NextResponse.json(
        { error: "This request has already been processed." },
        { status: 409 },
      );
    }

    const { error: tokenError } = await supabase
      .from("course_access_tokens")
      .insert({
        payment_request_id: paymentRequest.id,
        user_id: paymentRequest.user_id,
        course_id: paymentRequest.course_id,
        token,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      });

    if (tokenError) throw tokenError;

    const { error: accessError } = await supabase
      .from("course_access")
      .upsert(
        {
          user_id: paymentRequest.user_id,
          course_id: paymentRequest.course_id,
          padlock: false,
        },
        {
          onConflict: "user_id,course_id",
        },
      );

    if (accessError) throw accessError;

    return NextResponse.json({
      success: true,
      payment_request: approvedRequest,
      access_token: token,
      expires_at: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("PATCH admin course payment failed:", error);

    return NextResponse.json(
      { error: "Unable to process this payment request." },
      { status: 500 },
    );
  }
}