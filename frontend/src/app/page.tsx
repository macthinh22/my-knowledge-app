"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, VideoOff, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toolbar } from "@/components/Toolbar";
import { PendingVideoCard } from "@/components/PendingVideoCard";
import { VideoCard } from "@/components/VideoCard";
import { VideoListItem } from "@/components/VideoListItem";
import { useExtraction } from "@/context/extraction";
import { listCategories, listVideos, type Category, type TagSummary } from "@/lib/api";

function normalizeTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function HomePage() {
  const {
    activeJob,
    videos,
    setVideos,
    loadingVideos: loading,
    extractError: error,
    extractInfo: info,
  } = useExtraction();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [keywordFilterMode, setKeywordFilterMode] = useState<"all" | "any">("all");

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const items = await listCategories();
        if (!cancelled) {
          setCategories(items);
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      }
    };

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  const allKeywords = useMemo<TagSummary[]>(() => {
    const map = new Map<string, { usage: number; lastUsed: string }>();
    videos.forEach((video) => {
      const lastUsed = video.updated_at || video.created_at;
      (video.keywords ?? []).forEach((keyword) => {
        const normalized = normalizeTag(keyword);
        if (!normalized) {
          return;
        }

        const current = map.get(normalized);
        if (!current) {
          map.set(normalized, { usage: 1, lastUsed });
          return;
        }
        map.set(normalized, {
          usage: current.usage + 1,
          lastUsed: lastUsed > current.lastUsed ? lastUsed : current.lastUsed,
        });
      });
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1].usage - a[1].usage || a[0].localeCompare(b[0]))
      .map(([tag, meta]) => ({
        tag,
        usage_count: meta.usage,
        last_used_at: meta.lastUsed,
        aliases: [],
      }));
  }, [videos]);

  const filtered = useMemo(() => {
    let result = videos;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.title?.toLowerCase().includes(q) ||
          v.channel_name?.toLowerCase().includes(q) ||
          v.keywords?.some((kw) => kw.toLowerCase().includes(q)),
      );
    }
    if (selectedKeywords.length > 0) {
      result = result.filter((v) => {
        const tags = new Set((v.keywords ?? []).map(normalizeTag));
        if (keywordFilterMode === "any") {
          return selectedKeywords.some((kw) => tags.has(kw));
        }
        return selectedKeywords.every((kw) => tags.has(kw));
      });
    }
    if (selectedCategory) {
      result = result.filter((v) => v.category === selectedCategory);
    }
    return result;
  }, [videos, search, selectedKeywords, keywordFilterMode, selectedCategory]);

  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.slug, category.name])),
    [categories],
  );

  const categoryVideoCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    videos.forEach((video) => {
      if (!video.category) {
        return;
      }
      counts[video.category] = (counts[video.category] ?? 0) + 1;
    });
    return counts;
  }, [videos]);

  const refreshAfterTagMutation = useCallback(async () => {
    const videosList = await listVideos();
    setVideos(videosList);
    const validTags = new Set(
      videosList.flatMap((video) => (video.keywords ?? []).map(normalizeTag)),
    );
    setSelectedKeywords((prev) => prev.filter((kw) => validTags.has(kw)));
  }, [setVideos]);

  const refreshCategories = useCallback(async (deletedSlug?: string) => {
    if (deletedSlug) {
      setCategories((prev) => prev.filter((category) => category.slug !== deletedSlug));
      setVideos((prev) =>
        prev.map((video) =>
          video.category === deletedSlug ? { ...video, category: null } : video,
        ),
      );
      setSelectedCategory((prev) => (prev === deletedSlug ? null : prev));
    }

    const [videosResult, categoriesResult] = await Promise.allSettled([
      listVideos(),
      listCategories(),
    ]);

    if (videosResult.status === "fulfilled") {
      const nextVideos = deletedSlug
        ? videosResult.value.map((video) =>
            video.category === deletedSlug ? { ...video, category: null } : video,
          )
        : videosResult.value;
      setVideos(nextVideos);
    }

    if (categoriesResult.status === "fulfilled") {
      const categoryList = deletedSlug
        ? categoriesResult.value.filter((category) => category.slug !== deletedSlug)
        : categoriesResult.value;
      setCategories(categoryList);
      if (
        selectedCategory &&
        !categoryList.some((category) => category.slug === selectedCategory)
      ) {
        setSelectedCategory(null);
      }
    }
  }, [selectedCategory, setVideos]);

  return (
    <div className="min-h-screen bg-background">
      <Toolbar
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        availableTags={allKeywords}
        availableCategories={categories}
        categoryVideoCounts={categoryVideoCounts}
        selectedCategory={selectedCategory}
        selectedKeywords={selectedKeywords}
        onCategoryChange={setSelectedCategory}
        onKeywordsChange={setSelectedKeywords}
        keywordFilterMode={keywordFilterMode}
        onKeywordFilterModeChange={setKeywordFilterMode}
        onTagDataChanged={refreshAfterTagMutation}
        onCategoryDataChanged={refreshCategories}
      />

      <main className="px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {filtered.length} video{filtered.length !== 1 ? "s" : ""}
            </h1>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-muted-foreground">{info}</p>}
          </div>
          <Button asChild>
            <Link href="/video/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Video
            </Link>
          </Button>
        </div>

        {loading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!loading && videos.length === 0 && !activeJob && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <VideoOff className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium">No videos yet</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Add your first YouTube video to start building your knowledge base.
            </p>
            <Button asChild>
              <Link href="/video/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Video
              </Link>
            </Button>
          </div>
        )}

        {!loading && videos.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium">No matches</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search term or clear your filters.
            </p>
          </div>
        )}

        {!loading && (filtered.length > 0 || activeJob) && view === "grid" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-stretch gap-4">
            {activeJob && <PendingVideoCard job={activeJob} view="grid" />}
            {filtered.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                categoryNameMap={categoryNameMap}
              />
            ))}
          </div>
        )}

        {!loading && (filtered.length > 0 || activeJob) && view === "list" && (
          <div className="space-y-1">
            {activeJob && <PendingVideoCard job={activeJob} view="list" />}
            {filtered.map((video) => (
              <VideoListItem
                key={video.id}
                video={video}
                categoryNameMap={categoryNameMap}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
