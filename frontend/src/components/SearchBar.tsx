"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./SearchBar.module.css";

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function SearchBar({
    value,
    onChange,
    placeholder = "Search by title or keyword…",
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
        <div className={styles.wrapper}>
            <svg
                className={styles.icon}
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
                className={styles.input}
                type="text"
                value={local}
                onChange={handleChange}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
            />
            {local && (
                <button
                    className={styles.clear}
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
