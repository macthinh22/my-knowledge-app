import Link from "next/link";
import Image from "next/image";
import { Clock, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VideoListItem } from "@/lib/api";
import { formatDuration } from "@/lib/format";

interface VideoCardProps {
  video: VideoListItem;
}

export function VideoCard({ video }: VideoCardProps) {
  const thumbnail = video.thumbnail_url
    ?? `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;

  return (
    <Link href={`/video/${video.id}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-lg bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <div className="relative aspect-video flex-none overflow-hidden">
          <Image
            src={thumbnail}
            alt={video.title ?? "Video thumbnail"}
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {video.duration && (
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
              <Clock className="h-3 w-3" />
              {formatDuration(video.duration)}
            </span>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
            <Play className="h-10 w-10 text-white opacity-0 transition-opacity group-hover:opacity-80" fill="white" />
          </div>
        </div>

        <div className="flex flex-1 flex-col p-3">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">
            {video.title ?? "Untitled"}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {video.channel_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(video.created_at).toLocaleDateString()}
          </p>
          {video.keywords && video.keywords.length > 0 && (
            <div className="mt-auto flex flex-wrap gap-1 pt-2">
              {video.keywords.slice(0, 3).map((kw) => (
                <Badge key={kw} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {kw}
                </Badge>
              ))}
              {video.keywords.length > 3 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{video.keywords.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
