"use client";

import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search by title or keyword...",
}: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setLocal(v);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(v), 250);
  }

  return (
    <div
      className="relative flex items-center w-full max-w-md
                  bg-[var(--bg-secondary)] border border-[var(--border-primary)]
                  rounded-full px-4 py-2.5 transition-all duration-200
                  focus-within:border-[var(--border-focus)]
                  focus-within:shadow-[0_0_0_3px_var(--accent-subtle)]"
    >
      <svg
        className="shrink-0 mr-3 text-[var(--fg-muted)] transition-colors duration-150"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        id="search-videos"
        className="flex-1 text-sm leading-relaxed bg-transparent
                   placeholder:text-[var(--fg-muted)]"
        type="text"
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {local && (
        <button
          className="shrink-0 flex items-center justify-center w-5 h-5 ml-2
                     text-[11px] text-[var(--fg-tertiary)]
                     bg-[var(--bg-tertiary)] rounded-full
                     transition-all duration-150
                     hover:text-[var(--fg-primary)] hover:bg-[var(--border-secondary)]"
          onClick={() => {
            setLocal("");
            onChange("");
          }}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
