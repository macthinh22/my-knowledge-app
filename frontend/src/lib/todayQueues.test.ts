import { describe, expect, it } from "vitest";

import type { VideoListItem } from "@/lib/api";
import { buildTodayQueues } from "@/lib/todayQueues";

function video(partial: Partial<VideoListItem>): VideoListItem {
  return {
    id: partial.id ?? "id",
    youtube_url: partial.youtube_url ?? "https://youtu.be/x",
    youtube_id: partial.youtube_id ?? "x",
    title: partial.title ?? "Title",
    thumbnail_url: null,
    channel_name: null,
    duration: 60,
    explanation: null,
    key_knowledge: null,
    keywords: [],
    category: partial.category ?? null,
    transcript_source: null,
    is_favourite: false,
    created_at: partial.created_at ?? "2026-03-05T00:00:00Z",
    updated_at: partial.updated_at ?? "2026-03-05T00:00:00Z",
  };
}

describe("buildTodayQueues", () => {
  it("returns top items and counts per queue", () => {
    const result = buildTodayQueues({
      favourites: [video({ id: "1" }), video({ id: "2" })],
      recentlyAdded: [video({ id: "3" })],
      needsReview: [
        video({ id: "4" }),
        video({ id: "5" }),
        video({ id: "6" }),
        video({ id: "7" }),
      ],
      previewLimit: 3,
    });

    expect(result.favourites.count).toBe(2);
    expect(result.recentlyAdded.count).toBe(1);
    expect(result.needsReview.preview).toHaveLength(3);
  });
});
