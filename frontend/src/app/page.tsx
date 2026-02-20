"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import VideoInput from "@/components/VideoInput";
import LoadingState from "@/components/LoadingState";
import SearchBar from "@/components/SearchBar";
import VideoCard from "@/components/VideoCard";
import { createVideo, listVideos, type VideoListItem } from "@/lib/api";

export default function Home() {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [initialLoad, setInitialLoad] = useState(true);

  /* ---- Fetch videos on mount ---- */
  useEffect(() => {
    listVideos()
      .then(setVideos)
      .catch(() => {
        /* backend might not be running yet */
      })
      .finally(() => setInitialLoad(false));
  }, []);

  /* ---- Submit handler ---- */
  const handleSubmit = useCallback(async (url: string) => {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const result = await createVideo(url);
      const isDuplicate = videos.some((v) => v.id === result.id);
      const updated = await listVideos();
      setVideos(updated);
      if (isDuplicate) {
        setInfo("This video is already in your library.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [videos]);

  /* ---- Filtered list ---- */
  const filtered = useMemo(() => {
    if (!search.trim()) return videos;
    const q = search.toLowerCase();
    return videos.filter(
      (v) =>
        v.title?.toLowerCase().includes(q) ||
        v.channel_name?.toLowerCase().includes(q) ||
        v.keywords?.some((kw) => kw.toLowerCase().includes(q)),
    );
  }, [videos, search]);

  return (
    <>
      <LoadingState visible={loading} />

      <div className="min-h-screen px-6 py-8 max-w-5xl mx-auto">
        {/* Hero */}
        <header
          className="flex flex-col items-center text-center gap-5
                     pt-16 pb-12 animate-[fadeIn_600ms_ease-out]
                     max-sm:pt-10 max-sm:pb-8"
        >
          <h1 className="font-[var(--font-heading)] text-5xl font-bold leading-tight tracking-tight max-sm:text-3xl">
            <span className="block text-[var(--fg-primary)]">YouTube</span>
            <span className="block text-[var(--accent)]">
              Knowledge Extractor
            </span>
          </h1>
          <p className="text-lg text-[var(--fg-secondary)] max-w-md leading-relaxed max-sm:text-base">
            Paste a video link. Get a structured summary in seconds.
          </p>

          <VideoInput onSubmit={handleSubmit} disabled={loading} />

          {error && (
            <p
              className="px-5 py-2.5 text-sm text-[var(--color-error)]
                         bg-[var(--color-error)]/8 border border-[var(--color-error)]/20
                         rounded-lg animate-[slideDown_250ms_ease-out]"
            >
              {error}
            </p>
          )}

          {info && (
            <p
              className="px-5 py-2.5 text-sm text-[var(--accent)]
                         bg-[var(--accent)]/8 border border-[var(--accent)]/20
                         rounded-lg animate-[slideDown_250ms_ease-out]"
            >
              {info}
            </p>
          )}
        </header>

        {/* Toolbar */}
        {videos.length > 0 && (
          <div
            className="flex items-center justify-between gap-4 mb-8
                       animate-[slideUp_400ms_ease-out]
                       max-sm:flex-col max-sm:items-stretch"
          >
            <SearchBar value={search} onChange={setSearch} />
            <span className="shrink-0 text-sm text-[var(--fg-muted)] tabular-nums max-sm:text-right">
              {filtered.length} {filtered.length === 1 ? "video" : "videos"}
            </span>
          </div>
        )}

        {/* Grid */}
        {!initialLoad && filtered.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} />
            ))}
          </section>
        )}

        {/* Empty states */}
        {!initialLoad && videos.length === 0 && !loading && (
          <div className="flex flex-col items-center gap-4 py-20 px-8 text-center animate-[fadeIn_500ms_ease-out]">
            <div className="text-5xl leading-none opacity-60">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-muted)]">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <h2 className="font-[var(--font-heading)] text-xl font-semibold text-[var(--fg-secondary)]">
              No videos yet
            </h2>
            <p className="text-sm text-[var(--fg-muted)] max-w-sm leading-relaxed">
              Paste a YouTube URL above to extract your first knowledge summary.
            </p>
          </div>
        )}

        {!initialLoad &&
          videos.length > 0 &&
          filtered.length === 0 &&
          search && (
            <div className="flex flex-col items-center gap-4 py-20 px-8 text-center animate-[fadeIn_500ms_ease-out]">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--fg-muted)] opacity-60">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <h2 className="font-[var(--font-heading)] text-xl font-semibold text-[var(--fg-secondary)]">
                No matches
              </h2>
              <p className="text-sm text-[var(--fg-muted)] max-w-sm leading-relaxed">
                Try a different search term.
              </p>
            </div>
          )}
      </div>
    </>
  );
}
