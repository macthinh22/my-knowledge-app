"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { label: "Extracting video info", icon: "1" },
  { label: "Fetching transcript", icon: "2" },
  { label: "Generating summary", icon: "3" },
  { label: "Storing knowledge", icon: "4" },
];

interface LoadingStateProps {
  visible: boolean;
}

export default function LoadingState({ visible }: LoadingStateProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep(0);
      return;
    }

    const interval = setInterval(() => {
      setStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 4000);

    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center
                 bg-[var(--bg-overlay)] backdrop-blur-sm
                 animate-[fadeIn_300ms_ease-out]"
    >
      <div
        className="flex flex-col items-center gap-8
                    min-w-[340px] px-10 py-12
                    bg-[var(--bg-secondary)] border border-[var(--border-primary)]
                    rounded-2xl shadow-[var(--shadow-lg)]
                    animate-[slideUp_400ms_ease-out]"
      >
        {/* Spinner */}
        <div className="relative w-16 h-16">
          <div
            className="absolute inset-0 rounded-full border-2 border-[var(--border-primary)]
                        border-t-[var(--accent)] animate-spin"
          />
          <div className="absolute inset-3 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <span className="text-xs font-semibold text-[var(--accent)]">
              {step + 1}/{STEPS.length}
            </span>
          </div>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3 w-full">
          {STEPS.map((s, i) => (
            <div
              key={s.label}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200
                ${i === step ? "text-[var(--fg-primary)] bg-[var(--accent-subtle)] font-medium" : ""}
                ${i < step ? "text-[var(--fg-tertiary)]" : ""}
                ${i > step ? "text-[var(--fg-muted)]" : ""}`}
            >
              <span
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold
                  ${i < step ? "bg-[var(--color-success)] text-white" : ""}
                  ${i === step ? "bg-[var(--accent)] text-white" : ""}
                  ${i > step ? "bg-[var(--bg-tertiary)] text-[var(--fg-muted)]" : ""}`}
              >
                {i < step ? "✓" : s.icon}
              </span>
              <span className="flex-1">{s.label}</span>
              {i === step && (
                <span className="text-[var(--accent)] font-semibold animate-pulse">
                  ...
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--fg-muted)] text-center">
          This may take a minute for longer videos
        </p>
      </div>
    </div>
  );
}
