"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getVideo, type Video } from "@/lib/api";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import VideoDetail from "@/components/VideoDetail";
import NotesEditor from "@/components/NotesEditor";
import DeleteButton from "@/components/DeleteButton";
import KeywordBadge from "@/components/KeywordBadge";

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
      <div className="min-h-screen max-w-[920px] mx-auto px-6 py-8 flex flex-col gap-6 animate-[fadeIn_300ms_ease]">
        <div className="w-full aspect-video rounded-xl bg-[var(--bg-tertiary)] animate-[shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%] bg-gradient-to-r from-[var(--bg-tertiary)] via-[var(--border-primary)] to-[var(--bg-tertiary)]" />
        <div className="h-10 w-3/4 rounded-xl bg-[var(--bg-tertiary)] animate-[shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%] bg-gradient-to-r from-[var(--bg-tertiary)] via-[var(--border-primary)] to-[var(--bg-tertiary)]" />
        <div className="h-5 w-2/5 rounded-lg bg-[var(--bg-tertiary)] animate-[shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%] bg-gradient-to-r from-[var(--bg-tertiary)] via-[var(--border-primary)] to-[var(--bg-tertiary)]" />
        <div className="h-72 rounded-xl bg-[var(--bg-tertiary)] animate-[shimmer_1.8s_ease-in-out_infinite] bg-[length:200%_100%] bg-gradient-to-r from-[var(--bg-tertiary)] via-[var(--border-primary)] to-[var(--bg-tertiary)]" />
      </div>
    );
  }

  /* --- Error state --- */
  if (error || !video) {
    return (
      <div className="min-h-screen max-w-[920px] mx-auto px-6 py-8">
        <div className="flex flex-col items-center gap-4 py-20 px-8 text-center animate-[fadeIn_500ms_ease-out]">
          <span className="text-5xl leading-none">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-muted)]">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <h2 className="font-[var(--font-heading)] text-xl font-semibold text-[var(--fg-secondary)]">
            Video not found
          </h2>
          <p className="text-sm text-[var(--fg-tertiary)] max-w-sm leading-relaxed">
            {error || "This video doesn't exist or was deleted."}
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            &larr; Back to library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[920px] mx-auto px-6 py-8 flex flex-col gap-8 max-sm:px-4 max-sm:gap-6">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium
                   text-[var(--fg-secondary)] hover:text-[var(--accent)]
                   transition-colors animate-[fadeIn_300ms_ease-out]"
      >
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
      <header
        className="flex flex-col gap-4 pb-8 border-b border-[var(--border-primary)]
                   animate-[slideUp_400ms_ease-out]"
      >
        <h1
          className="font-[var(--font-heading)] text-4xl font-bold leading-snug
                     text-[var(--fg-primary)] tracking-tight max-sm:text-2xl"
        >
          {video.title ?? "Untitled"}
        </h1>
        <div className="flex items-center flex-wrap gap-2.5 text-sm text-[var(--fg-tertiary)] max-sm:text-xs">
          {video.channel_name && (
            <span className="font-semibold text-[var(--fg-secondary)]">
              {video.channel_name}
            </span>
          )}
          {video.duration && (
            <span className="before:content-['·'] before:mr-2.5 before:text-[var(--fg-muted)]">
              {formatDuration(video.duration)}
            </span>
          )}
          <span className="before:content-['·'] before:mr-2.5 before:text-[var(--fg-muted)]">
            {formatDate(video.created_at)}
          </span>
          {video.transcript_source && (
            <span className="before:content-['·'] before:mr-2.5 before:text-[var(--fg-muted)]">
              {video.transcript_source === "captions"
                ? "Captions"
                : "Whisper"}
            </span>
          )}
        </div>

        {video.keywords && video.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
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
      <div className="flex justify-end pt-4 border-t border-[var(--border-primary)] animate-[fadeIn_500ms_ease-out]">
        <DeleteButton videoId={video.id} videoTitle={video.title} />
      </div>
    </div>
  );
}
