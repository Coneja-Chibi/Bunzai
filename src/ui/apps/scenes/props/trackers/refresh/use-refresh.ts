/**
 * Refresh from chat history for one tracker (RoleCall's strip button, ImmersionPanelWrapper handleRefresh, immersion/index.tsx:392-403): ask the scene's model about the whole
 * module, hold the answer as a PROPOSAL, and keep it only when the person accepts. RoleCall applies the answer at once, discards the result (a failed refresh looks finished)
 * and has no cancel; here a failure says why and changes nothing, Cancel works, and an answer read for another scene, or for a tracker that has changed since, is dropped at
 * Accept. Accepting goes through the tracker's own `apply` as the person's own write on the newest reply, so it stays through a swipe or a regenerate of that reply and the frame's Undo brings the replaced state back.
 */
import { useEffect, useRef, useState } from "react";
import { refreshSpecOf } from "../../../../../../core/trackers";
import type { TrackerRefresh } from "../../../../../../studio/scene-tracker-refresh";
import { toErrorMessage } from "../../../../../_shared/error-message";
import type { TrackerView } from "../use-tracker";

export type RefreshPhase =
  | { at: "idle" }
  | { at: "working" }
  | { at: "ready"; proposal: TrackerRefresh; base: string }
  | { at: "same" }
  | { at: "failed"; error: string; hint?: string }
  | { at: "cancelled" };

export const UNDO_LABEL = "Refreshed from chat history";
const stateOf = (v: Pick<TrackerView<unknown>, "raw">): string => JSON.stringify(v.raw ?? null);
export const isEmpty = (p: TrackerRefresh): boolean => p.skipped.length === 0 && p.diff.added.length + p.diff.changed.length + p.diff.removed.length === 0;

export function useRefresh(view: Pick<TrackerView<unknown>, "module" | "apply" | "raw" | "host">, label: string) {
  const [phase, setPhase] = useState<RefreshPhase>({ at: "idle" });
  const abort = useRef<AbortController | null>(null);
  const latest = useRef(view);
  latest.current = view;
  const chatId = view.host.chat.id;
  const enabled = refreshSpecOf(view.module) !== undefined;
  useEffect(() => () => abort.current?.abort(), []);
  // A different scene: whatever was being read or held was read for the old one.
  useEffect(() => { abort.current?.abort(); setPhase({ at: "idle" }); }, [chatId]);

  const run = (): void => {
    if (!enabled) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const asked = { chatId: latest.current.host.chat.id, base: stateOf(latest.current) };
    setPhase({ at: "working" });
    latest.current.host.ctx.api.proposeTrackerRefresh({ chatId: asked.chatId, module: view.module }, controller.signal).then(
      (got) => {
        if (controller.signal.aborted) return;
        if (got.chatId !== latest.current.host.chat.id) setPhase({ at: "failed", error: "Refresh dropped. It was read for another scene.", hint: `Nothing in this scene was touched.` });
        else if (asked.base !== stateOf(latest.current)) setPhase({ at: "failed", error: `Refresh was dropped. ${label} changed while it was reading.`, hint: "Undo or another edit moved the tracker. Refresh again to read it as it is now." });
        else setPhase(isEmpty(got) ? { at: "same" } : { at: "ready", proposal: got, base: asked.base });
      },
      (e: unknown) => { if (!controller.signal.aborted) setPhase({ at: "failed", error: `Refresh failed. ${toErrorMessage(e, "The model could not be asked.")}`, hint: `${label} is unchanged.` }); },
    );
  };
  const cancel = (): void => { abort.current?.abort(); setPhase({ at: "cancelled" }); };
  const dismiss = (): void => setPhase({ at: "idle" });
  const accept = (): void => {
    if (phase.at !== "ready") return;
    const p = phase.proposal;
    if (p.chatId !== latest.current.host.chat.id) { setPhase({ at: "failed", error: "Refresh dropped. It was read for another scene.", hint: "Nothing in this scene was touched." }); return; }
    if (phase.base !== stateOf(latest.current)) { setPhase({ at: "failed", error: `Refresh was dropped. ${label} changed while it was waiting for review.`, hint: "Refresh again to read it as it is now." }); return; }
    latest.current.apply(() => p.proposed, UNDO_LABEL);
    setPhase({ at: "idle" });
  };
  return { phase, enabled, run, cancel, dismiss, accept };
}
export type Refresh = ReturnType<typeof useRefresh>;
