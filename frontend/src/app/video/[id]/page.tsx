"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { VideoDetail } from "@/components/VideoDetail";
import { DeleteButton } from "@/components/DeleteButton";
import {
  getVideo,
  getVideoJob,
  listCategories,
  updateVideoCategory,
  isApiRequestError,
  type Category,
  type Video,
  type VideoJob,
} from "@/lib/api";
import { categoryLabel, getCategoryBadgeClass } from "@/lib/categories";
import { formatDuration } from "@/lib/format";
import { useExtraction } from "@/context/extraction";
import {
  POLLING_BASE_INTERVAL_MS,
  POLLING_MAX_FAILURES,
  POLLING_MAX_INTERVAL_MS,
  getPollingBackoffDelayMs,
} from "@/lib/polling";

const ACTIVE_JOB_STATUSES = new Set(["queued", "processing"]);

export default function VideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { setVideos } = useExtraction();
  const [video, setVideo] = useState<Video | null>(null);
  const [job, setJob] = useState<VideoJob | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [savingCategory, setSavingCategory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const items = await listCategories();
        if (!cancelled) {
          setCategories(items);
        }
      } catch {
        if (!cancelled) {
          setCategories([]);
        }
      }
    };

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryNameMap = Object.fromEntries(
    categories.map((category) => [category.slug, category.name]),
  );

  const syncVideoInLibrary = useCallback((updatedVideo: Video) => {
    setVideos((previous) => {
      const existingIndex = previous.findIndex((item) => item.id === updatedVideo.id);
      if (existingIndex === -1) {
        return previous;
      }

      return previous.map((item) =>
        item.id === updatedVideo.id ? { ...item, ...updatedVideo } : item,
      );
    });
  }, [setVideos]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      setVideo(null);
      setJob(null);

      try {
        const loadedVideo = await getVideo(id);
        if (!cancelled) {
          setVideo(loadedVideo);
          syncVideoInLibrary(loadedVideo);
        }
        return;
      } catch (videoError) {
        if (!isApiRequestError(videoError) || videoError.status !== 404) {
          if (!cancelled) {
            setError("Failed to load video");
          }
          return;
        }
      }

      try {
        const loadedJob = await getVideoJob(id);
        if (cancelled) {
          return;
        }

        if (loadedJob.status === "completed" && loadedJob.video_id) {
          const loadedVideo = await getVideo(loadedJob.video_id);
          if (cancelled) {
            return;
          }
          setVideo(loadedVideo);
          syncVideoInLibrary(loadedVideo);
          router.replace(`/video/${loadedJob.video_id}`);
          return;
        }

        if (ACTIVE_JOB_STATUSES.has(loadedJob.status)) {
          setJob(loadedJob);
          return;
        }

        setError(loadedJob.error_message || "Extraction failed");
      } catch (jobError) {
        if (!cancelled) {
          if (isApiRequestError(jobError) && jobError.status === 404) {
            setError("Video not found");
          } else {
            setError("Failed to load video");
          }
        }
      }
    };

    void load().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id, router, syncVideoInLibrary]);

  useEffect(() => {
    if (!job || !ACTIVE_JOB_STATUSES.has(job.status)) {
      return;
    }

    let cancelled = false;
    let timeoutRef: ReturnType<typeof setTimeout> | null = null;
    let currentDelay = POLLING_BASE_INTERVAL_MS;
    let failureCount = 0;

    const scheduleNext = () => {
      if (cancelled) {
        return;
      }
      timeoutRef = setTimeout(() => {
        void poll();
      }, currentDelay);
    };

    const poll = async () => {
      try {
        const latest = await getVideoJob(job.id);
        if (cancelled) {
          return;
        }

        failureCount = 0;
        currentDelay = POLLING_BASE_INTERVAL_MS;
        setError("");

        if (latest.status === "completed" && latest.video_id) {
          const loadedVideo = await getVideo(latest.video_id);
          if (cancelled) {
            return;
          }
          setVideo(loadedVideo);
          syncVideoInLibrary(loadedVideo);
          setJob(null);
          setError("");
          router.replace(`/video/${latest.video_id}`);
          return;
        }

        if (latest.status === "failed") {
          setJob(null);
          setError(latest.error_message || "Extraction failed");
          return;
        }

        if (ACTIVE_JOB_STATUSES.has(latest.status)) {
          setJob(latest);
          scheduleNext();
        }
      } catch {
        if (cancelled) {
          return;
        }

        failureCount += 1;

        if (failureCount >= POLLING_MAX_FAILURES) {
          setError("Failed to refresh extraction status");
          currentDelay = POLLING_MAX_INTERVAL_MS;
          scheduleNext();
          return;
        }

        currentDelay = getPollingBackoffDelayMs(failureCount);
        scheduleNext();
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    };
  }, [job, router, syncVideoInLibrary]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/5">
            <Skeleton className="aspect-video w-full rounded-lg" />
            <Skeleton className="mt-4 h-6 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
          <div className="lg:w-3/5 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (job && !video) {
    const totalSteps = Math.max(job.total_steps, 1);
    const stepNumber = Math.min(job.current_step + 1, totalSteps);
    const progress = (stepNumber / totalSteps) * 100;

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to library
          </Link>
        </header>

        <div className="flex flex-col gap-6 p-6 lg:flex-row">
          <div className="space-y-4 lg:w-2/5 lg:sticky lg:top-6 lg:self-start">
            <YouTubeEmbed youtubeId={job.youtube_id} title="Processing video" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="space-y-2 pt-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Step {stepNumber} of {totalSteps} - {job.step_label}...
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>

          <div className="space-y-6 lg:w-3/5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
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
        <div className="lg:w-2/5">
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

              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Category
                </p>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={video.category ?? ""}
                  disabled={savingCategory}
                  onChange={async (e) => {
                    const nextCategory = e.target.value || null;
                    setSavingCategory(true);
                    try {
                      const updated = await updateVideoCategory(video.id, nextCategory);
                      setVideo(updated);
                      syncVideoInLibrary(updated);
                    } catch (updateError) {
                      const message =
                        updateError instanceof Error
                          ? updateError.message
                          : "Failed to update category";
                      setError(message);
                    } finally {
                      setSavingCategory(false);
                    }
                  }}
                >
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>

                {video.category && (
                  <Badge
                    variant="outline"
                    className={getCategoryBadgeClass(video.category)}
                  >
                    {categoryLabel(video.category, categoryNameMap)}
                  </Badge>
                )}
              </div>

              <Separator className="my-4" />

              <DeleteButton videoId={video.id} videoTitle={video.title} />
            </div>
          </div>
        </div>

        {/* Right panel - analysis + notes */}
        <div className="lg:w-3/5">
          <VideoDetail video={video} />
        </div>
      </div>
    </div>
  );
}
