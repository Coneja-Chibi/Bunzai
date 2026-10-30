/** The bounded, lock-cleared projection of each scene's durable Dramaturg conversation and current streamed preview. */
import { useEffect, useSyncExternalStore } from "react";
import type { DramaturgPanel, DramaturgStreamEvent } from "../../../../app-contract-dramaturg";
import type { DramaturgRead, DramaturgSettingsPatch } from "../../../../../stage/contracts/dramaturg-types";
import type { ScenesApi } from "../../../../app-contract-scenes";
import { apiStatusIs } from "../../../../_shared/api-fetch";
import { attachCacheLockListener, enforceBudgets, registerCache } from "../../../../_shared/caches";

type Api = Pick<ScenesApi, "getSceneDramaturg" | "setSceneDramaturgSettings" | "clearSceneDramaturg" | "askSceneDramaturg" | "stopSceneDramaturg">;
export interface DramaturgPending { question: string; revision: number; text: string; reads: DramaturgRead[] }
export interface DramaturgLive { panel: DramaturgPanel | null; loading: boolean; error: string | null; pending: DramaturgPending | null }
interface Entry { value: DramaturgLive; read: number; panelBytes: number; abort?: AbortController }
const EMPTY: DramaturgLive = { panel: null, loading: false, error: null, pending: null };
const states = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();
const BUDGET = 32 * 1024 * 1024;
const MAX_SCENES = 4;
const BUSY_POLL_MS = 3000;
const why = (e: unknown): string => e instanceof Error ? e.message : String(e);
export const dramaturgState = (chatId: string): DramaturgLive => states.get(chatId)?.value ?? EMPTY;
const notify = (chatId: string): void => { for (const fn of listeners.get(chatId) ?? []) fn(); };
const current = (id: string, entry: Entry): boolean => states.get(id) === entry;

function bytes(): number {
  let size = 0;
  for (const { value, panelBytes } of states.values()) size += panelBytes + 2 * ((value.error?.length ?? 0) + (value.pending?.text.length ?? 0) + (value.pending?.question.length ?? 0) + JSON.stringify(value.pending?.reads ?? []).length);
  return size;
}
function drop(chatId: string): void {
  const old = states.get(chatId);
  states.delete(chatId);
  old?.abort?.abort();
  notify(chatId);
}
function trim(budget: number): void {
  while (states.size && (states.size > MAX_SCENES || bytes() > budget)) drop(states.keys().next().value!);
}
/** Locking fences all outstanding callbacks by retiring their entry identities before aborting transport. */
export function resetDramaturgLive(): void {
  for (const id of [...states.keys()]) drop(id);
}
function entryFor(chatId: string): Entry {
  registerCache({ name: "dramaturg", budgetBytes: BUDGET, bytes, trim, clear: resetDramaturgLive, plaintext: true });
  const entry = states.get(chatId) ?? { value: EMPTY, read: 0, panelBytes: 0 };
  states.delete(chatId);
  states.set(chatId, entry);
  trim(BUDGET);
  return entry;
}
function put(id: string, entry: Entry, patch: Partial<DramaturgLive>): void {
  if (!current(id, entry)) return;
  if (patch.panel !== undefined) entry.panelBytes = patch.panel ? 2 * JSON.stringify(patch.panel).length : 0;
  entry.value = { ...entry.value, ...patch };
  trim(BUDGET);
  enforceBudgets();
  notify(id);
}
function take(id: string, entry: Entry, panel: DramaturgPanel): void {
  if (!current(id, entry) || panel.thread.revision < (entry.value.panel?.thread.revision ?? 0)) return;
  entry.read++;
  put(id, entry, { panel, loading: false, error: null });
}

export async function loadDramaturg(api: Api, chatId: string): Promise<void> {
  const entry = entryFor(chatId), read = ++entry.read;
  put(chatId, entry, { loading: true });
  try {
    const panel = await api.getSceneDramaturg(chatId);
    if (read === entry.read) take(chatId, entry, panel);
  } catch (e) {
    if (read === entry.read) put(chatId, entry, { loading: false, error: why(e) });
  }
}
async function rereadKeeping(api: Api, id: string, entry: Entry, reason: string): Promise<void> {
  if (!current(id, entry)) return;
  await loadDramaturg(api, id);
  put(id, entry, { error: reason });
}

