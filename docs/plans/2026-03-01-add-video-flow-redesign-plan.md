# Add Video Flow Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change "Add Video" from an inline input on the home page to a dedicated `/video/new` page, with extraction progress shown as a skeleton on the `/video/[id]` detail page, and in-progress cards on the home page.

**Architecture:** `/video/new` is a minimal page with the URL input. On submit, it redirects to `/video/[id]` using the job ID. The detail page detects whether it's viewing a completed video or an in-progress job, showing a skeleton with YouTube embed + progress for active jobs. The home page shows a pending card in the grid for active extractions.

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS, ExtractionContext (existing)

---

### Task 1: Update ExtractionContext to expose `activeJob` and return job from `extract()`

**Files:**
- Modify: `frontend/src/context/extraction.tsx`

**Step 1: Change `extract()` return type and expose `activeJob`**

In `frontend/src/context/extraction.tsx`:

1. Change the `extract` function to return `Promise<VideoJob | null>` instead of `Promise<void>`. Add `return job;` at the end of the try block for both active and completed cases. Add `return null;` in the catch block.

2. Add `activeJob` to `ExtractionContextValue` interface:
```ts
interface ExtractionContextValue {
  extraction: Extraction | null;
  activeJob: VideoJob | null;  // add this
  extract: (url: string) => Promise<VideoJob | null>;  // change return type
  // ... rest unchanged
}
```

3. Add `activeJob` to the Provider value object.

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds (existing consumers of `extract()` ignore return value, so no breakage).

**Step 3: Commit**

```bash
git add frontend/src/context/extraction.tsx
git commit -m "feat: expose activeJob and return job from extract()"
```

---

### Task 2: Create `/video/new` page

**Files:**
- Create: `frontend/src/app/video/new/page.tsx`

**Step 1: Create the page**

Create `frontend/src/app/video/new/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VideoInput } from "@/components/VideoInput";
import { useExtraction } from "@/context/extraction";

export default function NewVideoPage() {
  const router = useRouter();
  const { extract, extraction } = useExtraction();
  const [error, setError] = useState("");

  const isExtracting = extraction !== null;

  const handleSubmit = async (url: string) => {
    setError("");
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
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to library
        </Link>
      </header>

      <main className="flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-xl space-y-4">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-semibold">Add a video</h1>
            <p className="text-sm text-muted-foreground">
              Paste a YouTube link to extract knowledge from it.
            </p>
          </div>
          <VideoInput onSubmit={handleSubmit} isLoading={isExtracting} />
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds. `/video/new` route is available.

**Step 3: Commit**

```bash
git add frontend/src/app/video/new/page.tsx
git commit -m "feat: add /video/new page with URL input"
```

---

### Task 3: Update home page — replace inline input with Link to `/video/new`

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Step 1: Replace inline input with Link**

1. Remove imports: `VideoInput`, `ExtractionProgress` (from LoadingState).
2. Remove state: `showInput`, and the `isExtracting` derived value.
3. Remove `handleExtract` function.
4. Remove the `extract` destructure from `useExtraction()` (no longer needed here).
5. Add import: `import Link from "next/link";`

6. Replace both "Add Video" buttons (lines 130-135 and 169-174) with:
```tsx
<Button asChild>
  <Link href="/video/new">
    <Plus className="mr-2 h-4 w-4" />
    Add Video
  </Link>
</Button>
```

7. Remove the `{showInput && ...}` block (lines 138-142).
8. Remove the `{isExtracting && ...}` ExtractionProgress block (lines 144-148).
9. In the empty state condition (line 162), remove `&& !isExtracting`.

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: replace inline Add Video input with link to /video/new"
```

---

### Task 4: Create `PendingVideoCard` component for in-progress extractions

**Files:**
- Create: `frontend/src/components/PendingVideoCard.tsx`

**Step 1: Create the component**

