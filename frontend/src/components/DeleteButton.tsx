"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteVideo } from "@/lib/api";

interface DeleteButtonProps {
  videoId: string;
  videoTitle: string | null;
}

export default function DeleteButton({
  videoId,
  videoTitle,
}: DeleteButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteVideo(videoId);
      router.push("/");
    } catch {
      setDeleting(false);
      setShowConfirm(false);
    }
  }, [videoId, router]);

  return (
    <>
      <button
        id="delete-video-button"
        className="inline-flex items-center gap-2 px-4 py-2
                   text-sm font-medium text-[var(--fg-tertiary)]
                   border border-[var(--border-primary)] rounded-lg
                   transition-all duration-200
                   hover:text-[var(--color-error)]
                   hover:border-[var(--color-error)]/30
                   hover:bg-[var(--color-error)]/5"
        onClick={() => setShowConfirm(true)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        Delete
      </button>

      {showConfirm && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center
                     bg-[var(--bg-overlay)] backdrop-blur-sm
                     animate-[fadeIn_200ms_ease-out]"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-[400px] p-8
                       bg-[var(--bg-secondary)] border border-[var(--border-primary)]
                       rounded-xl shadow-[var(--shadow-lg)]
                       animate-[slideUp_300ms_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="font-[var(--font-heading)] text-xl font-semibold
                         text-[var(--fg-primary)] mb-3"
            >
              Delete this video?
            </h3>
            <p className="text-sm text-[var(--fg-secondary)] leading-relaxed mb-6">
              &ldquo;{videoTitle ?? "Untitled"}&rdquo; will be permanently
              removed. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-5 py-2 text-sm font-medium
                           text-[var(--fg-secondary)] bg-[var(--bg-tertiary)]
                           rounded-lg transition-all duration-150
                           hover:not-disabled:bg-[var(--border-primary)]
                           hover:not-disabled:text-[var(--fg-primary)]
                           disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                id="confirm-delete-button"
                className="px-5 py-2 text-sm font-semibold
                           text-white bg-[var(--color-error)] rounded-lg
                           transition-all duration-150
                           hover:not-disabled:brightness-110
                           hover:not-disabled:shadow-[var(--shadow-md)]
                           disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
