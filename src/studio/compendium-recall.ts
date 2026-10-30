/**
 * The Compendium's recall pass (04b D4): before a reply, one model call picks the entries
 * the narrator should see. The scene's own model answers, or the Compendium's when the person chose one; the answer is one JSON
 * object, parsed once against its index (core/compendium/recall-parse.ts), with at most one more call in all - a repair after an
 * answer that was not the object, or a demand for more when fewer than the minimum came back (RoleCall `pregen-retrieval.ts`
 * retries both, :444-512, :594-663). Nothing here can fail the reply: every outcome is a result the turn records in its trace,
 * a failure or a timeout is a `failed` result, and only the person's Stop (the turn's own signal) is told apart. Picks are cached
 * per (scene, recent messages, book revisions, settings, Guide) and only a success is kept, so a regenerate asks once.
 * No prompt text, entry text or model answer is logged (04b F12).
 */
import { buildRecallIndex } from "../core/compendium/recall-index";
import { moreNudge, recallMessages, REPAIR_NUDGE } from "../core/compendium/recall-prompt";
import { parseRecall, type RecallParse } from "../core/compendium/recall-parse";
import { accessOf, canRead, resolveCompendium } from "../core/compendium/defaults";
import type { RecallEntry, RecallHit } from "../core/assembly/recall-place";
import type { HistoryMessage } from "../core/assembly/types";
import { getStoredLoreRevision } from "../core/lore/engine/stored-input";
import type { LoreBookInput } from "../core/lore/engine";
import { splitReasoning } from "../core/reasoning-tags";
import { sha256Hex } from "../core/sha256";
import { toErrorMessage } from "../error-message";
import type { Chat, ChatConnection, JsonObject } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import { selectedGuides } from "./guides";
import type { Connected } from "./scene-turn";
import type { LoadedTurn } from "./scene-turn-load";

/** A recall that has not answered by now fails, and the reply goes on without it. */
export const RECALL_TIMEOUT_MS = 90_000;
/** The index never exceeds this many tokens, or half the Compendium model's stated window when that is smaller. */
export const RECALL_INDEX_TOKENS = 20_000;
const MAX_OUTPUT_TOKENS = 2_000;
const CACHE_SIZE = 32;

export interface RecallRun {
  status: "recalled" | "empty" | "skipped" | "failed";
  /** Why it was skipped or failed, in words for the person; never prompt or entry text. */
  reason?: string;
  model?: string;
  /** The model calls made: 0 for a skipped pass or a cache hit, at most 2. */
  calls: number;
  cached?: true;
  /** The selector's picks in its order, with its reasons: for the trace and Activity only, never for the narrator. */
  selected: { entryKey: string; title: string; reason: string }[];
  /** What goes to the assembler: the picked entries' own text. */
  entries: RecallEntry[];
  /** Handles the selector named that the index never held, repeats, and picks over the cap; entries the index left out for its budget. */
  unknown: number;
  repeated: number;
  trimmed: number;
  omitted: number;
}

const blank = (status: RecallRun["status"], reason?: string, over: Partial<RecallRun> = {}): RecallRun => ({ status, ...(reason ? { reason } : {}), calls: 0, selected: [], entries: [], unknown: 0, repeated: 0, trimmed: 0, omitted: 0, ...over });

const cache = new Map<string, RecallRun>();

/** The books recall may read this turn: enabled, present (the loader's own list) and not off or write only for the Compendium. */
export const readable = (chat: Chat, loaded: LoadedTurn) => (loaded.lore?.books ?? []).filter((b) => canRead(accessOf(chat.compendium, b.id)));

/** A book's version for the cache: the library's own revision when the body came from it, else a hash of its entries. */
const revisionOf = (b: LoreBookInput): string => getStoredLoreRevision(b) ?? sha256Hex(JSON.stringify(b.body.entries));

/** Where the live window starts, so what the narrator just read is not offered again (core/compendium/recall-index.ts). */
function liveWindow(all: readonly HistoryMessage[], shown: readonly HistoryMessage[]) {
  const users = (list: readonly HistoryMessage[]) => list.filter((m) => m.role === "user").length;
  return { firstMessage: all.length - shown.length, firstUserTurn: Math.max(1, users(all) - users(shown) + 1) };
}

/**
 * Runs recall for this turn, or answers null when the Compendium or its recall is off (nothing then happens at all). `scene` is the
 * scene's own resolved connection; the Compendium's model, when chosen, is connected through `connect`.
 */
