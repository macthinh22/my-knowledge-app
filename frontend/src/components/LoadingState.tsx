"use client";

import { useEffect, useState } from "react";
import styles from "./LoadingState.module.css";

const STEPS = [
    { label: "Extracting video info", icon: "🔍" },
    { label: "Fetching transcript", icon: "📝" },
    { label: "Generating summary", icon: "🧠" },
    { label: "Storing knowledge", icon: "💾" },
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
        <div className={styles.overlay}>
            <div className={styles.card}>
                {/* Pulsing orb */}
                <div className={styles.orbContainer}>
                    <div className={styles.orb} />
                    <div className={styles.orbRing} />
                </div>

                {/* Steps */}
                <div className={styles.steps}>
                    {STEPS.map((s, i) => (
                        <div
                            key={s.label}
                            className={`${styles.step} ${i < step ? styles.done : ""} ${i === step ? styles.active : ""} ${i > step ? styles.pending : ""}`}
                        >
                            <span className={styles.stepIcon}>{s.icon}</span>
                            <span className={styles.stepLabel}>{s.label}</span>
                            {i === step && <span className={styles.dots}>…</span>}
                            {i < step && <span className={styles.check}>✓</span>}
                        </div>
                    ))}
                </div>

                <p className={styles.hint}>This may take a minute for longer videos</p>
            </div>
        </div>
    );
}
