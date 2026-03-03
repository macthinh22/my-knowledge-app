import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import { KeywordChips } from "@/components/KeywordChips";
import { VideoActionDropdown } from "@/components/VideoActionDropdown";
import { Badge } from "@/components/ui/badge";
import type {
  Category,
  CollectionItem,
  VideoListItem as VideoType,
} from "@/lib/api";
import { categoryLabel, getCategoryBadgeClass } from "@/lib/categories";
import { formatDuration } from "@/lib/format";

interface VideoListItemProps {
  video: VideoType;
  categoryNameMap?: Record<string, string>;
  categories: Category[];
  collections: CollectionItem[];
  selectedCollectionIds: Set<string>;
  onCategoryChange: (category: string | null) => Promise<void>;
  onCollectionToggle: (collectionId: string, checked: boolean) => Promise<void>;
  onDelete: () => void;
  actionsDisabled?: boolean;
}

export function VideoListItem({
  video,
  categoryNameMap,
  categories,
  collections,
  selectedCollectionIds,
  onCategoryChange,
  onCollectionToggle,
  onDelete,
  actionsDisabled,
}: VideoListItemProps) {
  const thumbnail = video.thumbnail_url
    ?? `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;

  return (
    <div className="group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-accent">
      <Link href={`/video/${video.id}`} className="flex min-w-0 flex-1 gap-4">
        <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-md">
          <Image
            src={thumbnail}
            alt={video.title ?? "Video thumbnail"}
            fill
            className="object-cover"
            sizes="160px"
          />
          {video.duration && (
            <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium text-white">
              <Clock className="h-2.5 w-2.5" />
              {formatDuration(video.duration)}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="truncate text-sm font-medium">{video.title ?? "Untitled"}</h3>
          {video.category && (
            <Badge
              variant="outline"
              className={`mt-1 w-fit ${getCategoryBadgeClass(video.category)}`}
            >
              {categoryLabel(video.category, categoryNameMap)}
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            {video.channel_name} &middot; {new Date(video.created_at).toLocaleDateString()}
          </p>
          <KeywordChips keywords={video.keywords} maxVisible={4} className="mt-1" />
        </div>
      </Link>

      <div className="shrink-0">
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
