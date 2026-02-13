"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateVideoNotes } from "@/lib/api";
import styles from "./NotesEditor.module.css";

interface NotesEditorProps {
    videoId: string;
    initialNotes: string | null;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function NotesEditor({
    videoId,
    initialNotes,
}: NotesEditorProps) {
    const [notes, setNotes] = useState(initialNotes ?? "");
    const [status, setStatus] = useState<SaveStatus>("idle");
    const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

    /* Reset when video changes */
    useEffect(() => {
        setNotes(initialNotes ?? "");
        setStatus("idle");
    }, [videoId, initialNotes]);

    const save = useCallback(
        async (value: string) => {
            if (value === (initialNotes ?? "")) return;
            setStatus("saving");
            try {
                await updateVideoNotes(videoId, value);
                setStatus("saved");
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setStatus("idle"), 2500);
            } catch {
                setStatus("error");
            }
        },
        [videoId, initialNotes],
    );

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h2 className={styles.title}>
                    <span className={styles.icon}>📝</span>
                    Personal Notes
                </h2>
                <span
                    className={`${styles.status} ${status !== "idle" ? styles[status] : ""}`}
                >
                    {status === "saving" && "Saving…"}
                    {status === "saved" && "Saved ✓"}
                    {status === "error" && "Save failed"}
                </span>
            </div>
            <textarea
                id="notes-editor"
                className={styles.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => save(notes)}
                placeholder="Add your personal notes, reflections, or action items here…"
                rows={6}
                spellCheck
            />
        </div>
    );
}
