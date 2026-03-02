export const POLLING_BASE_INTERVAL_MS = 2000;
export const POLLING_MAX_INTERVAL_MS = 10000;
export const POLLING_MAX_FAILURES = 3;

export function getPollingBackoffDelayMs(failureCount: number): number {
  const safeFailureCount = Math.max(1, failureCount);
  return Math.min(
    POLLING_BASE_INTERVAL_MS * (2 ** (safeFailureCount - 1)),
    POLLING_MAX_INTERVAL_MS,
  );
}
