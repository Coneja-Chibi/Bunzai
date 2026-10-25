/**
 * Refresh Enabled Boards (RoleCall's batch button, QuickPlayPanel.tsx:1194-1238 and StagecraftExtensions.tsx:873-907): every enabled legacy tracker, one model call after another,
 * "Refreshing {label} (i/n)". RoleCall cannot stop a run, applies each answer as it lands, hides every failure in the console and, when the person switches chats mid-run, applies
 * the old chat's answers into the new one. Here the run can be cancelled, each answer is held as a proposal for one combined review, a failure is kept on its row, and a proposal
 * read for another scene, or for a tracker that has changed since, is dropped at Accept. An accepted board is written through the scene's tracker write and keeps its own Undo.
 */
import { useEffect, useRef, useState } from "react";
import type { Chat, JsonValue, TrackerModule } from "../../../../../../stage/contracts/chat-store";
import type { TrackerRefresh } from "../../../../../../studio/scene-tracker-refresh";
import { toErrorMessage } from "../../../../../_shared/error-message";
import type { AppContext } from "../../../../../app-contract";
import { isEmpty } from "./use-refresh";

export interface Board { module: TrackerModule; label: string }
export interface Host { ctx: AppContext; chat: Chat; onChat?(chat: Chat): void }

export type EntryStatus = "ready" | "same" | "failed" | "accepted" | "discarded" | "dropped" | "undone" | "working";
export interface Entry extends Board {
  status: EntryStatus;
  proposal?: TrackerRefresh;
  /** Why it failed or was dropped. */
  why?: string;
  /** The tracker as it was when the model was asked, to notice a change before Accept. */
  base: string;
  /** What Accept replaced, for Undo (absent: the tracker had nothing stored). */
  before?: JsonValue;
}

export type Run =
  | { at: "idle" }
  | { at: "running"; i: number; n: number; label: string }
  | { at: "review"; entries: Entry[] }
  | { at: "cancelled"; entries: Entry[]; n: number }
  | { at: "none" };

const stateOf = (chat: Chat, m: TrackerModule): string => JSON.stringify(chat.trackers?.[m]?.data ?? null);
const OTHER_SCENE = "Dropped: this was read for another scene.";

export function useRefreshAll(host: Host, boards: readonly Board[]) {
  const [run, setRun] = useState<Run>({ at: "idle" });
  const abort = useRef<AbortController | null>(null);
  const latest = useRef(host);
  latest.current = host;
  const chatId = host.chat.id;
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { abort.current?.abort(); setRun({ at: "idle" }); }, [chatId]);

  const ask = async (b: Board, signal: AbortSignal): Promise<Entry> => {
    const base = stateOf(latest.current.chat, b.module);
    try {
      const got = await latest.current.ctx.api.proposeTrackerRefresh({ chatId: latest.current.chat.id, module: b.module }, signal);
      if (got.chatId !== latest.current.chat.id) return { ...b, base, status: "dropped", why: OTHER_SCENE };
      return { ...b, base, status: isEmpty(got) ? "same" : "ready", proposal: got };
    } catch (e) {
      return { ...b, base, status: "failed", why: `The model's answer could not be used. ${toErrorMessage(e, "The model could not be asked.")} ${b.label} is unchanged.` };
    }
  };

  const start = async (): Promise<void> => {
    if (boards.length === 0) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const entries: Entry[] = [];
    for (const [at, b] of boards.entries()) {
      setRun({ at: "running", i: at + 1, n: boards.length, label: b.label });
      const entry = await ask(b, controller.signal);
      if (controller.signal.aborted) { setRun({ at: "cancelled", entries, n: boards.length }); return; }
      entries.push(entry);
    }
    setRun(entries.some((e) => e.status === "ready" || e.status === "failed" || e.status === "dropped") ? { at: "review", entries } : { at: "none" });
  };
  const cancel = (): void => abort.current?.abort();
  // Cancel while a call is in flight: the loop sees the abort after its await and files what it has.
  const close = (): void => setRun({ at: "idle" });
  const review = (): void => setRun((r) => (r.at === "cancelled" ? { at: "review", entries: r.entries } : r));

  const patch = (m: TrackerModule, next: Partial<Entry>): void =>
    setRun((r) => (r.at === "review" ? { ...r, entries: r.entries.map((e) => (e.module === m ? { ...e, ...next } : e)) } : r));
  const current = (m: TrackerModule): Entry | undefined => (run.at === "review" ? run.entries.find((e) => e.module === m) : undefined);

  const accept = async (m: TrackerModule): Promise<void> => {
    const entry = current(m);
    if (!entry || entry.status !== "ready" || !entry.proposal) return;
    const { ctx, chat, onChat } = latest.current;
    if (entry.proposal.chatId !== chat.id) { patch(m, { status: "dropped", why: OTHER_SCENE }); return; }
    if (entry.base !== stateOf(chat, m)) { patch(m, { status: "dropped", why: `Dropped: ${entry.label} changed while it was reading.` }); return; }
    const before = chat.trackers?.[m]?.data;
    try {
      const next = await ctx.api.setSceneTracker(chat.id, m, { data: entry.proposal.proposed as JsonValue });
      onChat?.(next);
      patch(m, { status: "accepted", ...(before === undefined ? {} : { before }) });
    } catch (e) { patch(m, { status: "failed", why: toErrorMessage(e, `${entry.label} could not be saved.`) }); }
  };
  const acceptAll = async (): Promise<void> => {
    if (run.at !== "review") return;
    for (const e of run.entries) if (e.status === "ready") await accept(e.module);
  };
  const undo = async (m: TrackerModule): Promise<void> => {
    const entry = current(m);
    if (!entry || entry.status !== "accepted") return;
    const { ctx, chat, onChat } = latest.current;
    try {
      const next = await ctx.api.setSceneTracker(chat.id, m, { data: entry.before === undefined ? null : entry.before });
      onChat?.(next);
      patch(m, { status: "undone" });
    } catch (e) { patch(m, { status: "failed", why: toErrorMessage(e, `${entry.label} could not be restored.`) }); }
  };
  const discard = (m: TrackerModule): void => patch(m, { status: "discarded" });
  const discardAll = (): void => setRun((r) => (r.at === "review" ? { ...r, entries: r.entries.map((e) => (e.status === "ready" ? { ...e, status: "discarded" as const } : e)) } : r));
  const retry = async (m: TrackerModule): Promise<void> => {
    const entry = current(m);
    if (!entry) return;
    patch(m, { status: "working" });
    const controller = new AbortController();
    abort.current = controller;
    const again = await ask({ module: m, label: entry.label }, controller.signal);
    if (!controller.signal.aborted) patch(m, { ...again, why: again.why });
  };
  return { run, start, cancel, close, review, accept, acceptAll, undo, discard, discardAll, retry };
}
export type RefreshAll = ReturnType<typeof useRefreshAll>;
