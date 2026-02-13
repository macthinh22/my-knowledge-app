"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import VideoInput from "@/components/VideoInput";
import LoadingState from "@/components/LoadingState";
import SearchBar from "@/components/SearchBar";
import VideoCard from "@/components/VideoCard";
import { createVideo, listVideos, type VideoListItem } from "@/lib/api";
import styles from "./page.module.css";

export default function Home() {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
    try {
      await createVideo(url);
      const updated = await listVideos();
      setVideos(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

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

      <div className={styles.page}>
        {/* Hero */}
        <header className={styles.hero}>
          <div className={styles.heroGlow} />
          <h1 className={styles.heading}>
            <span className={styles.headingLine}>YouTube</span>
            <span className={`${styles.headingLine} gradient-text`}>
              Knowledge Extractor
            </span>
          </h1>
          <p className={styles.subtitle}>
            Paste a video link. Get a structured summary in seconds.
          </p>

          <VideoInput onSubmit={handleSubmit} disabled={loading} />

          {error && <p className={styles.error}>{error}</p>}
        </header>

        {/* Toolbar */}
        {videos.length > 0 && (
          <div className={styles.toolbar}>
            <SearchBar value={search} onChange={setSearch} />
            <span className={styles.count}>
              {filtered.length} {filtered.length === 1 ? "video" : "videos"}
            </span>
          </div>
        )}

        {/* Grid */}
        {!initialLoad && filtered.length > 0 && (
          <section className={styles.grid}>
            {filtered.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} />
            ))}
          </section>
        )}

        {/* Empty states */}
        {!initialLoad && videos.length === 0 && !loading && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📚</div>
            <h2 className={styles.emptyTitle}>No videos yet</h2>
            <p className={styles.emptyText}>
              Paste a YouTube URL above to extract your first knowledge summary.
            </p>
          </div>
        )}

        {!initialLoad &&
          videos.length > 0 &&
          filtered.length === 0 &&
          search && (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔍</div>
              <h2 className={styles.emptyTitle}>No matches</h2>
              <p className={styles.emptyText}>
                Try a different search term.
              </p>
            </div>
          )}
      </div>
    </>
  );
}
