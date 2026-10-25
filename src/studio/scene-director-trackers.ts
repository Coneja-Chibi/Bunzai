/**
 * The Story Director keeps the trackers up to date (plan 16; RoleCall `runDM.ts` phase 3b, moved to after the reply because RoleCall's runs before it and so tracks the PREVIOUS reply's prose,
 * map 13 #15). Once a reply has committed, in the background (the reply never waits for it and never fails over it), one request per batch of the trackers that are on and due reads the exchange
 * that just happened and each tracker as it is, and answers an UPDATE. Each module's part is merged by core/director/tracker-round.ts (never removing by omission) and written straight away
 * through the store's tracker write, guarded by the state it was planned against: a change the person made in the meantime drops that module's update, it never overwrites it.
 *
 * Every applied update is recorded on the tracker itself (`update`: which version of which reply, before and after) and as a receipt in THAT version's Director snapshot, never another's. An update
 * without a receipt never stays: if the version is no longer the shown one, or the receipts would not fit or cannot be saved, the updates are undone (scene-tracker-undo.ts). Calls per reply
 * counts every call this round makes, a repair of an unreadable answer included; planning's own retries stay outside it. A failure of any kind writes nothing for that module and says why in the
 * activity feed (RoleCall's "Tracker" entries). Not on Continue, Stop, or a reply that did not commit.
 */
import { describeDiff, batchesOf, changes, dueTrackers, mergeUpdate, readRound, receiptOf, roundMessages, type RoundModule } from "../core/director/tracker-round";
import { directorOn, resolveDirector } from "../core/director/settings";
import { parseTrackerData, refreshSpecOf, subsOf } from "../core/trackers";
import { REFRESH_TEMPERATURE } from "../core/trackers/refresh";
import { repairItem, type Read } from "../core/trackers/generate";
import { isRecord } from "../core/guards";
import { attemptError } from "../core/director/attempt-error";
import { toErrorMessage } from "../error-message";
import { DIRECTOR_RECEIPT_SIDE_MAX, DIRECTOR_STATE_BYTES_MAX, type TrackerReceipt } from "../stage/contracts/director-types";
import type { ChatConnection, JsonValue } from "../stage/contracts/chat-store";
import type { TrackerModule, TrackerUpdate } from "../stage/contracts/chat-tracker-types";
import { StudioConflictError } from "./atomic-file";
import { askText, type Ask, type Messages } from "./compendium-ask";
import { tierRefusal, type DirectorTiers } from "./scene-director-tier";
import { publishSceneTrackers, type TrackerOutcome, type TrackerOutcomes } from "./scene-events";
import { dataOf, shownIn, syncTrackersToShown, undoUpdate, withLines, type Line, type UndoChats } from "./scene-tracker-undo";
import type { Connected } from "./scene-turn";

/** One request's time budget, so a hung provider cannot hold the next turn (which waits for this round to end). */
export const TRACKER_ROUND_TIMEOUT_MS = 120_000;
/** How many times the receipts are written again after a conflict with an edit made at the same moment. */
const RECORD_ATTEMPTS = 3;
/** Room kept for the activity lines a batch adds when its receipts are checked against the snapshot's size limit. */
const LINES_ROOM = 800;

