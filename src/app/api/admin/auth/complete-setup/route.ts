// src/app/api/admin/auth/complete-setup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 },
    );
  }

  const { error } = await supabase
    .from("admin_access")
    .update({ password_configured: true })
    .eq("email", user.email.toLowerCase())
    .eq("is_active", true);

  if (error) {
    return NextResponse.json(
      { error: "Unable to complete admin setup." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}