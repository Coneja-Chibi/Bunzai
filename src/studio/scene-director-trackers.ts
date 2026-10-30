/**
 * The Story Director keeps the trackers up to date (plan 16; RoleCall `runDM.ts` phase 3b, moved to after the reply because RoleCall's runs before it and so tracks the PREVIOUS reply's prose,
 * map 13 #15). Once a reply has committed, in the background (the reply never waits for it and never fails over it), one request per batch of the trackers that are on and due reads the exchange
 * that just happened and each tracker as it is, and answers an UPDATE. Each module's part is merged by core/director/tracker-round.ts (never removing by omission), cut into scene-state deltas
 * of the module's slot (`tracker.<module>`), and written for THE REPLY'S VERSION with `ChatStore.recordDeltas`: the write is tied to that version in this take, so it shows while that version is
 * shown, a swipe or a regenerate leaves it behind, a cut takes it, and a fork inherits it with the reply. Nothing here undoes anything: there is no tracker-side record to keep in step.
 *
 * The write names what it was planned against (`expect`, the values the round read): a change made since, by the person or another writer, drops that module's update, it never overwrites it.
 * A field or row the person edited on this same reply is theirs: the update leaves it as it is and the activity feed says so (the person wins), and an update left with nothing to write is not made.
 * Calls per reply counts every call this round makes, a repair of an unreadable answer included; planning's own retries stay outside it. A failure of any kind writes nothing for that module and says why
 * in the activity feed (RoleCall's "Tracker" entries). Not on Continue, Stop, or a reply that did not commit.
 */
import { describeDiff, batchesOf, changes, dueTrackers, mergeUpdate, readRound, roundMessages, type RoundModule } from "../core/director/tracker-round";
import { directorOn, resolveDirector } from "../core/director/settings";
import { heldAs } from "../core/scene-state/fold";
import { parseTrackerData, refreshSpecOf, trackerDeltas, trackerOverlay } from "../core/trackers";
import { REFRESH_TEMPERATURE } from "../core/trackers/refresh";
import { repairItem, type Read } from "../core/trackers/generate";
import { isRecord } from "../core/guards";
import { attemptError } from "../core/director/attempt-error";
import { toErrorMessage } from "../error-message";
import { slotOf } from "../generated/slots";
import { DIRECTOR_ACTIVITY_MAX, type DirectorActivity, type DirectorState } from "../stage/contracts/director-types";
import type { ChatConnection, ChatStore } from "../stage/contracts/chat-store";
import type { TrackerModule } from "../stage/contracts/chat-tracker-types";
import { isStudioConflictError } from "./errors";
import { askText, type Ask, type Messages } from "./compendium-ask";
import { tierRefusal, type DirectorTiers } from "./scene-director-tier";
import type { TurnRuntime } from "./scene-turn-runtime";
import { type TrackerOutcome, type TrackerOutcomes } from "./scene-events";
import { keepUnedited } from "./tracker-state";
import type { Connected } from "./scene-turn";

/** One request's time budget, so a hung provider cannot hold the next turn (which waits for this round to end). */
export const TRACKER_ROUND_TIMEOUT_MS = 120_000;
/** How many times the activity lines are written again after a conflict with an edit made at the same moment. */
const RECORD_ATTEMPTS = 3;

export type RoundChats = Pick<ChatStore, "getChat" | "sceneState" | "sceneDeltas" | "recordDeltas" | "getDirector" | "putDirector">;
export type Line = Omit<DirectorActivity, "id">;

export interface TrackerRoundDeps {
  chats: RoundChats;
  connect(connection: ChatConnection, signal?: AbortSignal): Promise<Connected | null>;
  now(): number;
  tiers?: DirectorTiers;
  /** The per-request budget; absent: TRACKER_ROUND_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface TrackerRoundInput {
  chatId: string;
  /** The take the reply was committed on: the round reads and writes there whichever take is shown by the time it finishes. */
  branchId: string;
  /** The reply that just committed and the version of it that was shown: the update belongs to that version and no other. */
  messageId: string;
  swipeId: string;
  /** The Director's turn counter for this reply. */
  turn: number;
  characterName: string;
  personaName: string;
  userMessage: string;
  reply: string;
  /** What the Director planned for this turn, in a few lines; absent when it gave no directive. */
  directive?: string;
}

/** Adds activity lines to a state, ids from its own counter. */
export function withLines(state: DirectorState, lines: readonly Line[]): DirectorState {
  const s = structuredClone(state);
  s.activity = [...s.activity, ...lines.map((l) => ({ ...l, id: `act-${s.nextId++}` }))].slice(-DIRECTOR_ACTIVITY_MAX);
  return s;
}

/** The round's calls left: every request counts, the repair of an unreadable answer too. */
interface Budget { left: number }