export interface TrackerRoundDeps {
  chats: UndoChats;
  connect(connection: ChatConnection): Promise<Connected | null>;
  now(): number;
  tiers?: DirectorTiers;
  /** The per-request budget; absent: TRACKER_ROUND_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface TrackerRoundInput {
  chatId: string;
  /** The reply that just committed and the version of it that was shown: the update and its receipts belong to that version and no other. */
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

/** The trackers already reported as too large to update, by their size, so a tracker that stays too large is said once (until its size changes). */
const tooLarge = new Map<string, number>();

interface Applied { module: TrackerModule; update: TrackerUpdate; receipt: TrackerReceipt }

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

/** What one batch did: what it wrote, what it has to say, and whether the reply stopped being the one shown (the round then ends and undoes its writes). */
interface Batch { applied: Applied[]; lines: Line[]; outcomes: TrackerOutcomes[]; abandon: boolean }

async function runBatch(deps: TrackerRoundDeps, input: TrackerRoundInput, connected: Connected, model: string, modules: readonly TrackerModule[], signal: AbortSignal, budget: Budget, before: readonly Applied[], earlier: readonly Line[]): Promise<Batch> {
  const out: Batch = { applied: [], lines: [], outcomes: [], abandon: false };
  const outcome = (module: TrackerModule, o: TrackerOutcome): void => void out.outcomes.push({ module, outcome: o });
  const say = (result: Line["result"], description: string, details?: string): void => void out.lines.push({ at: deps.now(), turn: input.turn, type: "tracker", result, description, ...(details ? { details: details.slice(0, 600) } : {}), model });
  const chat = await deps.chats.getChat(input.chatId);
  if (!chat) return out;
  // A tracker whose saved state is too large to keep a way back for is never updated; that is said once, then not again until its size changes.
  const askable = modules.filter((module) => {
    const size = JSON.stringify(dataOf(chat, module)).length;
    const key = `${input.chatId}:${module}`;
    if (size <= DIRECTOR_RECEIPT_SIDE_MAX) { tooLarge.delete(key); return true; }
    if (tooLarge.get(key) !== size) { tooLarge.set(key, size); say("error", `Tracker update for ${module} skipped: the tracker is too large to keep a way back for`); }
    outcome(module, "skipped");
    return false;
  });
  if (askable.length === 0) return out;
  const ask: RoundModule[] = askable.map((module) => ({ module, data: chat.trackers?.[module]?.data, subs: subsOf(module, chat.trackers?.[module]?.data) }));
  const maxTokens = Math.min(8000, askable.reduce((n, m) => n + refreshSpecOf(m)!.maxTokens, 0));
  let answer: Record<string, unknown>;
  try {
    const read = await askRound(connected, { model, options: { temperature: REFRESH_TEMPERATURE, max_tokens: maxTokens }, signal: AbortSignal.any([signal, AbortSignal.timeout(deps.timeoutMs ?? TRACKER_ROUND_TIMEOUT_MS)]) },
      roundMessages({ characterName: input.characterName, personaName: input.personaName, userMessage: input.userMessage, reply: input.reply, ...(input.directive ? { directive: input.directive } : {}), modules: ask }), budget);
    if (!read.ok) { say("error", `Tracker update failed (${askable.join(", ")}): ${read.error}`); askable.forEach((m) => outcome(m, "failed")); return out; }
    answer = read.value;
  } catch (error) {
    if (signal.aborted) throw error;
    // A provider's own text is untrusted (it can echo the request): the story keeps only its kind, as the planner's log does.
    say("error", `Tracker update failed (${askable.join(", ")}): ${attemptError(error)}`);
    askable.forEach((m) => outcome(m, "failed"));
    return out;
  }
  for (const module of askable) {
    const part = answer[module];
    if (part === undefined) continue;
    if (!isRecord(part)) { say("error", `Tracker update for ${module} skipped: its part of the answer is not an object`); outcome(module, "failed"); continue; }
    // The reply must still be the version shown, and its snapshot still this turn's, before anything is written.
    const fresh = await deps.chats.getChat(input.chatId);
    const shown = fresh ? await shownIn(deps.chats, fresh, input.messageId) : "gone";
    const snap = await deps.chats.getDirector(input.chatId, input.messageId);
    if (typeof shown === "string" || shown.swipeId !== input.swipeId || !snap || snap.messageId !== input.messageId || snap.state.turn !== input.turn) { out.abandon = true; return out; }
    // Planned against the state the request was built from: a change made since is a conflict at the write, never planned over.
    const was = chat.trackers?.[module]?.data;
    const merged = mergeUpdate(refreshSpecOf(module)!, was, part, { id: () => crypto.randomUUID(), now: deps.now() }, (s) => parseTrackerData(module, s));
    if (!merged.ok) { say("error", `Tracker update for ${module} skipped: ${merged.error}`); outcome(module, "failed"); continue; }
    if (!changes(merged.diff)) continue;
    const receipt = receiptOf(module, was, merged.state, input.turn, deps.now());
    if (!receipt) { say("error", `Tracker update for ${module} skipped: the tracker would be too large to keep a way back for`); outcome(module, "skipped"); continue; }
    // Its way back must fit in the reply's snapshot before the tracker is touched.
    const receipts = [...before, ...out.applied].map((a) => a.receipt).concat(receipt);
    const size = JSON.stringify({ ...snap.state, trackerUpdates: receipts }).length + LINES_ROOM * (earlier.length + out.lines.length + 1);
    if (size > DIRECTOR_STATE_BYTES_MAX) { say("error", `Tracker update for ${module} skipped: its way back would not fit in the saved story`); outcome(module, "skipped"); continue; }
    const update: TrackerUpdate = { messageId: input.messageId, swipeId: input.swipeId, turn: input.turn, at: receipt.at, before: receipt.before, after: receipt.after };
    try {
      // The write names the state this was planned against: the person's change made since is never overwritten.
      await deps.chats.setTracker(input.chatId, module, { data: merged.state as JsonValue, update, expectedData: receipt.before });
    } catch (error) {
      outcome(module, error instanceof StudioConflictError ? "dropped" : "failed");
      say("error", error instanceof StudioConflictError ? `Tracker update for ${module} dropped: it changed while the update was being planned` : `Tracker update for ${module} could not be saved: ${toErrorMessage(error, "the write failed")}`);
      continue;
    }
    out.applied.push({ module, update, receipt });
    outcome(module, "applied");
    say("success", describeDiff(module, merged.diff), merged.skipped.length > 0 ? `Left out of the answer: ${merged.skipped.map((s) => `${s.name} (${s.reason})`).join("; ")}` : undefined);
  }
  return out;
}

/** Writes the receipts and activity lines into the reply's own snapshot; false when the reply is no longer the shown version or the snapshot could not be written. */
async function record(deps: TrackerRoundDeps, input: TrackerRoundInput, applied: readonly Applied[], lines: readonly Line[]): Promise<boolean> {
  for (let attempt = 0; attempt < RECORD_ATTEMPTS; attempt++) {
    const chat = await deps.chats.getChat(input.chatId);
    const shown = chat ? await shownIn(deps.chats, chat, input.messageId) : "gone";
    if (typeof shown === "string" || shown.swipeId !== input.swipeId) return false;
    const snap = await deps.chats.getDirector(input.chatId, input.messageId);
    if (!snap || snap.messageId !== input.messageId || snap.state.turn !== input.turn) return false;
    const state = withLines(snap.state, lines);
    if (applied.length > 0) state.trackerUpdates = applied.map((a) => a.receipt);
    try {
      return (await deps.chats.putDirector(input.chatId, input.messageId, state, { expectedVersion: snap.version })) !== null;
    } catch (error) {
      // Another version selected meanwhile has a different stamp, so the guard refuses and the shown version is looked at again; anything else is final.
      if (!(error instanceof StudioConflictError)) return false;
    }
  }
  return false;
}

/** The round for one committed reply; resolves when everything it did is written or undone. Throws only the abort. */
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
    await record(deps, input, [], lines);
    return batches.flat().map((module) => ({ module, outcome: "skipped" as const }));
  };
  const denied = tierRefusal("director.trackers", deps.tiers);
  if (denied) return stop(`Tracker update skipped: ${denied}`);
  const target = settings.model ?? chat.connection;
  const connected = target ? await deps.connect(target) : null;
  if (!target || !connected) return stop("Tracker update skipped: the Story Director has no connection to ask");
  const budget: Budget = { left: settings.callsPerReply };
  const applied: Applied[] = [];
  const outcomes: TrackerOutcomes[] = [];
  let abandon = false;
  try {
    for (const modules of batches) {
      if (signal.aborted) break;
      if (budget.left <= 0) { lines.push({ at: deps.now(), turn: input.turn, type: "tracker", result: "error", description: `Tracker update skipped (${modules.join(", ")}): Calls per reply was used up` }); modules.forEach((module) => outcomes.push({ module, outcome: "skipped" })); continue; }
      const batch = await runBatch(deps, input, connected, target.model, modules, signal, budget, applied, lines);
      applied.push(...batch.applied);
      lines.push(...batch.lines);
      outcomes.push(...batch.outcomes);
      if (batch.abandon) {
        abandon = true;
        for (const module of modules) if (!batch.outcomes.some((o) => o.module === module)) outcomes.push({ module, outcome: "skipped" });
        break;
      }
    }
  } catch (error) {
    // Stopped mid-round: whatever was written has its receipt or is undone, never left without one.
    if (!signal.aborted) throw error;
  }
  if (!abandon && applied.length === 0 && lines.length === 0) return outcomes;
  if (abandon || !(await record(deps, input, applied, lines))) {
    for (const a of applied) await undoUpdate(deps.chats, input.chatId, a.module, a.update);
    // The version that is shown now is the one whose trackers matter: it gets its own update back.
    await syncTrackersToShown(deps.chats, input.chatId, input.messageId, deps.now);
    for (const a of applied) outcomes.push({ module: a.module, outcome: "undone" });
  }
  return outcomes;
}

