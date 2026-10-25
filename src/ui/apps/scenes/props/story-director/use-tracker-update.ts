/**
 * A tracker's side of the Story Director's automatic updates (plan 16): the frame's "Updated by the Story Director, reply N" line and its Undo, and what the "DM Updates" row needs (whether the
 * Director is on, the scene's Default AI Awareness). The line is driven by the tracker's own saved entry (`ChatTrackerEntry.update`, with the `undone` list), so it appears when the page reads
 * the scene again, which the app-wide `scene-trackers` event triggers after the Director's background round (use-trackers-heard.ts). It is not drawn when that update is on the
 * entry's `undone` list (an Undo sticks across switching versions), and it goes once the tracker no longer holds what the update left (the person changed it, so Undo would refuse).
 * Undo asks the server, which takes back only what the update changed, then the scene is read again so the frame shows what is saved. The Director panel is read for the settings the row needs.
 */
import { useState } from "react";
import { deepEq } from "../../../../../core/guards";
import type { TrackerModule, TrackerUpdate } from "../../../../../stage/contracts/chat-store";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import { useDirectorPanel } from "./use-director-panel";
import type { TrackerView } from "../trackers/use-tracker";

export interface TrackerUpdateLine {
  /** The Director panel once read; null while it loads or when it cannot be read (the DM Updates row is then not drawn). */
  panel: DirectorPanel | null;
  /** The update to name, or null when there is none to show (none, undone, changed since). */
  update: TrackerUpdate | null;
  /** What the last Undo said: "undone", or the reason it changed nothing. */
  note: { kind: "undone" | "refused"; text: string; turn: number } | null;
  undo(): Promise<void>;
  dismiss(): void;
}

export function useTrackerUpdate(view: Pick<TrackerView<unknown>, "module" | "stored" | "host">, label: string): TrackerUpdateLine {
  const { ctx, chat, onChat } = view.host;
  const data = useDirectorPanel(ctx, chat);
  const panel = data.load.state === "ready" && data.load.panel.at === null ? data.load.panel : null;
  const [hidden, setHidden] = useState<string | null>(null);
  const [note, setNote] = useState<TrackerUpdateLine["note"]>(null);
  const saved = view.stored?.update;
  const isUndone = saved !== undefined && (view.stored?.undone ?? []).some((u) => u.messageId === saved.messageId && u.swipeId === saved.swipeId);
  const held = saved !== undefined && deepEq(view.stored?.data ?? null, saved.after);
  const update = saved && !isUndone && held && hidden !== `${saved.messageId}:${saved.swipeId}` ? saved : null;
  return {
    panel, update, note,
    dismiss: () => { setNote(null); },
    undo: async () => {
      if (!update) return;
      const words = `Not undone: ${label} was changed after the update, so it was left as you have it.`;
      const why = await data.undoTracker(view.module as TrackerModule, update.messageId, words);
      if (why) { setNote({ kind: "refused", text: why, turn: update.turn }); return; }
      setHidden(`${update.messageId}:${update.swipeId}`);
      setNote({ kind: "undone", text: `Undone: the update from reply ${update.turn} is taken back.`, turn: update.turn });
      try { const next = await ctx.api.openScene(chat.id); onChat?.(next.chat); } catch { /* the chat is read again with the next change */ }
    },
  };
}
