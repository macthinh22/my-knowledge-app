"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteVideo } from "@/lib/api";
import styles from "./DeleteButton.module.css";

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
                className={styles.trigger}
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
                <div className={styles.overlay} onClick={() => setShowConfirm(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>Delete this video?</h3>
                        <p className={styles.modalText}>
                            &ldquo;{videoTitle ?? "Untitled"}&rdquo; will be permanently
                            removed. This action cannot be undone.
                        </p>
                        <div className={styles.modalActions}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => setShowConfirm(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                id="confirm-delete-button"
                                className={styles.deleteBtn}
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? "Deleting…" : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