/** One request, and when its answer cannot be read one repair request if the round has a call left; the reason when it stays unreadable. */
async function askRound(connected: Connected, request: Ask, first: Messages, budget: Budget): Promise<Read<Record<string, unknown>>> {
  budget.left--;
  const text = await askText(connected, request, first);
  const parsed = readRound(text);
  if (parsed.ok) return parsed;
  if (budget.left <= 0) return { ok: false, error: `${parsed.error} (Calls per reply left no call to ask again)` };
  budget.left--;
  const again = readRound(await askText(connected, request, repairItem(first, text, parsed.error)));
  return again.ok ? again : { ok: false, error: `the model's answer could not be read: ${again.error}` };
}

/** What one batch did: what it has to say, how each tracker fared, and whether the reply is gone from the take (the round then ends). */
interface Batch { lines: Line[]; outcomes: TrackerOutcomes[]; abandon: boolean }

async function runBatch(deps: TrackerRoundDeps, input: TrackerRoundInput, connected: Connected, model: string, modules: readonly TrackerModule[], signal: AbortSignal, budget: Budget): Promise<Batch> {
  const out: Batch = { lines: [], outcomes: [], abandon: false };
  const outcome = (module: TrackerModule, o: TrackerOutcome): void => void out.outcomes.push({ module, outcome: o });
  const say = (result: Line["result"], description: string, details?: string): void => void out.lines.push({ at: deps.now(), turn: input.turn, type: "tracker", result, description, ...(details ? { details: details.slice(0, 600) } : {}), model });
  const chat = await deps.chats.getChat(input.chatId);
  const state = chat ? await deps.chats.sceneState(input.branchId) : null;
  if (!chat || !state) return out;
  // What the request is built from, and what a write is judged against.
  const entries = trackerOverlay(chat.trackers, state);
  const ask: RoundModule[] = modules.map((module) => ({ module, data: entries[module]?.data, subs: entries[module]?.subs ?? {} }));
  const maxTokens = Math.min(8000, modules.reduce((n, m) => n + refreshSpecOf(m)!.maxTokens, 0));
  let answer: Record<string, unknown>;
  try {
    const read = await askRound(connected, { model, options: { temperature: REFRESH_TEMPERATURE, max_tokens: maxTokens }, signal: AbortSignal.any([signal, AbortSignal.timeout(deps.timeoutMs ?? TRACKER_ROUND_TIMEOUT_MS)]) },
      roundMessages({ characterName: input.characterName, personaName: input.personaName, userMessage: input.userMessage, reply: input.reply, ...(input.directive ? { directive: input.directive } : {}), modules: ask }), budget);
    if (!read.ok) { say("error", `Tracker update failed (${modules.join(", ")}): ${read.error}`); modules.forEach((m) => outcome(m, "failed")); return out; }
    answer = read.value;
  } catch (error) {
    if (signal.aborted) throw error;
    // A provider's own text is untrusted (it can echo the request): the story keeps only its kind, as the planner's log does.
    say("error", `Tracker update failed (${modules.join(", ")}): ${attemptError(error)}`);
    modules.forEach((m) => outcome(m, "failed"));
    return out;
  }
  for (const module of modules) {
    const part = answer[module];
    if (part === undefined) continue;
    if (!isRecord(part)) { say("error", `Tracker update for ${module} skipped: its part of the answer is not an object`); outcome(module, "failed"); continue; }
    const was = entries[module]?.data;
    const merged = mergeUpdate(refreshSpecOf(module)!, was, part, { id: () => crypto.randomUUID(), now: deps.now() }, (s) => parseTrackerData(module, s));
    if (!merged.ok) { say("error", `Tracker update for ${module} skipped: ${merged.error}`); outcome(module, "failed"); continue; }
    if (!changes(merged.diff)) continue;
    const planned = trackerDeltas(module, was, merged.state, deps.now());
    // The person wins on their own reply: what they edited there is left as it is, and said so.
    const mine = await keepUnedited(deps.chats, input.branchId, input.messageId, module, planned, state, entries[module]?.subs);
    if (!mine) { out.abandon = true; return out; }
    const { kept, left, blocked } = mine;
    if (blocked.length > 0) say("info", `Tracker update for ${module} was not made: ${blocked.join("; ")}`);
    else if (left.length > 0) say("info", `Tracker update for ${module} left your edit of ${left.join(", ")} as it is`);
    if (kept.length === 0) { outcome(module, "skipped"); continue; }
    try {
      // The write names the state this was planned against: a change made since is never overwritten.
      if (!(await deps.chats.recordDeltas(input.branchId, input.swipeId, kept, { expect: heldAs(state, kept, slotOf) }))) { out.abandon = true; return out; }
    } catch (error) {
      outcome(module, isStudioConflictError(error) ? "dropped" : "failed");
      say("error", isStudioConflictError(error) ? `Tracker update for ${module} dropped: it changed while the update was being planned` : `Tracker update for ${module} could not be saved: ${toErrorMessage(error, "the write failed")}`);
      continue;
    }
    outcome(module, "applied");
    say("success", describeDiff(module, merged.diff), merged.skipped.length > 0 ? `Left out of the answer: ${merged.skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}` : undefined);
  }
  return out;
}

