"use client";

import { useState } from "react";

interface VideoInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

const YT_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)/;

export default function VideoInput({
  onSubmit,
  disabled = false,
}: VideoInputProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setError("Please paste a YouTube URL");
      return;
    }
    if (!YT_REGEX.test(trimmed)) {
      setError("That doesn't look like a valid YouTube URL");
      return;
    }

    setError("");
    onSubmit(trimmed);
    setUrl("");
  }

  return (
    <form className="w-full max-w-2xl" onSubmit={handleSubmit}>
      <div className="flex items-center gap-3">
        <div
          className="flex-1 flex items-center gap-3 px-5 py-3
                      bg-[var(--bg-secondary)] border border-[var(--border-primary)]
                      rounded-xl transition-all duration-200
                      focus-within:border-[var(--border-focus)]
                      focus-within:shadow-[0_0_0_3px_var(--accent-subtle)]"
        >
          <svg
            className="shrink-0 text-[var(--fg-muted)] transition-colors duration-150"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816zM9 16V8l8 4-8 4z" />
          </svg>
          <input
            id="youtube-url-input"
            className="flex-1 text-base leading-relaxed py-0.5
                       bg-transparent placeholder:text-[var(--fg-muted)]
                       disabled:opacity-50"
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError("");
            }}
            placeholder="Paste a YouTube URL here..."
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button
          id="extract-button"
          className="shrink-0 flex items-center gap-2 px-6 py-3
                     font-[var(--font-heading)] text-sm font-semibold tracking-wide
                     text-white bg-[var(--accent)] rounded-xl
                     transition-all duration-200
                     hover:not-disabled:bg-[var(--accent-hover)]
                     hover:not-disabled:-translate-y-0.5
                     hover:not-disabled:shadow-[var(--shadow-md)]
                     active:not-disabled:translate-y-0
                     disabled:opacity-40 disabled:cursor-not-allowed"
          type="submit"
          disabled={disabled || !url.trim()}
        >
          <span>Extract</span>
          <svg
            className="transition-transform duration-150"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
      {error && (
        <p className="mt-3 pl-5 text-sm text-[var(--color-error)] animate-[slideDown_250ms_ease-out]">
          {error}
        </p>
      )}
    </form>
  );
}
