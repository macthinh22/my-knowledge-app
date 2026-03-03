"use client";

import { useEffect, useState } from "react";
import { VideoCard } from "@/components/VideoCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listVideos,
  type Category,
  type CollectionItem,
  type VideoListItem,
} from "@/lib/api";

interface RecentlyAddedProps {
  refreshKey: number;
  categoryNameMap: Record<string, string>;
  categories: Category[];
  collections: CollectionItem[];
  selectedCollectionMap: Record<string, Set<string>>;
  onCategoryChange: (videoId: string, category: string | null) => Promise<void>;
  onCollectionToggle: (
    videoId: string,
    collectionId: string,
    checked: boolean,
  ) => Promise<void>;
  onDelete: (video: VideoListItem) => void;
}

export function RecentlyAdded({
  refreshKey,
  categoryNameMap,
  categories,
  collections,
  selectedCollectionMap,
  onCategoryChange,
  onCollectionToggle,
  onDelete,
}: RecentlyAddedProps) {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchRecentlyAdded() {
      setLoading(true);
      try {
        const data = await listVideos({
          sort_by: "created_at",
          sort_order: "desc",
          limit: 10,
        });

        if (cancelled) return;

        setVideos(data.items);
        setFailed(false);
      } catch {
        if (cancelled) return;
        setVideos([]);
        setFailed(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchRecentlyAdded();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (failed || (!loading && videos.length === 0)) {
    return null;
  }

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold">Recently Added</h2>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-[280px] shrink-0 space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {videos.map((video) => (
            <div key={video.id} className="w-[280px] shrink-0">
              <VideoCard
                video={video}
                categoryNameMap={categoryNameMap}
                categories={categories}
                collections={collections}
                selectedCollectionIds={selectedCollectionMap[video.id] ?? new Set()}
                onCategoryChange={(category) => onCategoryChange(video.id, category)}
                onCollectionToggle={(collectionId, checked) => (
                  onCollectionToggle(video.id, collectionId, checked)
                )}
                onDelete={() => onDelete(video)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
