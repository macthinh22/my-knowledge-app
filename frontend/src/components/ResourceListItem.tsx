"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { KeywordChips } from "@/components/KeywordChips";
import { VideoActionDropdown } from "@/components/VideoActionDropdown";
import { Badge } from "@/components/ui/badge";
import type { Category, CollectionItem, VideoListItem } from "@/lib/api";
import {
  buildCategoryColorMap,
  categoryLabel,
  getCategoryBadgeClass,
} from "@/lib/categories";
import { formatDuration } from "@/lib/format";

interface ResourceListItemProps {
  video: VideoListItem;
  categoryNameMap?: Record<string, string>;
  categories: Category[];
  collections: CollectionItem[];
  selectedCollectionIds: Set<string>;
  onCategoryChange: (category: string | null) => Promise<void>;
  onCollectionToggle: (collectionId: string, checked: boolean) => Promise<void>;
  onDelete: () => void;
  showCategory?: boolean;
  actionsDisabled?: boolean;
}

export function ResourceListItem({
  video,
  categoryNameMap,
  categories,
  collections,
  selectedCollectionIds,
  onCategoryChange,
  onCollectionToggle,
  onDelete,
  showCategory = true,
  actionsDisabled,
}: ResourceListItemProps) {
  const categoryColorMap = buildCategoryColorMap(categories);

  return (
    <div className="group flex items-center gap-2 rounded-xl border border-transparent px-4 py-3 transition-colors hover:bg-accent/60">
      <Link href={`/video/${video.id}`} className="flex min-w-0 flex-1 items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-sm font-medium leading-snug">{video.title ?? "Untitled"}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {video.channel_name && <span>{video.channel_name}</span>}
            {video.channel_name && <span>&middot;</span>}
            {showCategory && video.category && (
              <Badge
                variant="outline"
                className={`px-1.5 py-0 text-[10px] ${getCategoryBadgeClass(categoryColorMap[video.category])}`}
              >
                {categoryLabel(video.category, categoryNameMap)}
              </Badge>
            )}
            <KeywordChips keywords={video.keywords} maxVisible={3} />
            {video.duration != null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(video.duration)}
              </span>
            )}
            <span>
              {formatDistanceToNowStrict(new Date(video.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </Link>
      <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 [&:has([data-state=open])]:opacity-100">
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
