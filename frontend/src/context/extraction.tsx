"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createVideoJob,
  getVideoJob,
  listVideoJobs,
  listVideos,
  type VideoJob,
  type VideoListItem,
} from "@/lib/api";

const ACTIVE_JOB_STORAGE_KEY = "active-extraction-job-id";
const ACTIVE_STATUSES = new Set(["queued", "processing"]);
const POLL_INTERVAL = 2000;

export interface Extraction {
  jobId: string;
  url: string;
  step: number;
  totalSteps: number;
  stepLabel: string;
}

interface ExtractionContextValue {
  extraction: Extraction | null;
  extract: (url: string) => Promise<void>;
  videos: VideoListItem[];
  setVideos: React.Dispatch<React.SetStateAction<VideoListItem[]>>;
  removeVideo: (videoId: string) => void;
  loadingVideos: boolean;
  extractError: string;
  extractInfo: string;
  clearMessages: () => void;
}

const ExtractionContext = createContext<ExtractionContextValue | null>(null);

export function ExtractionProvider({ children }: { children: React.ReactNode }) {
  const [activeJob, setActiveJob] = useState<VideoJob | null>(null);
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [extractError, setExtractError] = useState("");
  const [extractInfo, setExtractInfo] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearMessages = useCallback(() => {
    setExtractError("");
    setExtractInfo("");
  }, []);

  const refreshVideos = useCallback(async () => {
    const all = await listVideos();
    setVideos(all);
  }, []);

  const removeVideo = useCallback((videoId: string) => {
    setVideos((prev) => prev.filter((video) => video.id !== videoId));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const persistActiveJobId = useCallback((jobId: string | null) => {
    if (jobId) {
      localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
      return;
    }
    localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
  }, []);

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const latest = await getVideoJob(jobId);

        if (ACTIVE_STATUSES.has(latest.status)) {
          setActiveJob(latest);
          return;
        }

        stopPolling();
        persistActiveJobId(null);
        setActiveJob(null);

        if (latest.status === "completed") {
          await refreshVideos();
          return;
        }

        setExtractError(latest.error_message || "Failed to extract video");
      } catch {
        stopPolling();
        persistActiveJobId(null);
        setActiveJob(null);
        setExtractError("Failed to refresh extraction status");
      }
    },
    [persistActiveJobId, refreshVideos, stopPolling],
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void pollJob(jobId);
      }, POLL_INTERVAL);
      void pollJob(jobId);
    },
    [pollJob, stopPolling],
  );

  const extract = useCallback(
    async (url: string) => {
      clearMessages();

      try {
        const job = await createVideoJob(url);

        if (ACTIVE_STATUSES.has(job.status)) {
          setActiveJob(job);
          persistActiveJobId(job.id);
          startPolling(job.id);
          return;
        }

        if (job.status === "completed") {
          persistActiveJobId(null);
          setActiveJob(null);
          await refreshVideos();
          setExtractInfo("This video is already in your library.");
          return;
        }

        setExtractError(job.error_message || "Failed to extract video");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to extract video";
        setExtractError(msg);
      }
    },
    [clearMessages, persistActiveJobId, refreshVideos, startPolling],
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const allVideos = await listVideos();
        if (isMounted) setVideos(allVideos);
      } catch {
        if (isMounted) setExtractError("Failed to load videos");
      } finally {
        if (isMounted) setLoadingVideos(false);
      }

      if (!isMounted) return;

      const storedJobId = localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
      if (storedJobId) {
        try {
          const storedJob = await getVideoJob(storedJobId);
          if (ACTIVE_STATUSES.has(storedJob.status)) {
            setActiveJob(storedJob);
            startPolling(storedJob.id);
            return;
          }
        } catch {
          persistActiveJobId(null);
        }
      }

      try {
        const activeJobs = await listVideoJobs(["queued", "processing"]);
        const latest = activeJobs[0] ?? null;
        if (latest && ACTIVE_STATUSES.has(latest.status)) {
          setActiveJob(latest);
          persistActiveJobId(latest.id);
          startPolling(latest.id);
        }
      } catch {
        setExtractError("Failed to load extraction status");
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
      stopPolling();
    };
  }, [persistActiveJobId, startPolling, stopPolling]);

  const extraction = useMemo<Extraction | null>(() => {
    if (!activeJob || !ACTIVE_STATUSES.has(activeJob.status)) {
      return null;
    }

    return {
      jobId: activeJob.id,
      url: activeJob.youtube_url,
      step: activeJob.current_step,
      totalSteps: activeJob.total_steps,
      stepLabel: activeJob.step_label,
    };
  }, [activeJob]);

  return (
    <ExtractionContext.Provider
      value={{
        extraction,
        extract,
        videos,
        setVideos,
        removeVideo,
        loadingVideos,
        extractError,
        extractInfo,
        clearMessages,
      }}
    >
      {children}
    </ExtractionContext.Provider>
  );
}

export function useExtraction() {
  const ctx = useContext(ExtractionContext);
  if (!ctx) throw new Error("useExtraction must be used within ExtractionProvider");
  return ctx;
}
