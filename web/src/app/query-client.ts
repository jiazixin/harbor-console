import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

const maxRetryWaitMs = 10_000;

// 代码规范 §5.3: queries retry only network failures, timeouts, 429 and 503,
// at most twice; a Retry-After over 10 s returns the error at once.
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (!error.canRetry) return false;
  if (error.code === "network_unavailable" || error.code === "timeout")
    return true;
  if (error.status !== 429 && error.status !== 503) return false;
  return (
    error.retryAfterMs === undefined || error.retryAfterMs <= maxRetryWaitMs
  );
}

/** Waits Retry-After when sent, otherwise 500 ms doubling with 0–20% jitter. */
export function retryDelayMs(failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterMs !== undefined)
    return error.retryAfterMs;
  const base = 500 * 2 ** failureCount;
  return Math.min(maxRetryWaitMs, base * (1 + Math.random() * 0.2));
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
        retryDelay: (failureCount, error) => retryDelayMs(failureCount, error),
        // Console data changes outside this page; refetch when it is reopened.
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
    },
  });
}