export async function runRecall(
  deps: { connect(connection: ChatConnection, signal?: AbortSignal): Promise<Connected | null>; state: Pick<StateStore, "read"> },
  chat: Chat,
  loaded: LoadedTurn,
  scene: { connected: Connected; model: string },
  signal: AbortSignal,
  onStart?: () => void,
  timeoutMs = RECALL_TIMEOUT_MS,
): Promise<RecallRun | null> {
  const c = resolveCompendium(chat.compendium);
  if (!c.on || !c.recall.on) return null;
  const open = readable(chat, loaded);
  if (open.length === 0) return blank("skipped", "no book is open for the Compendium to read");
  if (loaded.current.content === "") return blank("skipped", "an opening has no message to recall for");
  const r = c.recall;
  const all = [...loaded.history, loaded.current];
  const shown = all.slice(-r.contextMessages);
  const index = buildRecallIndex(open.map((b) => ({ id: b.id, name: b.name, entries: b.body.entries, categories: b.body.categories ?? [] })), {
    detail: r.detail, depth: r.depth, bookDisplay: r.bookDisplay, tokenBudget: RECALL_INDEX_TOKENS, live: liveWindow(all, shown),
  });
  if (index.candidates.size === 0) return blank("skipped", "the open books have nothing to recall", { omitted: index.omitted });
  const guideText = r.guide ? (await selectedGuides(deps.state, [r.guide]))[0]?.content : undefined;
  const key = sha256Hex(JSON.stringify([chat.id, shown.map((m) => [m.id, m.content]), open.map((b) => [b.id, revisionOf(b)]), r, c.model ?? null, guideText ?? ""]));
  const hit = cache.get(key);
  if (hit) return { ...hit, calls: 0, cached: true };

  const target = c.model ? await deps.connect(c.model, signal) : scene.connected;
  if (!target) return blank("skipped", "the Compendium's model is not available in Kit");
  const model = c.model?.model ?? scene.model;
  onStart?.();
  const asked = recallMessages({ index: index.text, conversation: shown, minEntries: r.minEntries, maxEntries: r.maxEntries, ...(guideText ? { guideText } : {}), ...(r.guidance ? { guidance: r.guidance } : {}) });
  const turn = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  let calls = 0;
  const ask = async (messages: { role: "system" | "user" | "assistant"; content: string }[]): Promise<string> => {
    calls++;
    // The selector's native reasoning is never read; only the answer text, with any thinking tags cut off (04b F11).
    const done = await target.provider.send({ model, messages, options: { temperature: 0.3, max_tokens: MAX_OUTPUT_TOKENS, reasoning_effort: "none" } }, { signal: turn });
    return splitReasoning(done.content).reply;
  };
  try {
    let answer = await ask(asked);
    let parsed: RecallParse = parseRecall(answer, index.candidates, r.maxEntries);
    if (!parsed.ok) {
      answer = await ask([...asked, { role: "assistant", content: answer }, { role: "user", content: REPAIR_NUDGE }]);
      parsed = parseRecall(answer, index.candidates, r.maxEntries);
    } else if (parsed.picks.length < r.minEntries && calls < 2) {
      const more = await ask([...asked, { role: "assistant", content: answer }, { role: "user", content: moreNudge(parsed.picks.length, r.minEntries) }]);
      const again = parseRecall(more, index.candidates, r.maxEntries);
      if (again.ok && again.picks.length > parsed.picks.length) parsed = again;
    }
    if (!parsed.ok) return blank("failed", `the selector did not return the JSON answer (${parsed.detail})`, { model, calls, omitted: index.omitted });
    const run: RecallRun = {
      status: parsed.picks.length > 0 ? "recalled" : "empty", model, calls,
      selected: parsed.picks.map((p) => ({ entryKey: p.candidate.key, title: p.candidate.name, reason: p.reason })),
      entries: parsed.picks.map((p) => ({ entryKey: p.candidate.key, title: p.candidate.name, content: p.candidate.content })),
      unknown: parsed.unknown.length, repeated: parsed.repeated, trimmed: parsed.trimmed, omitted: index.omitted,
    };
    if (run.status === "recalled") {
      if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
      cache.set(key, run);
    }
    return run;
  } catch (error) {
    if (signal.aborted) return blank("failed", "stopped", { model, calls });
    return blank("failed", turn.aborted ? "the selector took too long" : toErrorMessage(error, "the selector call failed"), { model, calls, omitted: index.omitted });
  }
}

/** The turn's `recall` trace section: what was picked and why, what the lore share cut, no entry or prompt text. */
export function recallSection(run: RecallRun, placed?: { injected: RecallHit[]; cut: RecallHit[]; repeated: string[] }): JsonObject {
  return JSON.parse(JSON.stringify({
    status: run.status, reason: run.reason, model: run.model, calls: run.calls, cached: run.cached,
    selected: run.selected, unknown: run.unknown, repeated: run.repeated, trimmed: run.trimmed, omitted: run.omitted,
    injected: placed?.injected ?? [], cut: placed?.cut ?? [], alreadyPlaced: placed?.repeated ?? [],
  })) as JsonObject;
}

/** Test seam: forgets every cached pick. */
export const clearRecallCache = (): void => cache.clear();
