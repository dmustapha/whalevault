"use client";

/**
 * Polling utilities with exponential backoff.
 *
 * Provides efficient polling that reduces load on servers
 * while maintaining responsive user experience.
 */

export interface PollingOptions {
  /** Initial delay between polls in milliseconds */
  initialDelayMs: number;
  /** Maximum delay between polls in milliseconds */
  maxDelayMs: number;
  /** Maximum number of polling attempts before giving up */
  maxAttempts: number;
  /** Multiplier applied to delay after each attempt */
  backoffMultiplier: number;
}

const DEFAULT_OPTIONS: PollingOptions = {
  initialDelayMs: 500,
  maxDelayMs: 10000,
  maxAttempts: 60,
  backoffMultiplier: 1.5,
};

/**
 * Polls a function with exponential backoff until a condition is met.
 *
 * @param fn - Function to call on each poll
 * @param isDone - Predicate that returns true when polling should stop
 * @param options - Polling configuration options
 * @returns The result from the final successful poll
 * @throws Error if max attempts reached without completion
 *
 * @example
 * ```typescript
 * const result = await pollWithBackoff(
 *   () => checkStatus(jobId),
 *   (status) => status.completed || status.failed,
 *   { initialDelayMs: 1000, maxAttempts: 30 }
 * );
 * ```
 */
export async function pollWithBackoff<T>(
  fn: () => Promise<T>,
  isDone: (result: T) => boolean,
  options: Partial<PollingOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let delay = opts.initialDelayMs;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (isDone(result)) {
        return result;
      }

      // Not done yet, wait and try again
      await sleep(delay);

      // Increase delay with backoff, capped at max
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // On error, still apply backoff before retrying
      await sleep(delay);
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw new Error(
    `Polling timed out after ${opts.maxAttempts} attempts. Last error: ${lastError?.message || "none"}`
  );
}

/**
 * Sleep for a specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates an abortable polling controller.
 *
 * Useful when you need to cancel polling from outside
 * (e.g., user navigates away, component unmounts).
 */
export function createPollingController() {
  let aborted = false;

  return {
    abort: () => {
      aborted = true;
    },
    isAborted: () => aborted,
    reset: () => {
      aborted = false;
    },
  };
}

/**
 * Polls with backoff and abort support.
 *
 * @param fn - Function to call on each poll
 * @param isDone - Predicate that returns true when polling should stop
 * @param controller - Controller for aborting the poll
 * @param options - Polling configuration options
 */
export async function pollWithBackoffAbortable<T>(
  fn: () => Promise<T>,
  isDone: (result: T) => boolean,
  controller: ReturnType<typeof createPollingController>,
  options: Partial<PollingOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    if (controller.isAborted()) {
      throw new Error("Polling aborted");
    }

    try {
      const result = await fn();

      if (isDone(result)) {
        return result;
      }
    } catch (error) {
      // On error, continue polling unless aborted
      if (controller.isAborted()) {
        throw new Error("Polling aborted");
      }
    }

    await sleep(delay);
    delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
  }

  throw new Error(`Polling timed out after ${opts.maxAttempts} attempts`);
}
