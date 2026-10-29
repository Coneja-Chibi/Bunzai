/**
 * A tracker's side of the Story Director's automatic updates (plan 16): the frame's "Updated after reply N" line and its Undo, and what the "DM Updates" row needs (whether the Director is on, the
 * scene's Default AI Awareness). The line is driven by the trackers' state at the tip (`view.update`: the last change a reply's version made to the module on its own, shown while the module still holds
 * what it left), so it appears when the page reads the trackers again, which the app-wide `scene-trackers` event triggers after the Director's background round (use-trackers-heard.ts). It goes
 * once the module no longer holds what the update left (the person changed it, so Undo would refuse). Undo asks the server, which writes the module back to before the update as the person's own
 * edit on that reply, so it holds through swiping and regenerating it; then the trackers are read again. The Director panel is read for the settings the row needs.
 */
import { useState } from "react";
import type { TrackerModule } from "../../../../../stage/contracts/chat-store";
import type { TrackerUpdateLine as StateUpdate } from "../../../../../studio/tracker-state";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import { useDirectorPanel } from "./use-director-panel";
import type { TrackerView } from "../trackers/use-tracker";

export interface TrackerUpdateLine {
  /** The Director panel once read; null while it loads or when it cannot be read (the DM Updates row is then not drawn). */
  panel: DirectorPanel | null;
  /** The update to name, or null when there is none to show (none, undone, changed since). */
  update: StateUpdate | null;
  /** What the last Undo said: "undone", or the reason it changed nothing. */
  note: { kind: "undone" | "refused"; text: string; turn: number } | null;
  undo(): Promise<void>;
  dismiss(): void;
}

export function useTrackerUpdate(view: Pick<TrackerView<unknown>, "module" | "update" | "host" | "reload">, label: string): TrackerUpdateLine {
  const { ctx, chat, onChat } = view.host;
  const data = useDirectorPanel(ctx, chat);
  const panel = data.load.state === "ready" && data.load.panel.at === null ? data.load.panel : null;
  const [hidden, setHidden] = useState<string | null>(null);
  const [note, setNote] = useState<TrackerUpdateLine["note"]>(null);
  const update = view.update && hidden !== `${view.update.messageId}:${view.update.at}` ? view.update : null;
  return {
    panel, update, note,
    dismiss: () => { setNote(null); },
    undo: async () => {
      if (!update) return;
      const words = `Not undone: ${label} was changed after the update, so it was left as you have it.`;
      const why = await data.undoTracker(view.module as TrackerModule, update.messageId, words);
      if (why) { setNote({ kind: "refused", text: why, turn: update.number }); return; }
      setHidden(`${update.messageId}:${update.at}`);
      setNote({ kind: "undone", text: `Undone: the update from reply ${update.number} is taken back.`, turn: update.number });
      view.reload();
      try { const next = await ctx.api.openScene(chat.id); onChat?.(next.chat); } catch { /* the chat is read again with the next change */ }
    },
  };
}
