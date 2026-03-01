import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { VideoJob } from "@/lib/api";

interface PendingVideoCardProps {
  job: VideoJob;
  view?: "grid" | "list";
}

function getProgress(job: VideoJob) {
  const total = Math.max(job.total_steps, 1);
  const current = Math.min(job.current_step + 1, total);
  return Math.round((current / total) * 100);
}

export function PendingVideoCard({ job, view = "grid" }: PendingVideoCardProps) {
  const thumbnail = `https://i.ytimg.com/vi/${job.youtube_id}/hqdefault.jpg`;
  const progress = getProgress(job);
  const stepNumber = Math.min(job.current_step + 1, Math.max(job.total_steps, 1));

  if (view === "list") {
    return (
      <Link
        href={`/video/${job.id}`}
        className="group flex gap-4 rounded-lg border border-border/70 bg-card/40 p-2 transition-colors hover:bg-accent"
      >
        <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-md">
          <Image
            src={thumbnail}
            alt="Processing video"
            fill
            className="object-cover opacity-70"
            sizes="160px"
          />
          <div className="absolute inset-0 grid place-items-center bg-black/35">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <p className="truncate text-sm font-medium">Extracting video...</p>
          <p className="text-xs text-muted-foreground">
            Step {stepNumber} of {job.total_steps}: {job.step_label}
          </p>
          <Progress value={progress} className="h-1.5" />
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/video/${job.id}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/70 bg-card/40 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative aspect-video flex-none overflow-hidden">
          <Image
            src={thumbnail}
            alt="Processing video"
            fill
            className="object-cover opacity-70"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="text-sm font-medium text-white">{job.step_label}...</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <p className="text-sm font-medium">Extracting video...</p>
          <p className="text-xs text-muted-foreground">
            Step {stepNumber} of {job.total_steps}
          </p>
          <Progress value={progress} className="mt-auto h-1.5" />
        </div>
      </div>
    </Link>
  );
}
