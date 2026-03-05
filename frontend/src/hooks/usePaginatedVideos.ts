"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listVideos,
  type VideoListItem,
  type VideoListParams,
} from "@/lib/api";

const PAGE_SIZE = 50;

interface UsePaginatedVideosResult {
  videos: VideoListItem[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function usePaginatedVideos(
  filters: Omit<VideoListParams, "limit" | "offset">,
): UsePaginatedVideosResult {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const requestInFlightRef = useRef(false);

  const filtersKey = JSON.stringify(filters);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      if (requestInFlightRef.current) {
        return;
      }

      requestInFlightRef.current = true;

      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const data = await listVideos({
          ...filters,
          limit: PAGE_SIZE,
          offset,
        });

        setVideos((prev) => {
          if (!append) {
            return data.items;
          }

          const seen = new Set(prev.map((video) => video.id));
          const merged = [...prev];

          data.items.forEach((item) => {
            if (seen.has(item.id)) {
              return;
            }

            seen.add(item.id);
            merged.push(item);
          });

          return merged;
        });
        setTotal(data.total);
        offsetRef.current = offset + data.items.length;
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load videos");
      } finally {
        requestInFlightRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtersKey],
  );

  useEffect(() => {
    offsetRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loadingMore && offsetRef.current < total) {
      fetchPage(offsetRef.current, true);
    }
  }, [loadingMore, total, fetchPage]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  return {
    videos,
    total,
    loading,
    loadingMore,
    error,
    hasMore: offsetRef.current < total,
    loadMore,
    refresh,
  };
}
