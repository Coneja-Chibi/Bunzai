/** Keep each visible shell tab aligned with host-authorized appearance changes. */
import { useEffect } from "react";
import { apiFetchJson, LIBRARY_LOCKED_EVENT } from "../_shared/api-fetch";
import { exponentialBackoffMs } from "../_shared/backoff";
import { BROWSER_THEME_REVISION_EVENT, isBrowserStudio } from "../../browser-mode";
import { isRecord } from "../../core/guards";
import { useShellStore } from "./store";

export interface ThemeRevision { epoch: string; revision: number }
const validRevision = (value: unknown): value is ThemeRevision => isRecord(value) &&
  Object.keys(value).length === 2 && typeof value.epoch === "string" && /^[a-f0-9]{48}$/.test(value.epoch) &&
  Number.isSafeInteger(value.revision) && Number(value.revision) >= 0;

/** Compare lifecycle identity without keeping another theme or permission authority. */
export function createThemeRevisionPoller(
  read: () => Promise<unknown>, changed: (value: ThemeRevision, previous: ThemeRevision | null) => void, failed: () => void,
) {
  let cursor: ThemeRevision | null = null, generation = 0, inFlight = false;
  return {
    async poll(): Promise<void> {
      if (inFlight) return;
      inFlight = true;
      const owner = generation;
      try {
        const value = await read();
        if (owner !== generation) return;
        if (!validRevision(value)) throw new Error("invalid theme revision response");
        if (!cursor || value.epoch !== cursor.epoch || value.revision !== cursor.revision) {
          const previous = cursor;
          cursor = value;
          changed(value, previous);
        }
      } catch {
        if (owner === generation) { cursor = null; failed(); }
      } finally { inFlight = false; }
    },
    reset(): void { generation++; },
    busy(): boolean { return inFlight; },
  };
}

/** Poll only while visible; avoid consuming an HTTP/1 connection with a per-tab event stream. */
export function useThemeChangeStream(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const browserMode = isBrowserStudio();
    let live = true, failures = 0, request: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let refreshQueue = Promise.resolve();
    const revalidate = (invalidate = true): void => {
      if (!live) return;
      if (invalidate) useShellStore.getState().invalidateAppearance();
      refreshQueue = refreshQueue.then(async () => {
        if (live) await useShellStore.getState().refreshAppearance();
      }).catch(() => undefined);
    };
    const poller = createThemeRevisionPoller(async () => {
      request = new AbortController();
      const deadline = setTimeout(() => request?.abort(), 4000);
      try {
        return await apiFetchJson<unknown>("/api/themes/revision", {
          requireToken: true, cache: "no-store", signal: request.signal,
        });
      } finally { clearTimeout(deadline); request = null; }
    }, (_value, previous) => { failures = 0; revalidate(previous !== null); }, () => {
      failures++;
      useShellStore.getState().invalidateAppearance();
    });
    const schedule = (delay = 1800): void => {
      if (!live || browserMode || document.visibilityState !== "visible" || timer) return;
      timer = setTimeout(() => { timer = null; void poll(); }, delay);
    };
    const poll = async (): Promise<void> => {
      if (!live || document.visibilityState !== "visible" || poller.busy()) return;
      await poller.poll();
      schedule(failures ? exponentialBackoffMs(failures, { baseMs: 500, capMs: 30_000 }) : 1800);
    };
    const foreground = (): void => {
      if (document.visibilityState !== "visible") {
        if (timer) clearTimeout(timer);
        timer = null; request?.abort(); poller.reset();
      } else {
        revalidate(false);
        if (!browserMode) void poll();
      }
    };
    const locked = (): void => {
      request?.abort(); poller.reset();
      useShellStore.getState().invalidateAppearance();
    };
    document.addEventListener("visibilitychange", foreground);
    window.addEventListener("focus", foreground);
    window.addEventListener(LIBRARY_LOCKED_EVENT, locked);
    if (browserMode) {
      const browserRevision = (event: Event): void => {
        const revision = (event as CustomEvent<{ revision?: unknown }>).detail?.revision;
        if (!Number.isSafeInteger(revision) || (revision as number) < 0) return;
        revalidate();
      };
      window.addEventListener(BROWSER_THEME_REVISION_EVENT, browserRevision);
      void useShellStore.getState().refreshAppearance();
      return () => {
        live = false; if (timer) clearTimeout(timer); request?.abort(); poller.reset();
        document.removeEventListener("visibilitychange", foreground);
        window.removeEventListener("focus", foreground);
        window.removeEventListener(BROWSER_THEME_REVISION_EVENT, browserRevision);
        window.removeEventListener(LIBRARY_LOCKED_EVENT, locked);
        useShellStore.getState().invalidateAppearance();
      };
    }
    if (document.visibilityState === "visible") void poll();
    return () => {
      live = false; if (timer) clearTimeout(timer); request?.abort(); poller.reset();
      document.removeEventListener("visibilitychange", foreground);
      window.removeEventListener("focus", foreground);
      window.removeEventListener(LIBRARY_LOCKED_EVENT, locked);
      useShellStore.getState().invalidateAppearance();
    };
  }, [enabled]);
}
