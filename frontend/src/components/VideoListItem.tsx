import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import { KeywordChips } from "@/components/KeywordChips";
import type { VideoListItem as VideoType } from "@/lib/api";
import { formatDuration } from "@/lib/format";

interface VideoListItemProps {
  video: VideoType;
}

export function VideoListItem({ video }: VideoListItemProps) {
  const thumbnail = video.thumbnail_url
    ?? `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;

  return (
    <Link
      href={`/video/${video.id}`}
      className="group flex gap-4 rounded-lg p-2 transition-colors hover:bg-accent"
    >
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

      <div className="flex flex-1 flex-col justify-center min-w-0">
        <h3 className="truncate text-sm font-medium">{video.title ?? "Untitled"}</h3>
        <p className="text-xs text-muted-foreground">
          {video.channel_name} &middot; {new Date(video.created_at).toLocaleDateString()}
        </p>
        <KeywordChips keywords={video.keywords} maxVisible={4} className="mt-1" />
      </div>
    </Link>
  );
}