/** Writes the activity lines into the reply's own snapshot; false when the snapshot is no longer this turn's or could not be written. */
async function record(deps: TrackerRoundDeps, input: TrackerRoundInput, lines: readonly Line[]): Promise<boolean> {
  for (let attempt = 0; attempt < RECORD_ATTEMPTS; attempt++) {
    const snap = await deps.chats.getDirector(input.chatId, input.messageId);
    if (!snap || snap.messageId !== input.messageId || snap.state.turn !== input.turn) return false;
    try {
      return (await deps.chats.putDirector(input.chatId, input.messageId, withLines(snap.state, lines), { expectedVersion: snap.version })) !== null;
    } catch (error) {
      // Another version selected meanwhile has a different stamp, so the guard refuses and the snapshot is looked at again; anything else is final.
      if (!isStudioConflictError(error)) return false;
    }
  }
  return false;
}

/** The round for one committed reply; resolves when everything it did is written. Throws only the abort. */
export async function runTrackerRound(deps: TrackerRoundDeps, input: TrackerRoundInput, signal: AbortSignal): Promise<TrackerOutcomes[]> {
  const chat = await deps.chats.getChat(input.chatId);
  if (!chat || !directorOn(chat) || !chat.props) return [];
  const settings = resolveDirector(chat);
  const due = dueTrackers({ entries: chat.trackers ?? {}, on: chat.props.on, autoUpdate: settings.autoUpdate, every: settings.every, turn: input.turn });
  const batches = batchesOf(due, settings.callsPerReply);
  if (batches.length === 0) return [];
  const lines: Line[] = [];
  const stop = async (description: string): Promise<TrackerOutcomes[]> => {
    lines.push({ at: deps.now(), turn: input.turn, type: "tracker", result: "error", description });
    await record(deps, input, lines);
    return batches.flat().map((module) => ({ module, outcome: "skipped" as const }));
  };
  const denied = tierRefusal("director.trackers", deps.tiers);
  if (denied) return stop(`Tracker update skipped: ${denied}`);
  const target = settings.model ?? chat.connection;
  const connected = target ? await deps.connect(target, signal) : null;
  if (!target || !connected) return stop("Tracker update skipped: the Story Director has no connection to ask");
  const budget: Budget = { left: settings.callsPerReply };
  const outcomes: TrackerOutcomes[] = [];
  try {
    for (const modules of batches) {
      if (signal.aborted) break;
      if (budget.left <= 0) { lines.push({ at: deps.now(), turn: input.turn, type: "tracker", result: "error", description: `Tracker update skipped (${modules.join(", ")}): Calls per reply was used up` }); modules.forEach((module) => outcomes.push({ module, outcome: "skipped" })); continue; }
      const batch = await runBatch(deps, input, connected, target.model, modules, signal, budget);
      lines.push(...batch.lines);
      outcomes.push(...batch.outcomes);
      if (batch.abandon) {
        for (const module of modules) if (!batch.outcomes.some((o) => o.module === module)) outcomes.push({ module, outcome: "skipped" });
        break;
      }
    }
  } catch (error) {
    // Stopped mid-round: whatever was written is tied to the reply's version and stays with it.
    if (!signal.aborted) throw error;
  }
  if (lines.length > 0) await record(deps, input, lines);
  return outcomes;
}

/** The last word on each tracker, in the order they first appear. */
function settled(list: readonly TrackerOutcomes[]): TrackerOutcomes[] {
  const last = new Map<TrackerModule, TrackerOutcome>();
  for (const o of list) last.set(o.module, o.outcome);
  return [...last].map(([module, outcome]) => ({ module, outcome }));
}

// ---- the round in the background ---------------------------------------------------------------------------------------------------------------------------------------------

/** Starts the round for a committed reply and returns at once. */
export function startTrackerRound(runtime: TurnRuntime, deps: TrackerRoundDeps, input: TrackerRoundInput): void {
  if (runtime.closed) return;
  const running = runtime.trackerRounds;
  const controller = new AbortController();
  const done = runTrackerRound(deps, input, controller.signal).then((list) => { if (list.length > 0) runtime.onTrackers({ chatId: input.chatId, modules: settled(list) }); }).catch(() => undefined).finally(() => { if (running.get(input.chatId)?.controller === controller) running.delete(input.chatId); });
  running.set(input.chatId, { controller, done });
}

/** Stops the scene's round, if one is running, and waits for it to have written everything it wrote: a new turn reads the trackers only after this. */
export async function cancelTrackerRound(runtime: TurnRuntime, chatId: string): Promise<void> {
  const round = runtime.trackerRounds.get(chatId);
  if (!round) return;
  round.controller.abort();
  await round.done;
}

/** Waits for every round that is running; for tests and a clean shutdown. */
export async function settleTrackerRounds(runtime: TurnRuntime): Promise<void> {
  await Promise.all([...runtime.trackerRounds.values()].map((r) => r.done));
}
