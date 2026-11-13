"use client";

import { useCallback, useEffect, useState } from "react";

import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Button } from "@/components/Button";
import { useStatusToast } from "@/components/ui/status-toast";

type AdminPaymentRequest = {
  id: string;
  user_id: string;
  course_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  status:
    | "payment_claimed"
    | "receipt_sent"
    | "approved"
    | "rejected";
  claimed_at: string | null;
  receipt_sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  expires_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  course: {
    course_code: string | null;
    course_title: string | null;
  } | null;
  student: {
    full_name: string | null;
    email: string | null;
  } | null;
};

const STATUS_LABELS: Record<string, string> = {
  payment_claimed: "Payment claimed",
  receipt_sent: "Receipt sent",
  approved: "Approved",
  rejected: "Rejected",
};

export default function AdminCoursePaymentsPage() {
  const { showToast } = useStatusToast();

  const [requests, setRequests] = useState<
    AdminPaymentRequest[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<
    string | null
  >(null);
  const [selectedDuration, setSelectedDuration] =
    useState<number>(30);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/admin/cbt/payments",
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "Unable to load payment requests.",
        );
      }

      setRequests(result.payment_requests ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load payment requests.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const processRequest = async (
    paymentRequest: AdminPaymentRequest,
    action: "approve" | "reject",
  ) => {
    setProcessingId(paymentRequest.id);

    try {
      const response = await fetch(
        "/api/admin/cbt/payments",
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment_request_id: paymentRequest.id,
            action,
            access_duration_days:
              action === "approve"
                ? selectedDuration
                : undefined,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ??
            "Unable to process this payment request.",
        );
      }

      showToast({
        kind: "success",
        title:
          action === "approve"
            ? "Payment approved"
            : "Payment rejected",
        message:
          action === "approve"
            ? "Course access has been activated."
            : "The payment request has been rejected.",
      });

      await loadRequests();
    } catch (processError) {
      showToast({
        kind: "error",
        title: "Action failed",
        message:
          processError instanceof Error
            ? processError.message
            : "Unable to process this payment request.",
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-paper-soft px-4 py-10 lg:py-5 sm:px-6 lg:px-10 dark:bg-ink dark:text-paper">
      <div className="mx-auto max-w-6xl">
        <header>
          <h1 className="text-3xl font-bold">
            Course payment requests
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65 dark:text-paper/65">
            Review undergraduate payment claims, verify the transfer
            through WhatsApp or your bank record, then approve access
            for the selected duration.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-paper-line bg-paper p-5 dark:border-ink-line dark:bg-ink-soft">
          <label
            htmlFor="access-duration"
            className="block text-sm font-semibold"
          >
            Default access duration
          </label>

          <select
            id="access-duration"
            value={selectedDuration}
            onChange={(event) =>
              setSelectedDuration(
                Number(event.target.value),
              )
            }
            className="mt-3 w-full max-w-xs rounded-xl border border-paper-line bg-paper px-4 py-3 text-sm outline-none dark:border-ink-line dark:bg-ink"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>1 year</option>
          </select>
        </section>

        {error && (
          <section
            role="alert"
            className="mt-6 rounded-2xl border border-paper-line bg-paper p-5 text-sm dark:border-ink-line dark:bg-ink-soft"
          >
            {error}
          </section>
        )}

        {loading && (
          <section className="mt-6 rounded-2xl border border-paper-line bg-paper p-10 text-center dark:border-ink-line dark:bg-ink-soft">
            Loading payment requests…
          </section>
        )}

        {!loading && !error && (
          <section className="mt-6 flex flex-col gap-4">
            {requests.map((request) => {
              const canProcess = [
                "payment_claimed",
                "receipt_sent",
              ].includes(request.status);

              return (
                <article
                  key={request.id}
                  className="rounded-2xl border border-paper-line bg-paper p-5 dark:border-ink-line dark:bg-ink-soft"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gold-700 dark:text-gold-200">
                        {request.course?.course_code ??
                          "Course"}
                      </p>

                      <h2 className="mt-1 font-display text-xl font-bold">
                        {request.course?.course_title ??
                          "Course payment"}
                      </h2>

                      <p className="mt-2 text-sm text-ink/65 dark:text-paper/65">
                        {request.student?.full_name ??
                          "Student"}{" "}
                        •{" "}
                        {request.student?.email ??
                          "No email available"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {request.currency} {request.amount}
                      </p>

                      <p className="mt-1 flex items-center justify-end gap-2 text-xs text-ink/60 dark:text-paper/60">
                        <Clock className="h-3.5 w-3.5" />
                        {STATUS_LABELS[request.status]}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-ink/70 dark:text-paper/70">
                    <p>
                      Payment claimed:{" "}
                      {request.claimed_at
                        ? new Date(
                            request.claimed_at,
                          ).toLocaleString()
                        : "Not claimed"}
                    </p>

                    <p>
                      Receipt sent:{" "}
                      {request.receipt_sent_at
                        ? new Date(
                            request.receipt_sent_at,
                          ).toLocaleString()
                        : "Not sent"}
                    </p>

                    {request.status === "approved" && (
                      <p>
                        Access expires:{" "}
                        {request.expires_at
                          ? new Date(
                              request.expires_at,
                            ).toLocaleDateString()
                          : "Not set"}
                      </p>
                    )}
                  </div>

                  {canProcess && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Button
                        text={
                          processingId === request.id
                            ? "Processing…"
                            : "Approve access"
                        }
                        type="button"
                        disabled={
                          processingId === request.id
                        }
                        onClick={() =>
                          processRequest(
                            request,
                            "approve",
                          )
                        }
                      />

                      <Button
                        text="Reject request"
                        type="button"
                        disabled={
                          processingId === request.id
                        }
                        onClick={() =>
                          processRequest(
                            request,
                            "reject",
                          )
                        }
                      />
                    </div>
                  )}
                </article>
              );
            })}

            {requests.length === 0 && (
              <div className="rounded-2xl border border-paper-line bg-paper p-10 text-center dark:border-ink-line dark:bg-ink-soft">
                <h3 className="font-display text-xl">
                  No payment requests
                </h3>

                <p className="mt-2 text-sm text-ink/65 dark:text-paper/65">
                  New undergraduate payment claims will appear here.
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}