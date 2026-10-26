/**
 * The Memory tab's one read and its writers (`ctx.api` summary calls; ChatStore rule 45). RoleCall saves a whole snapshot of every setting on a one-second debounce plus browser copies of the model and prompts, and
 * generates in the page; here each control writes only the keys it changed, and only when they differ from what is saved (a write that changes nothing would still rewrite the scene), one after another, so two quick
 * changes cannot overwrite each other. The text is read again whenever the scene changes, and while a run is going or automation is on, every few seconds while the tab is visible.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import type { AsyncState } from "../../../_shared/async-state";
import { toErrorMessage } from "../../../_shared/error-message";
import { useVisibleInterval } from "../../../_shared/use-visible-interval";
import type { ChatSummaryState } from "../../../app-contract-scenes";
import { automationActive, resolveSummary } from "../../../../core/summary/settings";
import { deepEq } from "../../../../core/guards";
import type { Chat, SummarySettingsPatch } from "../../../../stage/contracts/chat-store";

export type SummaryLoad = AsyncState<{ s: ChatSummaryState }>;

export interface SummaryView {
  load: SummaryLoad;
  /** A change or a Backfill is in flight. */
  busy: boolean;
  /** A Backfill's failure, in the sentence that says why; cleared by the next run. */
  runError: string | null;
  patch(patch: SummarySettingsPatch): Promise<void>;
  /** Saves the person's own text; resolves with the failure's sentence, or null when it was saved. */
  save(text: string): Promise<string | null>;
  backfill(): Promise<void>;
  /** Runs the automatic summary step once now. */
  summarizeNow(): Promise<void>;
}

/** The keys of a patch that would change what is saved. */
export function changedKeys(saved: ChatSummaryState["settings"], patch: SummarySettingsPatch): SummarySettingsPatch {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const now = (saved as Record<string, unknown>)[key] ?? null;
    if (!deepEq(now, value ?? null)) out[key] = value;
  }
  return out as SummarySettingsPatch;
}

const POLL_MS = 3_000;

export function useSummary(ctx: AppContext, chat: Chat): SummaryView {
  const [load, setLoad] = useState<SummaryLoad>({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const current = useRef<ChatSummaryState | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const live = useRef(0);
  // An answer that arrives after the wing is gone is dropped, as one from before the latest read is.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const readNow = useCallback(() => {
    const mine = ++live.current;
    ctx.api.getSceneSummary(chat.id).then(
      (s) => { if (alive.current && mine === live.current) { current.current = s; setLoad({ state: "ready", s }); } },
      (e: unknown) => { if (alive.current && mine === live.current) setLoad({ state: "failed", why: toErrorMessage(e, "The summary could not be read.") }); },
    );
  }, [ctx, chat.id]);
  useEffect(() => { readNow(); }, [readNow, chat.updatedAt, chat.activeBranchId]);
  const s = load.state === "ready" ? load.s : null;
  useVisibleInterval(readNow, s && (s.running || automationActive(resolveSummary(s.settings))) ? POLL_MS : null);

  /** Runs `work` after everything before it has finished, keeping the page's state to the last answer. */
  const after = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(work, work);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);
  const taken = useCallback((next: ChatSummaryState) => { live.current++; current.current = next; setLoad({ state: "ready", s: next }); }, []);

  const patch = useCallback((p: SummarySettingsPatch): Promise<void> => after(async () => {
    const changed = changedKeys(current.current?.settings ?? {}, p);
    if (Object.keys(changed).length === 0) return;
    setBusy(true);
    try { taken(await ctx.api.setSceneSummarySettings(chat.id, changed)); }
    catch (e) { setRunError(toErrorMessage(e, "The setting could not be saved.")); }
    finally { setBusy(false); }
  }), [after, ctx, chat.id, taken]);

  const save = useCallback((text: string): Promise<string | null> => after(async () => {
    setBusy(true);
    try { taken(await ctx.api.saveSceneSummary(chat.id, text)); return null; }
    catch (e) { return toErrorMessage(e, "The summary could not be saved."); }
    finally { setBusy(false); }
  }), [after, ctx, chat.id, taken]);

  const backfill = useCallback((): Promise<void> => after(async () => {
    setBusy(true);
    setRunError(null);
    setLoad((l) => (l.state === "ready" ? { state: "ready", s: { ...l.s, running: true } } : l));
    try { taken(await ctx.api.backfillSceneSummary(chat.id)); }
    catch (e) { setRunError(toErrorMessage(e, "Backfill failed.")); readNow(); }
    finally { setBusy(false); }
  }), [after, ctx, chat.id, taken, readNow]);

  const summarizeNow = useCallback((): Promise<void> => after(async () => {
    setBusy(true);
    setRunError(null);
    setLoad((l) => (l.state === "ready" ? { state: "ready", s: { ...l.s, running: true } } : l));
    try { taken(await ctx.api.summarizeSceneNow(chat.id)); }
    catch (e) { setRunError(toErrorMessage(e, "The summary could not be written.")); readNow(); }
    finally { setBusy(false); }
  }), [after, ctx, chat.id, taken, readNow]);

  return { load, busy, runError, patch, save, backfill, summarizeNow };
}
