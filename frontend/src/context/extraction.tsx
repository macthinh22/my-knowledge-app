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
import {
  POLLING_BASE_INTERVAL_MS,
  POLLING_MAX_FAILURES,
  getPollingBackoffDelayMs,
} from "@/lib/polling";

const ACTIVE_JOB_STORAGE_KEY = "active-extraction-job-id";
const ACTIVE_STATUSES = new Set(["queued", "processing"]);

export interface Extraction {
  jobId: string;
  url: string;
  step: number;
  totalSteps: number;
  stepLabel: string;
}

interface ExtractionContextValue {
  extraction: Extraction | null;
  activeJob: VideoJob | null;
  extract: (url: string) => Promise<VideoJob | null>;
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
  const pollFailureCountRef = useRef(0);
  const pollBackoffUntilRef = useRef(0);

  const clearMessages = useCallback(() => {
    setExtractError("");
    setExtractInfo("");
  }, []);

  const refreshVideos = useCallback(async () => {
    const data = await listVideos({ limit: 100 });
    setVideos(data.items);
  }, []);

  const removeVideo = useCallback((videoId: string) => {
    setVideos((prev) => prev.filter((video) => video.id !== videoId));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollFailureCountRef.current = 0;
    pollBackoffUntilRef.current = 0;
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
      if (Date.now() < pollBackoffUntilRef.current) {
        return;
      }

      try {
        const latest = await getVideoJob(jobId);
        pollFailureCountRef.current = 0;
        pollBackoffUntilRef.current = 0;
        setExtractError("");

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

        setExtractError(latest.error_message || "Failed to extract resource");
      } catch {
        pollFailureCountRef.current += 1;
        const backoffDelay = getPollingBackoffDelayMs(pollFailureCountRef.current);
        pollBackoffUntilRef.current = Date.now() + backoffDelay;

        if (pollFailureCountRef.current >= POLLING_MAX_FAILURES) {
          setExtractError("Connection issue while syncing extraction status. Retrying...");
        }
      }
    },
    [persistActiveJobId, refreshVideos, stopPolling],
  );

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void pollJob(jobId);
      }, POLLING_BASE_INTERVAL_MS);
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
          return job;
        }

        if (job.status === "completed") {
          persistActiveJobId(null);
          setActiveJob(null);
          await refreshVideos();
          setExtractInfo("This resource is already in your library.");
          return job;
        }

        setExtractError(job.error_message || "Failed to extract resource");
        return job;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to extract resource";
        setExtractError(msg);
        return null;
      }
    },
    [clearMessages, persistActiveJobId, refreshVideos, startPolling],
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const data = await listVideos({ limit: 100 });
        if (isMounted) setVideos(data.items);
      } catch {
        if (isMounted) setExtractError("Failed to load resources");
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
        activeJob,
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
