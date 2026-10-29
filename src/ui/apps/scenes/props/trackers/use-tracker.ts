/**
 * One tracker module of a scene as a panel sees it (ChatStore rule 43): its state read through the module's own reader, the AI Context choice, and the writes. A stateful module's data is
 * scene state at the take's tip (tracker-states.ts: a change is the person's edit on the tip reply, so it stays with that reply through swiping and regenerating it); a Storyboard's only data
 * is its AI Context profile, a setting. A change is shown at once and written in order, one after another, so two quick clicks never overtake each other; a write that fails puts back what was
 * last saved and says so. A destructive change can leave an Undo that writes the state it replaced (RoleCall's dossier cards do the same, DossierCardActions.tsx), so nothing the person clears
 * is gone until they move on. The panel is drawn docked and floating, so the state also follows the scene when another surface changes it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { hasTrackerState } from "../../../../../core/trackers";
import type { Chat, ChatTrackerEntry, JsonValue, TrackerContext, TrackerModule } from "../../../../../stage/contracts/chat-store";
import type { TrackerUpdateLine } from "../../../../../studio/tracker-state";
import type { AppContext } from "../../../../app-contract";
import { toErrorMessage } from "../../../../_shared/error-message";
import { deepEq } from "../../../../../core/guards";
import { useTrackerStates } from "./tracker-states";

export interface TrackerHost { ctx: AppContext; chat: Chat; onChat?(chat: Chat): void }

export interface TrackerView<D> {
  /** The module this view reads: the id the frame names its part by (`props.tracker.<module>`). */
  module: TrackerModule;
  data: D;
  /** The module's saved data as it is stored (absent while nothing was written), for telling whether it changed. */
  raw: JsonValue | undefined;
  /** The scene this view is of, for what the frame offers beside the state (Refresh from chat history). */
  host: TrackerHost;
  context: TrackerContext;
  /** The module's settings (AI Context, automatic updates, sub-features); a Storyboard's holds its profile too. */
  stored: ChatTrackerEntry | undefined;
  /** The last update a reply made to this module on its own, while the module still holds what it left; null otherwise. */
  update: TrackerUpdateLine | null;
  error: string | null;
  /** The module has a saved state of which nothing could be read: the panel shows its empty start and says so. */
  unreadable: boolean;
  /** Reads the trackers again (after something this view did not write changed them). */
  reload(): void;
  /**
   * Computes the next state from the current one and keeps it, as the person's own write on the newest reply (an accepted Refresh or Generate included). `undoLabel` leaves an Undo that restores the state replaced. `also` writes the whole next state of other modules in the same step (Cast spends
   * Stats and notes the cast in the Spellbook together: all or nothing), each from the data it was computed from.
   */
  apply(compute: (data: D) => D, undoLabel?: string, opts?: { also?: Partial<Record<TrackerModule, { base: JsonValue | null; data: JsonValue }>> }): void;
  /** `exact` keeps "always" as a stored choice instead of clearing the key, for a module whose default is not "always". */
  setContext(context: TrackerContext, exact?: boolean): void;
  /** RoleCall's per-tracker "DM Updates": the turns between the Story Director's updates of this tracker; null follows the scene's Default AI Awareness. */
  undo: { label: string; run(): void } | null;
}

/** `settingsOnly` reads and writes the module's settings alone (its AI Context row in the settings menu): it never reads the module's state. */
export function useTracker<D>(host: TrackerHost, module: TrackerModule, read: (data: unknown) => D, settingsOnly = false): TrackerView<D> {
  const stateful = !settingsOnly && hasTrackerState(module);
  const settings = host.chat.trackers?.[module];
  const sync = useTrackerStates(host.ctx, host.chat, stateful);
  const stored: JsonValue | undefined = stateful ? sync.states?.data[module] : settings?.data;
  const [data, setData] = useState<JsonValue | undefined>(stored);
  // The AI Context choice is shown at once and written in order, like the data; it follows the scene's settings when they change.
  const [context, setChosen] = useState<TrackerContext | undefined>(settings?.context);
  useEffect(() => setChosen(settings?.context), [settings?.context]);
  const [error, setError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<{ label: string; data: D } | null>(null);
  const latest = useRef(stored);
  const saved = useRef(stored);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);
  const hostRef = useRef(host);
  hostRef.current = host;
  const syncRef = useRef(sync);
  syncRef.current = sync;
  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => {
    if (deepEq(stored ?? null, saved.current ?? null)) return;
    saved.current = stored;
    latest.current = stored;
    setData(stored);
  }, [stored]);

  /** One write in order; on failure what was last saved is put back and the reason is said. */
  const write = useCallback((job: () => Promise<{ saved: JsonValue | undefined }>) => {
    queue.current = queue.current.then(async () => {
      try {
        const done = await job();
        saved.current = done.saved;
        if (mounted.current) setError(null);
      } catch (e) {
        latest.current = saved.current;
        if (mounted.current) { setData(saved.current); setError(toErrorMessage(e, "this tracker could not be saved")); }
      }
    });
  }, []);

  const apply = useCallback((compute: (data: D) => D, undoLabel?: string, opts: { also?: Partial<Record<TrackerModule, { base: JsonValue | null; data: JsonValue }>> } = {}) => {
    const before = read(latest.current);
    const base = latest.current ?? null;
    const next = compute(before);
    if (next === before && opts.also === undefined) return;
    setReplaced(undoLabel ? { label: undoLabel, data: before } : null);
    latest.current = next as JsonValue;
    setData(latest.current);
    write(async () => {
      const { ctx, chat, onChat } = hostRef.current;
      if (!stateful) {
        const done = await ctx.api.setSceneTracker(chat.id, module, { data: next as JsonValue });
        onChat?.(done);
        return { saved: done.trackers?.[module]?.data };
      }
      // The change is from the data the panel computed it from, so only what the person changed is written.
      const others = Object.entries(opts.also ?? {}).map(([m, w]) => ({ module: m as TrackerModule, data: w.data, base: w.base }));
      const done = await syncRef.current.write([{ module, data: next as JsonValue, base }, ...others]);
      return { saved: done.data[module] };
    });
  }, [read, write, module, stateful]);

  const setContext = useCallback((choice: TrackerContext, exact = false) => {
    const clear = choice === "always" && !exact;
    setChosen(clear ? undefined : choice);
    write(async () => {
      const { ctx, chat, onChat } = hostRef.current;
      try {
        const done = await ctx.api.setSceneTracker(chat.id, module, { context: clear ? null : choice });
        onChat?.(done);
      } catch (e) {
        setChosen(hostRef.current.chat.trackers?.[module]?.context);
        throw e;
      }
      return { saved: saved.current };
    });
  }, [write, module]);

  const undo = replaced ? { label: replaced.label, run: () => apply(() => replaced.data) } : null;
  const update = sync.states?.updates[module];
  const held = update !== undefined && deepEq(stored ?? null, update.after);
  const { context: _old, ...rest } = settings ?? {};
  const kept: ChatTrackerEntry = { ...rest, ...(context ? { context } : {}) };
  return { module, host, data: read(data), raw: data, context: context ?? "always", stored: Object.keys(kept).length > 0 ? kept : undefined, update: update && held ? update : null, error, unreadable: sync.states?.unreadable.includes(module) === true, reload: sync.reload, apply, setContext, undo };
}