/** The last word on each tracker, in the order they first appear. */
function settled(list: readonly TrackerOutcomes[]): TrackerOutcomes[] {
  const last = new Map<TrackerModule, TrackerOutcome>();
  for (const o of list) last.set(o.module, o.outcome);
  return [...last].map(([module, outcome]) => ({ module, outcome }));
}

// ---- the round in the background ---------------------------------------------------------------------------------------------------------------------------------------------

const running = new Map<string, { controller: AbortController; done: Promise<void> }>();

/** Starts the round for a committed reply and returns at once. */
export function startTrackerRound(deps: TrackerRoundDeps, input: TrackerRoundInput): void {
  const controller = new AbortController();
  const done = runTrackerRound(deps, input, controller.signal).then((list) => { if (list.length > 0) publishSceneTrackers({ chatId: input.chatId, modules: settled(list) }); }).catch(() => undefined).finally(() => { if (running.get(input.chatId)?.controller === controller) running.delete(input.chatId); });
  running.set(input.chatId, { controller, done });
}

/** Stops the scene's round, if one is running, and waits for it to have written or undone everything: a new turn reads the trackers only after this. */
export async function cancelTrackerRound(chatId: string): Promise<void> {
  const round = running.get(chatId);
  if (!round) return;
  round.controller.abort();
  await round.done;
}

/** Waits for every round that is running; for tests and a clean shutdown. */
export async function settleTrackerRounds(): Promise<void> {
  await Promise.all([...running.values()].map((r) => r.done));
}
