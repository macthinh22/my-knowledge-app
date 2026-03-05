"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VideoInput } from "@/components/VideoInput";
import { useExtraction } from "@/context/extraction";

export default function NewVideoPage() {
  const router = useRouter();
  const { extract, extraction, extractError } = useExtraction();

  const isExtracting = extraction !== null;

  const handleSubmit = async (url: string) => {
    const job = await extract(url);
    if (!job) return;

    if (job.status === "completed" && job.video_id) {
      router.replace(`/video/${job.video_id}`);
      return;
    }

    router.replace(`/video/${job.id}`);
  };

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

      <main className="flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-xl space-y-4">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold">Add a URL</h1>
            <p className="text-sm text-muted-foreground">
              Paste a YouTube link to extract knowledge from it.
            </p>
          </div>
          <VideoInput onSubmit={handleSubmit} isLoading={isExtracting} />
          {extractError && <p className="text-center text-sm text-destructive">{extractError}</p>}
        </div>
      </main>
    </div>
  );
}
