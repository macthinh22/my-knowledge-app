import type { VideoListItem } from "@/lib/api";

type QueueSlice = { count: number; preview: VideoListItem[] };

export type TodayQueues = {
  inbox: QueueSlice;
  recentlyAdded: QueueSlice;
  needsReview: QueueSlice;
};

export function buildTodayQueues(input: {
  inbox: VideoListItem[];
  recentlyAdded: VideoListItem[];
  needsReview: VideoListItem[];
  previewLimit: number;
}): TodayQueues {
  const slice = (items: VideoListItem[]): QueueSlice => ({
    count: items.length,
    preview: items.slice(0, input.previewLimit),
  });

  return {
    inbox: slice(input.inbox),
    recentlyAdded: slice(input.recentlyAdded),
    needsReview: slice(input.needsReview),
  };
}
