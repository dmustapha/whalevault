"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getProofStatus } from "@/lib/api";
import type { ProofStatusResponse, ProofStatus, ProofResult } from "@/types/api";

export interface UseProofStatusReturn {
  status: ProofStatus | null;
  progress: number;
  stage: string | null;
  result: ProofResult | null;
  error: string | null;
  isPolling: boolean;
  startPolling: (jobId: string) => void;
  stopPolling: () => void;
}

const POLL_INTERVAL_MS = 1000;

export function useProofStatus(): UseProofStatusReturn {
  const [data, setData] = useState<ProofStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(async () => {
    if (!jobIdRef.current) return;

    try {
      const response = await getProofStatus(jobIdRef.current);
      setData(response);
      setError(null);

      if (response.status === "completed" || response.status === "failed") {
        stopPolling();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get proof status";
      setError(message);
    }
  }, [stopPolling]);

  const startPolling = useCallback(
    (jobId: string) => {
      setData(null);
      setError(null);
      jobIdRef.current = jobId;
      setIsPolling(true);

      poll();
      intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [poll]
  );

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    status: data?.status ?? null,
    progress: data?.progress ?? 0,
    stage: data?.stage ?? null,
    result: data?.result ?? null,
    error: data?.error ?? error,
    isPolling,
    startPolling,
    stopPolling,
  };
}
