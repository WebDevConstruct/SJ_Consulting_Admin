import { useEffect, useState } from "react";

type DeleteBatchModalProps = {
  batch: {
    id: string;
    title?: string | null;
    subject_name?: string | null;
    created_at?: string | null;
  } | null;
  onClose: () => void;
  onConfirm: (batchId: string) => Promise<void> | void;
};

export default function DeleteBatchModal({
  batch,
  onClose,
  onConfirm,
}: DeleteBatchModalProps) {
  const [confirmationText, setConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = Boolean(batch);

  useEffect(() => {
    if (!isOpen) {
      setConfirmationText("");
      setIsDeleting(false);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isDeleting, onClose]);

  if (!batch) return null;

  const canDelete =
    confirmationText.trim().toUpperCase() === "DELETE" &&
    !isDeleting;

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm(batch.id);
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this batch.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-batch-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2
          id="delete-batch-title"
          className="text-lg font-semibold text-red-600"
        >
          Delete needs-review batch?
        </h2>

        <p className="mt-3 text-sm text-gray-700">
         This will permanently delete the import batch, its draft
  questions, and <strong>all saved questions</strong> linked to it.
  The source document will also be removed from Storage if possible.
        </p>

        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
          <p className="font-medium text-gray-900">
            {batch.title || "Untitled batch"}
          </p>

          {batch.subject_name && (
            <p className="text-gray-600">
              Subject: {batch.subject_name}
            </p>
          )}

          {batch.created_at && (
            <p className="text-gray-600">
              Created:{" "}
              {new Date(batch.created_at).toLocaleString()}
            </p>
          )}

          <p className="mt-2 font-mono text-xs break-all text-gray-500">
            Batch ID: {batch.id}
          </p>
        </div>

        <p className="mt-4 text-sm text-gray-700">
          Type <span className="font-semibold">DELETE</span> to
          confirm.
        </p>

        <input
          type="text"
          value={confirmationText}
          onChange={(event) => setConfirmationText(event.target.value)}
          disabled={isDeleting}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
          placeholder="DELETE"
          aria-label="Type DELETE to confirm"
        />

        {error && (
          <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete batch"}
          </button>
        </div>
      </div>
    </div>
  );
}