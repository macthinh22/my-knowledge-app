"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, VideoOff, SearchX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Toolbar } from "@/components/Toolbar";
import { PendingVideoCard } from "@/components/PendingVideoCard";
import { VideoCard } from "@/components/VideoCard";
import { VideoListItem as VideoListItemComponent } from "@/components/VideoListItem";
import { useExtraction } from "@/context/extraction";
import { listCategories, listTags, type Category, type TagSummary } from "@/lib/api";
import { usePaginatedVideos } from "@/hooks/usePaginatedVideos";
import { CollectionsSidebar } from "@/components/CollectionsSidebar";
import type { SortOption } from "@/components/Toolbar";


function LoadMoreTrigger({
  onVisible,
  hasMore,
  loadingMore,
}: {
  onVisible: () => void;
  hasMore: boolean;
  loadingMore: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible();
      },
      { rootMargin: "200px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onVisible, hasMore]);

  return (
    <div ref={ref} className="flex justify-center py-8">
      {loadingMore && (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

export default function HomePage() {
  const {
    activeJob,
    extractError: error,
    extractInfo: info,
  } = useExtraction();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [keywordFilterMode, setKeywordFilterMode] = useState<"all" | "any">("all");
  const [allKeywords, setAllKeywords] = useState<TagSummary[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>("created_at_desc");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);

  const {
    videos: filtered,
    total,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh: refreshVideos,
  } = usePaginatedVideos({
    search: search || undefined,
    tag: selectedKeywords.length ? selectedKeywords.join(",") : undefined,
    tag_mode: keywordFilterMode,
    category: selectedCategory || undefined,
    sort_by: sortOption.replace(/_(?:asc|desc)$/, ""),
    sort_order: sortOption.endsWith("_asc") ? "asc" : "desc",
    collection_id: selectedCollection || undefined,
    review_status: reviewStatus || undefined,
  });

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    listTags({ limit: 200 }).then(setAllKeywords).catch(() => setAllKeywords([]));
  }, []);

  const refreshTags = useCallback(() => {
    listTags({ limit: 200 }).then(setAllKeywords).catch(() => setAllKeywords([]));
  }, []);

  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.slug, c.name])),
    [categories],
  );

  const categoryVideoCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((video) => {
      if (!video.category) return;
      counts[video.category] = (counts[video.category] ?? 0) + 1;
    });
    return counts;
  }, [filtered]);

  const refreshAfterTagMutation = useCallback(async () => {
    refreshTags();
    refreshVideos();
    const tags = await listTags({ limit: 200 });
    const validTagNames = new Set(tags.map((t) => t.tag));
    setSelectedKeywords((prev) => prev.filter((kw) => validTagNames.has(kw)));
  }, [refreshTags, refreshVideos]);

  const refreshCategories = useCallback(
    async (deletedSlug?: string) => {
      if (deletedSlug) {
        setCategories((prev) => prev.filter((c) => c.slug !== deletedSlug));
        setSelectedCategory((prev) => (prev === deletedSlug ? null : prev));
      }
      const [cats] = await Promise.all([
        listCategories().catch(() => categories),
      ]);
      setCategories(cats);
      refreshVideos();
    },
    [categories, refreshVideos],
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Toolbar
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        sortOption={sortOption}
        onSortChange={setSortOption}
        availableTags={allKeywords}
        availableCategories={categories}
        categoryVideoCounts={categoryVideoCounts}
        selectedCategory={selectedCategory}
        selectedKeywords={selectedKeywords}
        onCategoryChange={setSelectedCategory}
        onKeywordsChange={setSelectedKeywords}
        keywordFilterMode={keywordFilterMode}
        onKeywordFilterModeChange={setKeywordFilterMode}
        reviewStatus={reviewStatus}
        onReviewStatusChange={setReviewStatus}
        onTagDataChanged={refreshAfterTagMutation}
        onCategoryDataChanged={refreshCategories}
      />

      <div className="flex flex-1">
        <CollectionsSidebar
          selectedCollection={selectedCollection}
          onCollectionChange={setSelectedCollection}
        />
      <main className="flex-1 px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {total > 0
                ? `Showing ${filtered.length} of ${total} videos`
                : loading
                  ? ""
                  : "No videos found"}
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

        {!loading && total === 0 && !activeJob && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {search || selectedKeywords.length > 0 || selectedCategory ? (
              <>
                <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-lg font-medium">No matches</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different search term or clear your filters.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
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
              <VideoListItemComponent
                key={video.id}
                video={video}
                categoryNameMap={categoryNameMap}
              />
            ))}
          </div>
        )}

        {!loading && (
          <LoadMoreTrigger
            onVisible={loadMore}
            hasMore={hasMore}
            loadingMore={loadingMore}
          />
        )}
      </main>
      </div>
    </div>
  );
}