/** Transport can end while the server continues; only confirmed server state replaces the preview. */
export async function askDramaturg(api: Api, chatId: string, question: string): Promise<boolean> {
  const entry = entryFor(chatId), text = question.trim(), now = entry.value;
  if (!now.panel || now.pending || !text) return false;
  const revision = now.panel.thread.revision, abort = new AbortController();
  entry.abort = abort;
  entry.read++;
  let refused = false;
  put(chatId, entry, { pending: { question: text, revision, text: "", reads: [] }, error: null });
  const onEvent = (event: DramaturgStreamEvent): void => {
    if (!current(chatId, entry)) return;
    const pending = entry.value.pending;
    if (event.type === "text") { if (pending) put(chatId, entry, { pending: { ...pending, text: pending.text + event.delta } }); return; }
    if (event.type === "read") { if (pending) put(chatId, entry, { pending: { ...pending, reads: [...pending.reads, { tool: event.tool, summary: event.summary }] } }); return; }
    const panel = entry.value.panel;
    if (event.thread && panel) take(chatId, entry, { ...panel, thread: event.thread, busy: false });
    put(chatId, entry, { pending: null, error: event.type === "failed" ? event.message : null });
    if (!event.thread) void rereadKeeping(api, chatId, entry, event.type === "failed" ? event.message : "");
  };
  try { await api.askSceneDramaturg(chatId, text, revision, onEvent, abort.signal); }
  catch (e) {
    refused = true;
    put(chatId, entry, { pending: null, error: why(e) });
    if (current(chatId, entry) && apiStatusIs(e, 409)) await rereadKeeping(api, chatId, entry, why(e));
  } finally {
    if (entry.abort === abort) delete entry.abort;
    put(chatId, entry, { pending: null });
  }
  return !refused;
}

export async function stopDramaturg(api: Api, chatId: string): Promise<void> {
  const entry = entryFor(chatId), { pending, panel } = entry.value;
  try { await api.stopSceneDramaturg(chatId, pending?.revision ?? panel?.thread.revision); }
  catch (e) { put(chatId, entry, { error: why(e) }); }
  if (current(chatId, entry) && !pending) await loadDramaturg(api, chatId);
}
export async function clearDramaturg(api: Api, chatId: string): Promise<void> {
  const entry = entryFor(chatId), panel = entry.value.panel;
  if (!panel) return;
  entry.read++;
  try { take(chatId, entry, await api.clearSceneDramaturg(chatId, panel.thread.revision)); }
  catch (e) {
    put(chatId, entry, { error: why(e) });
    if (current(chatId, entry) && apiStatusIs(e, 409)) await rereadKeeping(api, chatId, entry, why(e));
  }
}
export async function saveDramaturgSettings(api: Api, chatId: string, patch: DramaturgSettingsPatch): Promise<string | null> {
  const entry = entryFor(chatId);
  entry.read++;
  try {
    await api.setSceneDramaturgSettings(chatId, patch);
    // Another settings request may have committed while this response resolved its model metadata.
    if (current(chatId, entry)) await loadDramaturg(api, chatId);
    return null;
  } catch (e) { return why(e); }
}

/** Retained conversations live with the Scenes app, including while every Dramaturg panel is closed. */
export function useDramaturgCacheLifetime(): void {
  useEffect(() => {
    const detach = attachCacheLockListener(window);
    return () => { detach(); resetDramaturgLive(); };
  }, []);
}

export function useDramaturg(api: Api, chatId: string, refresh: unknown = null): DramaturgLive {
  const state = useSyncExternalStore((fn) => {
    const set = listeners.get(chatId) ?? new Set();
    set.add(fn); listeners.set(chatId, set);
    return () => { set.delete(fn); if (!set.size) listeners.delete(chatId); };
  }, () => dramaturgState(chatId), () => EMPTY);
  useEffect(() => { if (!dramaturgState(chatId).pending) void loadDramaturg(api, chatId); }, [api, chatId, refresh]);
  const waiting = state.panel?.busy === true && !state.pending;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void loadDramaturg(api, chatId), BUSY_POLL_MS);
    return () => clearInterval(timer);
  }, [api, chatId, waiting]);
  return state;
}
