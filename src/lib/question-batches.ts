import "server-only";

import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const QUESTION_BUCKET = "question-documents";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_YEARS = ["2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "2027"] as const;

export class BatchHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BatchHttpError";
  }
}

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export function handleBatchError(error: unknown) {
  if (error instanceof BatchHttpError) {
    return jsonResponse({ error: error.message }, error.status);
  }

  console.error("Question batch API failed:", error);

  return jsonResponse(
    { error: "Unable to complete the question batch request." },
    500,
  );
}

export async function requireQuestionOwner() {
  const sessionClient = await createClient();

  const {
    data: authData,
    error: authError,
  } = await sessionClient.auth.getUser();

  if (authError || !authData.user) {
    throw new BatchHttpError(401, "Please sign in again.");
  }

  const {
    data: isOwner,
    error: accessError,
  } = await sessionClient.rpc("is_question_owner");

  if (accessError) {
    console.error("Owner check failed:", accessError);

    throw new BatchHttpError(
      500,
      "Unable to verify owner permissions.",
    );
  }

  if (isOwner !== true) {
    throw new BatchHttpError(
      403,
      "An active owner account is required.",
    );
  }

  return authData.user;
}

export function getPrivilegedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    console.error(
      "Missing Next.js server environment variable: NEXT_PUBLIC_SUPABASE_URL",
    );

    throw new BatchHttpError(
      500,
      "Server configuration is missing the Supabase URL.",
    );
  }

  if (!key) {
    console.error(
      "Missing Next.js server environment variable",
    );

    throw new BatchHttpError(
      500,
      "Server configuration is missing the privileged Supabase key.",
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
export function assertSameOrigin(request: Request) {
  const expectedOrigin =
    process.env.APP_ORIGIN || new URL(request.url).origin;

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && origin !== new URL(expectedOrigin).origin) {
    throw new BatchHttpError(403, "Invalid request origin.");
  }

  if (!origin && fetchSite === "cross-site") {
    throw new BatchHttpError(403, "Cross-site requests are not allowed.");
  }
}