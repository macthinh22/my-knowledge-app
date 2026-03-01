/**
 * API client for YouTube Knowledge Extractor backend.
 */

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface VideoListItem {
    id: string;
    youtube_url: string;
    youtube_id: string;
    title: string | null;
    thumbnail_url: string | null;
    channel_name: string | null;
    duration: number | null;
    explanation: string | null;
    key_knowledge: string | null;
    keywords: string[] | null;
    transcript_source: string | null;
    created_at: string;
    updated_at: string;
}

export interface Video extends VideoListItem {
    critical_analysis: string | null;
    real_world_applications: string | null;
    notes: string | null;
}

export type VideoJobStatus = "queued" | "processing" | "completed" | "failed";

export interface VideoJob {
    id: string;
    youtube_url: string;
    youtube_id: string;
    status: VideoJobStatus;
    current_step: number;
    total_steps: number;
    step_label: string;
    error_message: string | null;
    video_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface TagSummary {
    tag: string;
    usage_count: number;
    last_used_at: string | null;
    aliases: string[];
}

export interface TagAlias {
    id: string;
    alias: string;
    canonical: string;
    created_at: string;
    updated_at: string;
}

export interface ApiError {
    detail: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function request<T>(
    path: string,
    options?: RequestInit,
): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.detail ?? `Request failed (${res.status})`);
    }

    // 204 No Content (e.g. DELETE)
    if (res.status === 204) return undefined as unknown as T;

    return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function createVideoJob(youtubeUrl: string) {
    return request<VideoJob>("/api/videos", {
        method: "POST",
        body: JSON.stringify({ youtube_url: youtubeUrl }),
    });
}

export function getVideoJob(jobId: string) {
    return request<VideoJob>(`/api/videos/jobs/${jobId}`);
}

export function listVideoJobs(statuses?: VideoJobStatus[]) {
    const query = statuses && statuses.length > 0
        ? `?status=${encodeURIComponent(statuses.join(","))}`
        : "";
    return request<VideoJob[]>(`/api/videos/jobs${query}`);
}

/** List all videos, sorted newest first. */
export function listVideos() {
    return request<VideoListItem[]>("/api/videos");
}

/** Get a single video with full analysis. */
export function getVideo(id: string) {
    return request<Video>(`/api/videos/${id}`);
}

/** Update user notes for a video. */
export function updateVideoNotes(id: string, notes: string) {
    return request<Video>(`/api/videos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
    });
}

/** Delete a video entry. */
export function deleteVideo(id: string) {
    return request<void>(`/api/videos/${id}`, {
        method: "DELETE",
    });
}

export function listTags() {
    return request<TagSummary[]>("/api/tags");
}

export function listTagAliases() {
    return request<TagAlias[]>("/api/tags/aliases");
}

export function createTagAlias(alias: string, canonical: string) {
    return request<TagAlias>("/api/tags/aliases", {
        method: "POST",
        body: JSON.stringify({ alias, canonical }),
    });
}

export function deleteTagAlias(alias: string) {
    return request<void>(`/api/tags/aliases/${encodeURIComponent(alias)}`, {
        method: "DELETE",
    });
}

export function renameTag(fromTag: string, toTag: string) {
    return request<TagSummary[]>("/api/tags/rename", {
        method: "POST",
        body: JSON.stringify({ from_tag: fromTag, to_tag: toTag }),
    });
}

export function mergeTags(sourceTags: string[], targetTag: string) {
    return request<TagSummary[]>("/api/tags/merge", {
        method: "POST",
        body: JSON.stringify({ source_tags: sourceTags, target_tag: targetTag }),
    });
}

export function deleteTag(tag: string) {
    return request<TagSummary[]>(`/api/tags/${encodeURIComponent(tag)}`, {
        method: "DELETE",
    });
}
