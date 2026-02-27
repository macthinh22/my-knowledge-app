"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { VideoDetail } from "@/components/VideoDetail";
import { DeleteButton } from "@/components/DeleteButton";
import { getVideo, type Video } from "@/lib/api";
import { formatDuration } from "@/lib/format";

export default function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getVideo(id)
      .then(setVideo)
      .catch(() => setError("Failed to load video"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-3/5">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="mt-4 h-6 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
          <div className="lg:w-2/5 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <p className="text-destructive mb-4">{error || "Video not found"}</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Back to library
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to library
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 p-6">
        {/* Left panel - player + metadata */}
        <div className="lg:w-3/5">
          <div className="lg:sticky lg:top-6">
            <YouTubeEmbed youtubeId={video.youtube_id} title={video.title ?? "Video"} />

            <div className="mt-4">
              <h1 className="text-xl font-semibold">{video.title ?? "Untitled"}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {video.channel_name && <span>{video.channel_name}</span>}
                {video.duration && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(video.duration)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(video.created_at).toLocaleDateString()}
                </span>
              </div>

              {video.keywords && video.keywords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {video.keywords.map((kw) => (
                    <Badge key={kw} variant="secondary">
                      {kw}
                    </Badge>
                  ))}
                </div>
              )}

              <Separator className="my-4" />

              <DeleteButton videoId={video.id} videoTitle={video.title} />
            </div>
          </div>
        </div>

        {/* Right panel - analysis + notes */}
        <div className="lg:w-2/5">
          <VideoDetail video={video} />
        </div>
      </div>
    </div>
  );
}
