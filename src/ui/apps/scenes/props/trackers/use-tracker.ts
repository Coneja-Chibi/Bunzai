/**
 * One tracker module of a scene as a panel sees it (ChatStore rule 43): its state read through the module's own reader, the AI Context choice, and
 * the writes. A change is shown at once and written in order, one after another, so two quick clicks never overtake each other; a write that
 * fails puts back what was last saved and says so. A destructive change can leave an Undo that writes the state it replaced (RoleCall's dossier
 * cards do the same, DossierCardActions.tsx), so nothing the person clears is gone until they move on.
 * The panel is drawn docked and floating, so the state also follows the scene's chat when another surface changes it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chat, ChatTrackerEntry, JsonValue, TrackerContext, TrackerModule } from "../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../app-contract";
import { toErrorMessage } from "../../../../_shared/error-message";

export interface TrackerHost { ctx: AppContext; chat: Chat; onChat?(chat: Chat): void }

export interface TrackerView<D> {
  /** The module this view reads: the id the frame names its part by (`props.tracker.<module>`). */
  module: TrackerModule;
  data: D;
  /** The scene this view is of, for what the frame offers beside the state (Refresh from chat history). */
  host: TrackerHost;
  context: TrackerContext;
  /** What is stored, for a module whose default is not "always" (the Storyboards: Map and Renown start Off). */
  stored: ChatTrackerEntry | undefined;
  error: string | null;
  /** Computes the next state from the current one and keeps it. `undoLabel` leaves an Undo that restores the state replaced. */
  apply(compute: (data: D) => D, undoLabel?: string): void;
  /** `exact` keeps "always" as a stored choice instead of clearing the key, for a module whose default is not "always". */
  setContext(context: TrackerContext, exact?: boolean): void;
  /** RoleCall's per-tracker "DM Updates": the turns between the Story Director's updates of this tracker; null follows the scene's Default AI Awareness. */
  undo: { label: string; run(): void } | null;
}

export function useTracker<D>(host: TrackerHost, module: TrackerModule, read: (data: unknown) => D): TrackerView<D> {
  const stored = host.chat.trackers?.[module];
  const [entry, setEntry] = useState<ChatTrackerEntry | undefined>(stored);
  const [error, setError] = useState<string | null>(null);
  const [replaced, setReplaced] = useState<{ label: string; data: D } | null>(null);
  const latest = useRef(stored);
  const saved = useRef(stored);
  const queue = useRef(Promise.resolve());
  const mounted = useRef(true);
  const hostRef = useRef(host);
  hostRef.current = host;
  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => {
    if (stored === saved.current) return;
    saved.current = stored;
    latest.current = stored;
    setEntry(stored);
  }, [stored]);

  const write = useCallback((patch: { data?: JsonValue; context?: TrackerContext | null }) => {
    queue.current = queue.current.then(async () => {
      const { ctx, chat, onChat } = hostRef.current;
      try {
        const next = await ctx.api.setSceneTracker(chat.id, module, patch);
        saved.current = next.trackers?.[module];
        onChat?.(next);
        if (mounted.current) setError(null);
      } catch (e) {
        latest.current = saved.current;
        if (mounted.current) { setEntry(saved.current); setError(toErrorMessage(e, "this tracker could not be saved")); }
      }
    });
  }, [module]);

  const apply = useCallback((compute: (data: D) => D, undoLabel?: string) => {
    const before = read(latest.current?.data);
    const next = compute(before);
    if (next === before) return;
    setReplaced(undoLabel ? { label: undoLabel, data: before } : null);
    latest.current = { ...latest.current, data: next as JsonValue };
    setEntry(latest.current);
    write({ data: next as JsonValue });
  }, [read, write]);

  const setContext = useCallback((context: TrackerContext, exact = false) => {
    const { context: _old, ...rest } = latest.current ?? {};
    const clear = context === "always" && !exact;
    latest.current = clear ? rest : { ...rest, context };
    setEntry(latest.current);
    write({ context: clear ? null : context });
  }, [write]);

  const undo = replaced ? { label: replaced.label, run: () => apply(() => replaced.data) } : null;
  return { module, host, data: read(entry?.data), context: entry?.context ?? "always", stored: entry, error, apply, setContext, undo };
}
