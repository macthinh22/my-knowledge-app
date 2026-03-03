import Link from "next/link";
import Image from "next/image";
import { Clock, Play } from "lucide-react";
import { KeywordChips } from "@/components/KeywordChips";
import { VideoActionDropdown } from "@/components/VideoActionDropdown";
import { Badge } from "@/components/ui/badge";
import type { Category, CollectionItem, VideoListItem } from "@/lib/api";
import { categoryLabel, getCategoryBadgeClass } from "@/lib/categories";
import { formatDuration } from "@/lib/format";

interface VideoCardProps {
  video: VideoListItem;
  categoryNameMap?: Record<string, string>;
  categories: Category[];
  collections: CollectionItem[];
  selectedCollectionIds: Set<string>;
  onCategoryChange: (category: string | null) => Promise<void>;
  onCollectionToggle: (collectionId: string, checked: boolean) => Promise<void>;
  onDelete: () => void;
  actionsDisabled?: boolean;
}

export function VideoCard({
  video,
  categoryNameMap,
  categories,
  collections,
  selectedCollectionIds,
  onCategoryChange,
  onCollectionToggle,
  onDelete,
  actionsDisabled,
}: VideoCardProps) {
  const thumbnail = video.thumbnail_url
    ?? `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;

  return (
    <div className="group relative h-full">
      <Link href={`/video/${video.id}`} className="group/link block h-full">
        <div className="flex h-full flex-col overflow-hidden rounded-lg bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div className="relative aspect-video flex-none overflow-hidden">
            <Image
              src={thumbnail}
              alt={video.title ?? "Video thumbnail"}
              fill
              className="object-cover transition-transform duration-200 group-hover/link:scale-105"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {video.duration && (
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                <Clock className="h-3 w-3" />
                {formatDuration(video.duration)}
              </span>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/link:bg-black/10">
              <Play className="h-10 w-10 text-white opacity-0 transition-opacity group-hover/link:opacity-80" fill="white" />
            </div>
          </div>

          <div className="flex flex-1 flex-col p-3">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug">
              {video.title ?? "Untitled"}
            </h3>
            {video.category && (
              <Badge
                variant="outline"
                className={`mt-1 ${getCategoryBadgeClass(video.category)}`}
              >
                {categoryLabel(video.category, categoryNameMap)}
              </Badge>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {video.channel_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(video.created_at).toLocaleDateString()}
            </p>
            <KeywordChips keywords={video.keywords} maxVisible={3} className="mt-auto pt-2" />
          </div>
        </div>
      </Link>

      <div className="absolute right-2 top-2 z-20 opacity-0 transition-all duration-150 group-hover:opacity-100 [&:has([data-state=open])]:opacity-100 hover:scale-110">
        <VideoActionDropdown
          categories={categories}
          currentCategory={video.category}
          collections={collections}
          selectedCollectionIds={selectedCollectionIds}
          onCategoryChange={onCategoryChange}
          onCollectionToggle={onCollectionToggle}
          onDelete={onDelete}
          disabled={actionsDisabled}
        />
      </div>
    </div>
  );
}
