"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateVideoNotes } from "@/lib/api";

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
    <div
      className="bg-[var(--bg-secondary)] border border-[var(--border-primary)]
                 rounded-xl p-8 animate-[fadeIn_500ms_ease-out]"
    >
      <div
        className="flex items-center justify-between mb-5 pb-4
                    border-b border-[var(--border-primary)]"
      >
        <h2
          className="font-[var(--font-heading)] text-xl font-bold
                     text-[var(--fg-primary)]"
        >
          Personal Notes
        </h2>
        <span
          className={`text-xs font-medium whitespace-nowrap transition-all duration-150
            ${status === "idle" ? "text-transparent" : ""}
            ${status === "saving" ? "text-[var(--fg-muted)]" : ""}
            ${status === "saved" ? "text-[var(--color-success)]" : ""}
            ${status === "error" ? "text-[var(--color-error)]" : ""}`}
        >
          {status === "saving" && "Saving..."}
          {status === "saved" && "Saved"}
          {status === "error" && "Save failed"}
        </span>
      </div>
      <textarea
        id="notes-editor"
        className="w-full min-h-[160px] p-5
                   font-[var(--font-body)] text-base leading-7
                   text-[var(--fg-primary)] bg-[var(--bg-tertiary)]
                   border border-[var(--border-primary)] rounded-lg
                   resize-y transition-all duration-200 outline-none
                   placeholder:text-[var(--fg-muted)]
                   focus:border-[var(--border-focus)]
                   focus:shadow-[0_0_0_3px_var(--accent-subtle)]"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => save(notes)}
        placeholder="Add your personal notes, reflections, or action items here..."
        rows={6}
        spellCheck
      />
    </div>
  );
}