Create `frontend/src/components/PendingVideoCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { VideoJob } from "@/lib/api";

interface PendingVideoCardProps {
  job: VideoJob;
}

export function PendingVideoCard({ job }: PendingVideoCardProps) {
  const thumbnail = `https://img.youtube.com/vi/${job.youtube_id}/mqdefault.jpg`;
  const progress = ((job.current_step + 1) / job.total_steps) * 100;

  return (
    <Link href={`/video/${job.id}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <div className="relative aspect-video">
          <Image
            src={thumbnail}
            alt="Processing video"
            fill
            className="object-cover opacity-60"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
            <Loader2 className="h-8 w-8 text-white animate-spin mb-2" />
            <span className="text-white text-sm font-medium">
              {job.step_label}...
            </span>
          </div>
        </div>
        <CardContent className="p-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Step {job.current_step + 1} of {job.total_steps}
          </p>
          <Progress value={progress} className="h-1.5" />
        </CardContent>
      </Card>
    </Link>
  );
}
```

Note: Check if `Card` and `CardContent` exist in the shadcn ui components. If not, use a plain `div` with appropriate styling instead. The existing `VideoCard` uses a plain `div` — match that pattern.

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/components/PendingVideoCard.tsx
git commit -m "feat: add PendingVideoCard component for in-progress extractions"
```

---

### Task 5: Show `PendingVideoCard` on home page grid

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Step 1: Add pending card to the grid**

1. Add imports:
```tsx
import { PendingVideoCard } from "@/components/PendingVideoCard";
```

2. Destructure `activeJob` from `useExtraction()`:
```tsx
const { extraction, activeJob, videos, ... } = useExtraction();
```

3. In both the grid view and list view sections, prepend the `PendingVideoCard` when `activeJob` is active:
```tsx
{/* Grid view */}
{!loading && (filtered.length > 0 || activeJob) && view === "grid" && (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] items-stretch gap-4">
    {activeJob && <PendingVideoCard job={activeJob} />}
    {filtered.map((video) => (
      <VideoCard key={video.id} video={video} />
    ))}
  </div>
)}
```

Do the same for list view (render `PendingVideoCard` at the top of the list).

4. Update the empty state condition to also check for `activeJob`:
```tsx
{!loading && videos.length === 0 && !activeJob && (
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "feat: show PendingVideoCard in library grid during extraction"
```

---

### Task 6: Update `/video/[id]` page to handle in-progress jobs

**Files:**
- Modify: `frontend/src/app/video/[id]/page.tsx`

**Step 1: Add job-aware logic to the detail page**

The page currently does:
1. Get `id` from params
2. `getVideo(id)` on mount
3. Render video or loading/error state

Change it to:
1. Get `id` from params
2. Try `getVideo(id)` — if found, render detail page (existing behavior)
3. If 404 → try `getVideoJob(id)` — if active job, render extraction skeleton
4. Poll the job. When completed, fetch the video using `job.video_id` and render it. Update URL via `router.replace(/video/${job.video_id})`.

Add these states:
```tsx
const [job, setJob] = useState<VideoJob | null>(null);
```

Add a `useEffect` for job polling (only when `job` is set and active):
```tsx
useEffect(() => {
  if (!job || !["queued", "processing"].includes(job.status)) return;

  const interval = setInterval(async () => {
    const latest = await getVideoJob(job.id);
    setJob(latest);

    if (latest.status === "completed" && latest.video_id) {
      clearInterval(interval);
      const v = await getVideo(latest.video_id);
      setVideo(v);
      setJob(null);
      router.replace(`/video/${latest.video_id}`);
    } else if (latest.status === "failed") {
      clearInterval(interval);
      setError(latest.error_message || "Extraction failed");
    }
  }, 2000);

  return () => clearInterval(interval);
}, [job, router]);
```

**Step 2: Create the extraction skeleton UI**

When `job` is set and video is not yet loaded, render:
- Same layout as the detail page (left/right panels)
- Left panel: `<YouTubeEmbed>` using `job.youtube_id` (works immediately), skeleton for title/metadata
- Right panel: skeleton blocks for analysis sections
- A progress indicator overlay or section showing step progress

```tsx
if (job && !video) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to library
        </Link>
      </header>

      <div className="flex flex-col gap-6 p-6 lg:flex-row">
        <div className="lg:w-2/5 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <YouTubeEmbed youtubeId={job.youtube_id} />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Step {job.current_step + 1} of {job.total_steps} — {job.step_label}...
              </span>
            </div>
            <Progress value={((job.current_step + 1) / job.total_steps) * 100} className="h-2" />
          </div>
        </div>

        <div className="lg:w-3/5 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Add required imports**

Add to the detail page imports:
```tsx
import { getVideoJob, type VideoJob } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Manual verification**

1. Start dev server: `cd frontend && npm run dev`
2. Navigate to `/video/new`, paste a YouTube URL
3. Should redirect to `/video/{jobId}`
4. Should see YouTube embed + skeleton + progress bar
5. When extraction completes, URL should change to `/video/{videoId}` and full content should appear
6. Navigate back to `/` — should see `PendingVideoCard` in grid during extraction

**Step 6: Commit**

```bash
git add frontend/src/app/video/[id]/page.tsx
git commit -m "feat: handle in-progress extraction jobs on video detail page"
```

---

### Task 7: Clean up removed components and unused code

**Files:**
- Modify: `frontend/src/components/LoadingState.tsx` — remove `ExtractionProgress` if no longer used anywhere
- Check: any other references to the old inline extraction flow

**Step 1: Check for remaining references**

Search the codebase for `ExtractionProgress` and `showInput` to confirm they're no longer referenced.

**Step 2: Remove `ExtractionProgress` from `LoadingState.tsx`**

If `ExtractionProgress` is the only export from `LoadingState.tsx`, delete the entire file.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused ExtractionProgress component"
```

---

### Task 8: End-to-end manual test

**Step 1: Full flow test**

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Go to `/` — verify "Add Video" button links to `/video/new`
4. Click "Add Video" → verify you're on `/video/new` with centered input
5. Paste a YouTube URL → click Extract
6. Verify redirect to `/video/{jobId}` with skeleton + embed + progress
7. Navigate back to `/` while extraction runs → verify PendingVideoCard in grid
8. Click the PendingVideoCard → verify it goes back to `/video/{jobId}` with progress
9. Wait for completion → verify URL changes to `/video/{videoId}` and full content renders
10. Verify the PendingVideoCard disappears from home page and is replaced by normal VideoCard
11. Submit a duplicate video URL → verify immediate redirect to existing `/video/{videoId}`

**Step 2: Edge case tests**

1. Refresh `/video/{jobId}` mid-extraction → should resume showing progress
2. Invalid URL on `/video/new` → should show validation error
3. Backend error during extraction → should show error state on detail page

**Step 3: Final commit if any fixes needed**
