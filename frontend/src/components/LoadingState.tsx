"use client";

import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useExtraction } from "@/context/extraction";

export function ExtractionProgress() {
  const { extraction } = useExtraction();
  if (!extraction) return null;

  const progress = ((extraction.step + 1) / extraction.totalSteps) * 100;
  const videoNum = extraction.step + 1;

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span>
          Step {videoNum}/{extraction.totalSteps} — {extraction.stepLabel}...
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
