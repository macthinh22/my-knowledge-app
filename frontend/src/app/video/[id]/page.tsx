"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getVideo, type Video } from "@/lib/api";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import VideoDetail from "@/components/VideoDetail";
import NotesEditor from "@/components/NotesEditor";
import DeleteButton from "@/components/DeleteButton";
import KeywordBadge from "@/components/KeywordBadge";
import styles from "./page.module.css";

function formatDuration(seconds: number | null): string {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export default function VideoPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [video, setVideo] = useState<Video | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getVideo(id)
            .then(setVideo)
            .catch((err) =>
                setError(err instanceof Error ? err.message : "Video not found"),
            )
            .finally(() => setLoading(false));
    }, [id]);

    /* --- Loading skeleton --- */
    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.skeleton}>
                    <div className={`${styles.skeletonBlock} ${styles.skeletonVideo}`} />
                    <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
                    <div className={`${styles.skeletonBlock} ${styles.skeletonMeta}`} />
                    <div
                        className={`${styles.skeletonBlock} ${styles.skeletonContent}`}
                    />
                </div>
            </div>
        );
    }

    /* --- Error state --- */
    if (error || !video) {
        return (
            <div className={styles.page}>
                <div className={styles.error}>
                    <div className={styles.errorIcon}>😵</div>
                    <h2 className={styles.errorTitle}>Video not found</h2>
                    <p className={styles.errorText}>{error || "This video doesn't exist or was deleted."}</p>
                    <Link href="/" className={styles.backLink}>
                        ← Back to library
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            {/* Back navigation */}
            <Link href="/" className={styles.backLink}>
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                </svg>
                Back to library
            </Link>

            {/* YouTube player */}
            <YouTubeEmbed youtubeId={video.youtube_id} title={video.title ?? undefined} />

            {/* Header */}
            <header className={styles.header}>
                <h1 className={styles.title}>{video.title ?? "Untitled"}</h1>
                <div className={styles.meta}>
                    {video.channel_name && (
                        <span className={styles.channel}>{video.channel_name}</span>
                    )}
                    {video.duration && (
                        <span className={styles.duration}>
                            {formatDuration(video.duration)}
                        </span>
                    )}
                    <span className={styles.date}>{formatDate(video.created_at)}</span>
                    {video.transcript_source && (
                        <span className={styles.source}>
                            {video.transcript_source === "captions"
                                ? "📝 Captions"
                                : "🎙️ Whisper"}
                        </span>
                    )}
                </div>

                {video.keywords && video.keywords.length > 0 && (
                    <div className={styles.keywords}>
                        {video.keywords.map((kw) => (
                            <KeywordBadge key={kw} keyword={kw} />
                        ))}
                    </div>
                )}
            </header>

            {/* Summary sections */}
            <VideoDetail
                overview={video.overview}
                detailedSummary={video.detailed_summary}
                keyTakeaways={video.key_takeaways}
            />

            {/* Notes editor */}
            <NotesEditor videoId={video.id} initialNotes={video.notes} />

            {/* Actions */}
            <div className={styles.actions}>
                <DeleteButton videoId={video.id} videoTitle={video.title} />
            </div>
        </div>
    );
}
