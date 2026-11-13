export const inputClass =
  "w-full rounded-xl border border-paper-line bg-paper px-3 py-2.5 " +
  "text-base text-ink outline-none transition " +
  "focus:border-gold-500 focus:ring-2 focus:ring-gold-400/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "dark:border-ink-line dark:bg-ink-surface dark:text-paper";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-paper-line bg-paper px-4 py-2.5 " +
  "text-sm font-medium text-ink transition hover:bg-paper-soft " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "dark:border-ink-line dark:bg-ink-soft dark:text-paper " +
  "dark:hover:bg-ink-surface";

export const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-gold-500/30 bg-gold-metal-soft px-4 py-2.5 " +
  "text-sm font-semibold text-ink transition hover:brightness-105 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const panelClass =
  "rounded-2xl border border-paper-line bg-paper p-5 " +
  "dark:border-ink-line dark:bg-ink-soft";

export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to complete the request.";
}

export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Unreadable server response (${response.status}).`,
    );
  }

  if (!response.ok) {
    const details = Array.isArray(result.issues)
      ? result.issues
          .map(
            (issue: { field: string; message: string }) =>
              `${issue.field}: ${issue.message}`,
          )
          .join("\n")
      : "";

    throw new Error(
      [result.error || "Request failed.", details]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result as T;
}