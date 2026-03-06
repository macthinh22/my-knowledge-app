/**
 * API client for YouTube Knowledge Extractor backend.
 */

import { authFetch } from "./auth";

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
    category: string | null;
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

export interface Category {
    id: string;
    slug: string;
    name: string;
    color: string | null;
    display_order: number;
    created_at: string;
}

export interface ApiError {
    detail: string;
}

export class ApiRequestError extends Error {
    status: number;
    detail: string | null;

    constructor(status: number, detail?: string | null) {
        super(detail ?? `Request failed (${status})`);
        this.name = "ApiRequestError";
        this.status = status;
        this.detail = detail ?? null;
    }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
    return error instanceof ApiRequestError;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function request<T>(
    path: string,
    options?: RequestInit,
): Promise<T> {
    const res = await authFetch(path, options);

    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ApiError | null;
        throw new ApiRequestError(res.status, body?.detail ?? null);
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

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    limit: number;
    offset: number;
}

export interface VideoListParams {
    limit?: number;
    offset?: number;
    search?: string;
    sort_by?: string;
    sort_order?: "asc" | "desc";
    tag?: string;
    tag_mode?: "all" | "any";
    category?: string;
    collection_id?: string;
    review_status?: string;
}

/** List videos with server-side pagination, search, and filtering. */
export function listVideos(
    params: VideoListParams = {},
): Promise<PaginatedResponse<VideoListItem>> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== "") {
            query.set(key, String(value));
        }
    }
    const qs = query.toString();
    return request<PaginatedResponse<VideoListItem>>(
        `/api/videos${qs ? `?${qs}` : ""}`,
    );
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

export function updateVideoCategory(id: string, category: string | null) {
    return request<Video>(`/api/videos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ category }),
    });
}

/** Delete a video entry. */
export function deleteVideo(id: string) {
    return request<void>(`/api/videos/${id}`, {
        method: "DELETE",
    });
}

export function listCategories() {
    return request<Category[]>("/api/categories");
}

export function createCategory(slug: string, name: string, color?: string) {
    return request<Category>("/api/categories", {
        method: "POST",
        body: JSON.stringify({ slug, name, color }),
    });
}

export function updateCategory(
    slug: string,
    data: { name?: string; color?: string; display_order?: number },
) {
    return request<Category>(`/api/categories/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

export function deleteCategory(slug: string) {
    return request<void>(`/api/categories/${encodeURIComponent(slug)}`, {
        method: "DELETE",
    });
}

export function listTags(params?: {
    search?: string;
    limit?: number;
}): Promise<TagSummary[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return request<TagSummary[]>(`/api/tags${qs ? `?${qs}` : ""}`);
}

export interface CollectionItem {
    id: string;
    name: string;
    description: string | null;
    video_count: number;
    created_at: string;
    updated_at: string;
}

export interface CollectionDetail extends CollectionItem {
    video_ids: string[];
}

export function listCollections(): Promise<CollectionItem[]> {
    return request<CollectionItem[]>("/api/collections");
}

export function getCollection(id: string): Promise<CollectionDetail> {
    return request<CollectionDetail>(`/api/collections/${id}`);
}

export function createCollection(
    name: string,
    description?: string,
): Promise<CollectionItem> {
    return request<CollectionItem>("/api/collections", {
        method: "POST",
        body: JSON.stringify({ name, description }),
    });
}

export function deleteCollection(id: string): Promise<void> {
    return request<void>(`/api/collections/${id}`, { method: "DELETE" });
}

export function addVideoToCollection(
    collectionId: string,
    videoId: string,
): Promise<void> {
    return request<void>(`/api/collections/${collectionId}/videos`, {
        method: "POST",
        body: JSON.stringify({ video_id: videoId }),
    });
}

export function removeVideoFromCollection(
    collectionId: string,
    videoId: string,
): Promise<void> {
    return request<void>(
        `/api/collections/${collectionId}/videos/${videoId}`,
        { method: "DELETE" },
    );
}

export function getRelatedVideos(
    videoId: string,
    limit = 5,
): Promise<VideoListItem[]> {
    return request<VideoListItem[]>(
        `/api/videos/${videoId}/related?limit=${limit}`,
    );
}

export interface DashboardStats {
    total_videos: number;
    total_collections: number;
    never_viewed_count: number;
    stale_count: number;
    videos_by_category: Record<string, number>;
    top_tags: TagSummary[];
    recent_additions: number;
}

export function getDashboard(): Promise<DashboardStats> {
    return request<DashboardStats>("/api/stats/dashboard");
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

export function changePassword(currentPassword: string, newPassword: string) {
    return request<void>("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
        }),
    });
}

export function updateCollection(
    id: string,
    data: { name?: string; description?: string },
) {
    return request<CollectionItem>(`/api/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

export interface UserSettings {
    preferences: Record<string, unknown>;
}

export function getSettings() {
    return request<UserSettings>("/api/auth/settings");
}

export function updateSettings(preferences: Record<string, unknown>) {
    return request<UserSettings>("/api/auth/settings", {
        method: "PATCH",
        body: JSON.stringify({ preferences }),
    });
}
