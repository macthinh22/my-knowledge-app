"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpDown, Loader2, SearchX } from "lucide-react";
import { ResourceListItem } from "@/components/ResourceListItem";
import type { SortOption } from "@/components/Toolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePaginatedVideos } from "@/hooks/usePaginatedVideos";
import {
  addVideoToCollection,
  deleteVideo,
  getCollection,
  listCategories,
  listCollections,
  removeVideoFromCollection,
  updateVideoCategory,
  type Category,
  type CollectionItem,
  type VideoListItem,
} from "@/lib/api";

export default function BrowsePage() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") ?? "";
  const categorySlug = searchParams.get("category");
  const tagFilter = searchParams.get("tag");
  const collectionId = searchParams.get("collection");
  const initialSort =
    (searchParams.get("sort") as SortOption | null) ?? "created_at_desc";

  const [sortOption, setSortOption] = useState<SortOption>(initialSort);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [videoCollectionMap, setVideoCollectionMap] = useState<
    Record<string, Set<string>>
  >({});
  const [deletedVideoIds, setDeletedVideoIds] = useState<Set<string>>(new Set());
  const [videoPendingDelete, setVideoPendingDelete] =
    useState<VideoListItem | null>(null);

  const [sortBy, sortOrder] = useMemo(() => {
    const lastUnderscore = sortOption.lastIndexOf("_");
    return [
      sortOption.slice(0, lastUnderscore),
      sortOption.slice(lastUnderscore + 1),
    ] as [string, "asc" | "desc"];
  }, [sortOption]);

  const { videos, total, loading, loadingMore, hasMore, loadMore, refresh } =
    usePaginatedVideos({
      search: searchQuery || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      category: categorySlug ?? undefined,
      tag: tagFilter ?? undefined,
      collection_id: collectionId ?? undefined,
    });

  const filtered = useMemo(
    () => videos.filter((video) => !deletedVideoIds.has(video.id)),
    [videos, deletedVideoIds],
  );

  useEffect(() => {
    listCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const refreshCollections = useCallback(async () => {
    const nextCollections = await listCollections().catch(
      () => [] as CollectionItem[],
    );
    setCollections(nextCollections);

    const details = await Promise.all(
      nextCollections.map((collection) =>
        getCollection(collection.id).catch(() => null),
      ),
    );

    const nextMembership: Record<string, Set<string>> = {};
    details.forEach((detail, index) => {
      if (!detail) return;
      detail.video_ids.forEach((videoId) => {
        if (!nextMembership[videoId]) {
          nextMembership[videoId] = new Set();
        }
        nextMembership[videoId].add(nextCollections[index].id);
      });
    });

    setVideoCollectionMap(nextMembership);
  }, []);

  useEffect(() => {
    void refreshCollections();
  }, [refreshCollections]);

  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.slug, category.name])),
    [categories],
  );

  const pageTitle = useMemo(() => {
    if (categorySlug) {
      return categoryNameMap[categorySlug] ?? categorySlug;
    }

    if (tagFilter) {
      return `#${tagFilter}`;
    }

    if (collectionId) {
      const collection = collections.find((item) => item.id === collectionId);
      return collection?.name ?? "Collection";
    }

    if (searchQuery) {
      return `Search: \"${searchQuery}\"`;
    }

    return "All Resources";
  }, [categorySlug, categoryNameMap, collections, collectionId, searchQuery, tagFilter]);

  const handleDelete = async () => {
    if (!videoPendingDelete) {
      return;
    }

    setDeletedVideoIds((previous) => new Set(previous).add(videoPendingDelete.id));
    setVideoPendingDelete(null);

    try {
      await deleteVideo(videoPendingDelete.id);
      refresh();
      void refreshCollections();
    } catch {}
  };

  const sortLabels: Record<SortOption, string> = {
    created_at_desc: "Newest",
    created_at_asc: "Oldest",
    title_asc: "Title A-Z",
    title_desc: "Title Z-A",
    duration_desc: "Longest",
    duration_asc: "Shortest",
    channel_name_asc: "Source A-Z",
  };

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const showCategory = !categorySlug;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{total} items</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="mr-2 h-3.5 w-3.5" />
                {sortLabels[sortOption] ?? "Sort"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {Object.entries(sortLabels).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setSortOption(key as SortOption)}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <SearchX className="h-10 w-10" />
            <p>No items found</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((video) => (
              <ResourceListItem
                key={video.id}
                video={video}
                categoryNameMap={categoryNameMap}
                categories={categories}
                collections={collections}
                selectedCollectionIds={videoCollectionMap[video.id] ?? new Set()}
                onCategoryChange={async (category) => {
                  await updateVideoCategory(video.id, category);
                  refresh();
                }}
                onCollectionToggle={async (nextCollectionId, checked) => {
                  if (checked) {
                    await addVideoToCollection(nextCollectionId, video.id);
                  } else {
                    await removeVideoFromCollection(nextCollectionId, video.id);
                  }
                  void refreshCollections();
                }}
                onDelete={() => setVideoPendingDelete(video)}
                showCategory={showCategory}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="flex justify-center py-8">
          {loadingMore && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      <Dialog
        open={videoPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVideoPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete resource?</DialogTitle>
            <DialogDescription>
              &quot;{videoPendingDelete?.title}&quot; will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
