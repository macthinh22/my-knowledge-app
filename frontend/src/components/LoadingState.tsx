"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const steps = [
  "Fetching video information",
  "Downloading audio",
  "Transcribing content",
  "Analyzing knowledge",
];

export function LoadingState() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Dialog open>
      <DialogContent className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Extracting Knowledge</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {steps.map((step, i) => (
            <div key={step} className="flex items-center gap-3 text-sm">
              {i < currentStep ? (
                <Check className="h-4 w-4 text-green-500 shrink-0" />
              ) : i === currentStep ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-border shrink-0" />
              )}
              <span className={i > currentStep ? "text-muted-foreground" : ""}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
