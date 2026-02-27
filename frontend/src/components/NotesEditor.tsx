"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Save, Loader2, Check, AlertCircle } from "lucide-react";
import { updateVideoNotes } from "@/lib/api";

interface NotesEditorProps {
  videoId: string;
  initialNotes: string;
}

export function NotesEditor({ videoId, initialNotes }: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setNotes(initialNotes);
    setStatus("idle");
  }, [videoId, initialNotes]);

  const save = useCallback(async () => {
    if (notes === initialNotes) return;
    setStatus("saving");
    try {
      await updateVideoNotes(videoId, notes);
      setStatus("saved");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  }, [videoId, notes, initialNotes]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="notes" className="text-sm font-medium">
          Personal Notes
        </label>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {status === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>}
          {status === "saved" && <><Check className="h-3 w-3 text-green-500" /> Saved</>}
          {status === "error" && <><AlertCircle className="h-3 w-3 text-destructive" /> Failed to save</>}
          {status === "idle" && <><Save className="h-3 w-3" /> Auto-saves on blur</>}
        </span>
      </div>
      <textarea
        id="notes"
        className="min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        placeholder="Write your notes about this video..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={save}
      />
    </div>
  );
}
