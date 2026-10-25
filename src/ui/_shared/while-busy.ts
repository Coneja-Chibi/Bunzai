/**
 * Retry a studio read the server refused only because the library was busy ("studio_busy", HTTP 503). Restoring
 * several Workbench tabs opens several pieces at once and the library reads a few at a time, so the extras are told
 * to come back; waiting a moment is the whole fix. Bounded: 5 tries, capped exponential delays (250, 500, 1000,
 * 1000 ms: under 3 s of waiting), then the last error is thrown for the caller to show. Every other failure
 * passes straight through. The code is matched on the error, not its class, because each app bundles its own copy
 * of the client.
 */
import { exponentialBackoffMs } from "./backoff";

export const BUSY_CODE = "studio_busy";
export const BUSY_TRIES = 5;

const isBusy = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { status?: unknown }).status === 503 && (error as { code?: unknown }).code === BUSY_CODE;

export async function whileBusy<T>(call: () => Promise<T>, wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (!isBusy(error) || attempt >= BUSY_TRIES) throw error;
      await wait(exponentialBackoffMs(attempt, { baseMs: 250, capMs: 1000 }));
    }
  }
}
