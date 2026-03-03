"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, VideoOff, SearchX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toolbar } from "@/components/Toolbar";
import { PendingVideoCard } from "@/components/PendingVideoCard";
import { RecentlyAdded } from "@/components/RecentlyAdded";
import { VideoCard } from "@/components/VideoCard";
import { VideoListItem as VideoListItemComponent } from "@/components/VideoListItem";
import { useExtraction } from "@/context/extraction";
import {
  addVideoToCollection,
  deleteVideo,
  getCollection,
  listCategories,
  listCollections,
  listTags,
  removeVideoFromCollection,
  updateVideoCategory,
  type Category,
  type CollectionItem,
  type TagSummary,
  type VideoListItem,
} from "@/lib/api";
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
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [videoCollectionMap, setVideoCollectionMap] = useState<Record<string, Set<string>>>({});
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string | null>>({});
  const [deletedVideoIds, setDeletedVideoIds] = useState<Set<string>>(new Set());
  const [videoPendingDelete, setVideoPendingDelete] = useState<VideoListItem | null>(null);
  const [deletingVideo, setDeletingVideo] = useState(false);

  const {
    videos,
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

  const filtered = useMemo(
    () => videos
      .filter((video) => !deletedVideoIds.has(video.id))
      .map((video) => {
        if (!(video.id in categoryOverrides)) return video;
        return {
          ...video,
          category: categoryOverrides[video.id],
        };
      }),
    [videos, deletedVideoIds, categoryOverrides],
  );

  const visibleTotal = total - (videos.length - filtered.length);
  const hasActiveLibraryFilters = Boolean(search.trim())
    || selectedKeywords.length > 0
    || selectedCategory !== null
    || selectedCollection !== null
    || reviewStatus !== null;

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    listTags({ limit: 200 }).then(setAllKeywords).catch(() => setAllKeywords([]));
  }, []);

  const refreshCollectionsAndMembership = useCallback(async () => {
    try {
      const nextCollections = await listCollections();
      setCollections(nextCollections);

      const collectionDetails = await Promise.all(
        nextCollections.map((collection) => getCollection(collection.id).catch(() => null)),
      );

      const nextMembership: Record<string, Set<string>> = {};
      collectionDetails.forEach((detail, index) => {
        if (!detail) return;
        const collectionId = nextCollections[index]?.id;
        if (!collectionId) return;
        detail.video_ids.forEach((videoId) => {
          if (!nextMembership[videoId]) {
            nextMembership[videoId] = new Set();
          }
          nextMembership[videoId].add(collectionId);
        });
      });
      setVideoCollectionMap(nextMembership);
    } catch {
      setCollections([]);
      setVideoCollectionMap({});
    }
  }, []);

  useEffect(() => {
    void refreshCollectionsAndMembership();
  }, [refreshCollectionsAndMembership]);

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

  const handleVideoCategoryChange = useCallback(
    async (videoId: string, category: string | null) => {
      await updateVideoCategory(videoId, category);
      setCategoryOverrides((prev) => ({
        ...prev,
        [videoId]: category,
      }));
    },
    [],
  );

  const handleVideoCollectionToggle = useCallback(
    async (videoId: string, collectionId: string, checked: boolean) => {
      if (checked) {
        await addVideoToCollection(collectionId, videoId);
      } else {
        await removeVideoFromCollection(collectionId, videoId);
      }

      setVideoCollectionMap((prev) => {
        const next = { ...prev };
        const videoCollectionIds = new Set(next[videoId] ?? []);

        if (checked) {
          videoCollectionIds.add(collectionId);
        } else {
          videoCollectionIds.delete(collectionId);
        }

        if (videoCollectionIds.size === 0) {
          delete next[videoId];
        } else {
          next[videoId] = videoCollectionIds;
        }

        return next;
      });
    },
    [],
  );

  const handleDeleteVideoConfirm = useCallback(async () => {
    if (!videoPendingDelete) return;

    setDeletingVideo(true);
    try {
      await deleteVideo(videoPendingDelete.id);

      setDeletedVideoIds((prev) => {
        const next = new Set(prev);
        next.add(videoPendingDelete.id);
        return next;
      });

      setCategoryOverrides((prev) => {
        if (!(videoPendingDelete.id in prev)) return prev;
        const next = { ...prev };
        delete next[videoPendingDelete.id];
        return next;
      });

      setVideoCollectionMap((prev) => {
        if (!prev[videoPendingDelete.id]) return prev;
        const next = { ...prev };
        delete next[videoPendingDelete.id];
        return next;
      });

      setVideoPendingDelete(null);
      refreshVideos();
      void refreshCollectionsAndMembership();
    } finally {
      setDeletingVideo(false);
    }
  }, [videoPendingDelete, refreshVideos, refreshCollectionsAndMembership]);

  const closeDeleteDialog = useCallback((open: boolean) => {
    if (!open && !deletingVideo) {
      setVideoPendingDelete(null);
    }
  }, [deletingVideo]);

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
      />

      <div className="flex flex-1">
        <CollectionsSidebar
          selectedCollection={selectedCollection}
          onCollectionChange={setSelectedCollection}
          onCollectionsChanged={refreshCollectionsAndMembership}
        />
      <main className="flex-1 px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
              <h1 className="text-lg font-semibold">
               {visibleTotal > 0
                 ? `Showing ${filtered.length} of ${visibleTotal} videos`
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

        {!hasActiveLibraryFilters && (
          <RecentlyAdded
            refreshKey={deletedVideoIds.size}
            categoryNameMap={categoryNameMap}
            categories={categories}
            collections={collections}
            selectedCollectionMap={videoCollectionMap}
            onCategoryChange={handleVideoCategoryChange}
            onCollectionToggle={handleVideoCollectionToggle}
            onDelete={(video) => setVideoPendingDelete(video)}
          />
        )}

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
                categories={categories}
                collections={collections}
                selectedCollectionIds={videoCollectionMap[video.id] ?? new Set()}
                onCategoryChange={(category) => handleVideoCategoryChange(video.id, category)}
                onCollectionToggle={(collectionId, checked) => (
                  handleVideoCollectionToggle(video.id, collectionId, checked)
                )}
                onDelete={() => setVideoPendingDelete(video)}
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
                categories={categories}
                collections={collections}
                selectedCollectionIds={videoCollectionMap[video.id] ?? new Set()}
                onCategoryChange={(category) => handleVideoCategoryChange(video.id, category)}
                onCollectionToggle={(collectionId, checked) => (
                  handleVideoCollectionToggle(video.id, collectionId, checked)
                )}
                onDelete={() => setVideoPendingDelete(video)}
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

      <Dialog
        open={videoPendingDelete !== null}
        onOpenChange={closeDeleteDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete video?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{videoPendingDelete?.title ?? "Untitled"}&rdquo; and all associated notes and analysis. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVideoPendingDelete(null)}
              disabled={deletingVideo}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteVideoConfirm}
              disabled={deletingVideo || !videoPendingDelete}
            >
              {deletingVideo ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
