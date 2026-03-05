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
  const thumbnail = `https://img.youtube.com/vi/${job.youtube_id}/mqdefault.jpg`;
  const progress = getProgress(job);
  const totalSteps = Math.max(job.total_steps, 1);
  const stepNumber = Math.min(job.current_step + 1, totalSteps);

  if (view === "list") {
    return (
      <Link
        href={`/video/${job.id}`}
        className="group flex gap-4 rounded-lg border border-border/70 bg-card/40 p-2 transition-colors hover:bg-accent"
      >
        <div className="relative h-20 w-36 shrink-0 overflow-hidden rounded-md">
          <Image
            src={thumbnail}
            alt="Processing resource"
            fill
            className="object-cover opacity-70"
            sizes="160px"
          />
          <div className="absolute inset-0 grid place-items-center bg-black/35">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1.5">
            <p className="text-[11px] text-white">
              Step {stepNumber} of {totalSteps}: {job.step_label}
            </p>
            <Progress value={progress} className="mt-1 h-1 bg-white/25" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <p className="truncate text-sm font-medium">Extracting resource...</p>
          <p className="text-xs text-muted-foreground">Click to open live progress.</p>
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
            alt="Processing resource"
            fill
            className="object-cover opacity-70"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="text-sm font-medium text-white">{job.step_label}...</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2">
            <p className="text-xs text-white/90">
              Step {stepNumber} of {totalSteps}
            </p>
            <Progress value={progress} className="mt-1.5 h-1.5 bg-white/25" />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <p className="text-sm font-medium">Extracting resource...</p>
          <p className="text-xs text-muted-foreground">Click to open live progress.</p>
        </div>
      </div>
    </Link>
  );
}
