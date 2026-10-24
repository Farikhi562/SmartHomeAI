"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError} from "@/client/api";
import { toApiError } from "@/client/api";

/**
 * Minimal data-fetching hook for the client layer (no react-query — scope).
 * Every page renders loading / error / success from this single state shape.
 * Handles: unmount safety, strict-mode double effects, and manual retry.
 */
export type AsyncState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
};

export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const fnRef = useRef(fn);
  // Keep the latest closure without re-triggering the fetch effect.
  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fnRef.current().then(
      (value) => {
        if (cancelled) return;
        setData(value);
        setLoading(false);
      },
      (err: unknown) => {
        if (cancelled) return;
        setError(toApiError(err));
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { data, error, loading, reload };
}
