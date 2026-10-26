/**
 * What both Director panels (the Full Chat pop-out kind in director-panel.tsx and the Messenger's in messenger/panels/director) keep in common: the turn the panel reads (`viewAt`), the tab,
 * the one-at-a-time edit with its note, and the turn stepper's stops. One owner, so the two presentations cannot drift on when an edit is refused or when the panel jumps back to the latest.
 */
import { useEffect, useState } from "react";
import type { AppContext } from "../../../../app-contract";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import type { DirectorPanel } from "../../../../../studio/scene-director-edit";
import type { DirectorTabId } from "./director-core";
import { takeDirectorTab, useDirectorLive } from "./director-live";
import { useDirectorPanel } from "./use-director-panel";

export function useDirectorView(ctx: AppContext, chat: Pick<Chat, "id" | "updatedAt" | "activeBranchId">) {
  const [viewAt, setViewAt] = useState<string | null>(null);
  const data = useDirectorPanel(ctx, chat, viewAt);
  const live = useDirectorLive(chat.id);
  const [tab, setTab] = useState<DirectorTabId>(() => takeDirectorTab(chat.id) ?? "story");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // A new reply, a new take or a finished plan moves the latest: back to it.
  useEffect(() => setViewAt(null), [live.rev, chat.updatedAt, chat.activeBranchId]);
  useEffect(() => { if (live.tab) { const asked = takeDirectorTab(chat.id); if (asked) setTab(asked); } }, [live.tab, chat.id]);

  const edit = async (e: Parameters<typeof data.edit>[0], words: string): Promise<string | null> => {
    setBusy(true);
    const why = await data.edit(e, words);
    setBusy(false);
    setNote(why);
    return why;
  };
  return { data, live, viewAt, setViewAt, tab, setTab, note, setNote, busy, confirm, setConfirm, edit };
}

/** The turn stepper's place: the turns the Director saved a story for, which one is shown, and the move to another (the last stop is "latest", which reads no earlier turn). */
export function readingOf(panel: DirectorPanel, viewAt: string | null, setViewAt: (at: string | null) => void) {
  const stops = panel.history;
  const at = viewAt === null ? stops.length - 1 : stops.findIndex((h) => h.messageId === viewAt);
  const go = (to: number): void => setViewAt(to >= stops.length - 1 ? null : (stops[to]?.messageId ?? null));
  return { viewing: panel.at !== null, stops, at, go };
}
