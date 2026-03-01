# Add Video Flow Redesign

## Problem

The current "Add Video" button toggles an inline input on the home page. Extraction progress shows as a small bar on the home page, and the user must manually click the new video card to see details. This feels disconnected.

## Design

### New Flow

1. "Add Video" button → redirects to `/video/new`
2. User pastes YouTube URL on `/video/new`, submits
3. `POST /api/videos` → job created → `router.replace(/video/{jobId})`
4. `/video/[id]` detects this is a job (not a video) and shows:
   - YouTube embed immediately (youtube_id available from job)
   - Progress indicator with step labels
   - Skeleton placeholders for title, analysis sections
5. On job completion → fetch full video via `video_id` → render complete detail page → update URL to `/video/{videoId}`

### Route Changes

| Route | Before | After |
|-------|--------|-------|
| `/` | Library + inline input + inline progress | Library only, "Add Video" links to `/video/new` |
| `/video/new` | N/A | URL input form |
| `/video/[id]` | Completed videos only | Both in-progress jobs and completed videos |

### Home Page — In-Progress Video Card

When extraction is active, a "pending" card appears in the library grid:
- Thumbnail from `https://img.youtube.com/vi/{youtube_id}/mqdefault.jpg`
- Progress bar overlay + step label
- Clickable → navigates to `/video/{jobId}`
- Transitions to normal VideoCard on completion

### `/video/new` Page

Minimal page:
- "Back to library" header link
- Centered `VideoInput` component
- On submit: `extract(url)` → redirect based on job status
  - `queued`/`processing` → `router.replace(/video/{job.id})`
  - `completed` (duplicate) → `router.replace(/video/{job.video_id})`

### `/video/[id]` Page Changes

The page tries two lookups:
1. `GET /api/videos/{id}` — if found → render complete detail page
2. If 404 → `GET /api/videos/jobs/{id}` — if active job → render extraction skeleton
   - Show YouTube embed (from `job.youtube_id`)
   - Show step progress
   - Skeleton placeholders for all content sections
   - Poll every 2s until complete
   - On completion → fetch video → render full page → `router.replace(/video/{videoId})`

### ExtractionContext Changes

- `extract()` returns the `VideoJob` so callers can redirect based on job state
- Expose `activeJob` (raw `VideoJob`) in context value — needed for youtube_id on pending cards and detail page

### Removals

- `showInput` state + inline `<VideoInput>` from `page.tsx`
- `ExtractionProgress` inline component from home page
- `handleExtract` in `page.tsx`

### Backend

No backend changes required. The existing job API already exposes `youtube_id`, `video_id`, step progress, and status.
