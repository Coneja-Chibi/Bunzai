/**
 * The Story Director's turn (RoleCall `DMStreamService.processTurn` and `worker.ts:3812-4165`, trimmed to the live path; plan 15): before a reply, one blocking planning call reads the
 * story state in effect at the message being answered, and gives back a directive for the narrator and the story state that reply will be written from. Runs beside the Compendium's
 * recall (scene-turn.ts), on send, regenerate, swipe and guided re-roll, never on Continue (RoleCall re-plans on continue and mutates the story for text with no new move).
 *
 * It is honest about failure (map 13 #10): a planning call that fails gives NO directive this turn, never last turn's as binding, and the story fields stay as they were; the reason is one
 * activity line. It writes nothing itself: `produce` is a pure function from the story state in effect at commit to the state to store, and a reply that never commits leaves no snapshot.
 *
 * The person's panel edits are made on the version of a reply that is showing, and a new version of that reply starts from the state before it. So each edit is remembered in the state
 * (core/director/edits.ts) and carried: the planner is shown the state with the edits of the version being replaced already applied, and at commit every edit the replaced version holds, or that
 * was made while the call was out, is applied again to the state the new version is built on. Edits made to an item that only the replaced round made, and the new round did not make again,
 * have nothing to apply to and are dropped (behavior 11).
 */
import { resolveCompendium } from "../core/compendium/defaults";
import { fitState } from "../core/director/bounds";
import { buildCompendiumContext } from "../core/director/compendium-snapshot";
import { applyRound } from "../core/director/apply";
import { enrichFromMomentum, sanitizeForPlayerCharacter } from "../core/director/directive";
import { TOO_LARGE, replay, retry } from "../core/director/edits";
import { computeMomentum, formatMomentumReport, planningPressures } from "../core/director/momentum";
import { systemPrompt } from "../core/director/prompts";
import { directorOn, resolveDirector } from "../core/director/settings";
import { emptyDirectorState } from "../core/director/state";
import { userPrompt } from "../core/director/user-prompt";
import { stripReasoningTags, type ReasoningFormat } from "../core/reasoning-tags";
import { DIRECTOR_ACTIVITY_MAX, DIRECTOR_DETAILS_MAX, type DirectorActivity, type DirectorActivityType, type DirectorEditRecord, type DirectorSnapshot, type DirectorState, type NarratorDirective } from "../stage/contracts/director-types";
import type { Chat, ChatStore, Message } from "../stage/contracts/chat-store";
import { StudioValidationError } from "./errors";
import { readable } from "./compendium-recall";
import { FAILURE_COPY, PLANNER_TIMEOUT_MS, planTurn, type PlannerClock, type PlannerFailure, type PlannerResult } from "./scene-director-call";
import { tierRefusal, type DirectorTiers } from "./scene-director-tier";
import type { Connected, TurnDeps } from "./scene-turn";
import type { LoadedTurn, TurnKind } from "./scene-turn-load";

const NOT_SAVED = "The Director's state for this reply could not be saved.";

export type DirectorDeps = Pick<TurnDeps, "connect" | "now"> & { chats: Pick<ChatStore, "getDirector" | "putDirector">; director?: Partial<PlannerClock>; tiers?: DirectorTiers };

export interface DirectorRun {
  /** The Director's turn counter for this reply. */
  turn: number;
  /** Planned for this turn and read, enriched and cleaned: the narrator's directive. Absent whenever planning failed. */
  directive?: NarratorDirective;
  status: "planned" | "failed";
  /** Why, in words for the person, when planning failed. */
  reason?: string;
  /** The snapshot the call read; null for a story that has none yet. */
  base: DirectorSnapshot | null;
  /** The activity lines of this turn, for the page to show at once; they are also in the snapshot `produce` makes. */
  entries: DirectorActivity[];
  /**
   * The state to store for the reply: the story state in effect at commit (`base`), the edits of the version being replaced and of the one read at commit (`replaced`) applied to it, then
   * this turn's round (or, after a failure, nothing but the turn counted) and its activity lines.
   */
  produce(base: DirectorState | null, replaced?: DirectorState | null): DirectorState;
}

const dots = (s: string): string => s.replace(/\s+/g, " ").trim();

function clockOf(deps: DirectorDeps): PlannerClock {
  return {
    sleep: deps.director?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    jitter: deps.director?.jitter ?? Math.random, timeoutMs: deps.director?.timeoutMs ?? PLANNER_TIMEOUT_MS, now: deps.director?.now ?? deps.now, mono: deps.director?.mono ?? (() => performance.now()),
  };
}

/** The activity lines `after` has that `before` did not. */
const added = (before: DirectorState, after: DirectorState): DirectorActivity[] => {
  const had = new Set(before.activity.map((a) => a.id));
  return after.activity.filter((a) => !had.has(a.id));
};

/** Adds activity lines to a state, ids from its own counter, the most recent DIRECTOR_ACTIVITY_MAX kept. */
function logged(state: DirectorState, lines: Omit<DirectorActivity, "id">[]): DirectorState {
  const s = structuredClone(state);
  s.activity = [...s.activity, ...lines.map((l) => ({ ...l, id: `act-${s.nextId++}` }))].slice(-DIRECTOR_ACTIVITY_MAX);
  return s;
}

/** The Compendium's typed entries, from the books it may read (never one set to off or write only), as the planner's context; nothing while the Compendium is off. */
function compendiumOf(chat: Chat, loaded: LoadedTurn): string {
  if (!resolveCompendium(chat.compendium).on) return "";
  const books = readable(chat, loaded).map((b) => ({ entries: b.body.entries }));
  const recent = [...loaded.history, loaded.current].slice(-6).map((m) => m.content);
  return books.length === 0 ? "" : buildCompendiumContext(books, { recent, names: [loaded.character.identity.name, loaded.persona?.name ?? ""] });
}

export async function runDirector(
  deps: DirectorDeps,
  chat: Chat,
  loaded: LoadedTurn,
  scene: { connected: Connected; model: string },
  signal: AbortSignal,
  how: { kind: TurnKind; format: ReasoningFormat | undefined },
): Promise<DirectorRun | null> {
  if (!directorOn(chat) || how.kind === "continue") return null;
  const settings = resolveDirector(chat);
  // The answered message is the one before the target of a swipe too, so a regenerate plans again from the state its first answer started from.
  const base = await deps.chats.getDirector(chat.id, loaded.current.id);
  // The version being replaced holds the person's edits since: the planner is shown the story with them.
  const replaced0 = loaded.target ? await deps.chats.getDirector(chat.id, loaded.target.id) : null;
  const state = replay(base?.state ?? emptyDirectorState(), replaced0?.state);
  // The turn is counted in the state, not read off the window of messages, which hiding and Max Messages shorten.
  const turn = (base?.state.turn ?? 0) + 1;
  const at = deps.now();
  const entry = (type: DirectorActivityType, result: DirectorActivity["result"], description: string, details?: string, model?: string): Omit<DirectorActivity, "id"> =>
    ({ at, turn, type, result, description, ...(details ? { details: details.slice(0, DIRECTOR_DETAILS_MAX) } : {}), ...(model ? { model } : {}) });
  // Tracker receipts belong to the reply that made them: the state this one is built on may be the last reply's, whose receipts are not carried.
  const carry = (b: DirectorState | null, replaced: DirectorState | null | undefined, missed: DirectorEditRecord[]): DirectorState => {
    const { trackerUpdates: _last, ...kept } = replay(replay(b ?? emptyDirectorState(), replaced0?.state, missed), replaced, missed);
    return kept;
  };

  const denied = tierRefusal("director.plan", deps.tiers);
  const target: Connected | null = denied ? null : settings.model ? await deps.connect(settings.model) : scene.connected;
  const model = settings.model?.model ?? scene.model;
  const report = computeMomentum(state, turn);
  const lines: Omit<DirectorActivity, "id">[] = [entry("turn_start", "info", `Turn ${turn} - Director planning`, `Command mode: ${settings.commandMode === "tagged" ? "Tagged" : "Tool call"}. Model native-tool capability: ${target?.tools === true ? "native tools available" : "tool support unknown"}.`, model)];
  if (report.forcedActions.length + report.staleArcs.length + report.ripeSeeds.length + report.tensionPeaks.length > 0) lines.push(entry("momentum", "info", report.summary || "Momentum: nothing urgent", formatMomentumReport(report), model));

  const fail = (copy: string, attempts: PlannerResult["attempts"], noCalls: boolean): DirectorRun => {
    const failure: Omit<DirectorActivity, "id">[] = [entry("turn_error", "error", copy, attempts.map((a, i) => dots(`Attempt ${i + 1} | transport=${a.transport} | outcome=${a.outcome} | duration=${a.ms}ms${a.finish ? ` | finish=${a.finish}` : ""}${a.tokens ? ` | tokens=${a.tokens}` : ""}${a.error ? ` | error=${a.error}` : ""}`)).join("\n") || undefined, model)];
    // The honest "no calls" line only when the model really made none.
    if (noCalls) failure.push(entry("turn_finish", "error", `Turn ${turn} - DM made 0 tool calls; story state was NOT updated`, `${model} never called any Story Director tools despite tool calling being required. This usually means the model or its provider doesn't support tool calling reliably - pick a different DM model in the Story Director settings. No directive was sent this turn; arcs and seeds were not touched.`, model));
    const all = [...lines, ...failure];
    // Nothing of the story changes, but the turn is counted and the person's edits are carried.
    const produce = (b: DirectorState | null, replaced?: DirectorState | null): DirectorState => fitState({ ...logged(carry(b, replaced, []), all), turn });
    return { status: "failed", turn, reason: copy, base, entries: added(state, produce(base?.state ?? null)), produce };
  };
  const failed = (reason: PlannerFailure, attempts: PlannerResult["attempts"], calls: number): DirectorRun => fail(FAILURE_COPY[reason], attempts, reason === "no_tool_calls" && calls > 0);
  if (denied) return fail(denied, [], false);
  if (!target) return failed("no_connection", [], 0);

  const history = loaded.history.map((m) => ({ role: m.role, content: m.role === "assistant" && !chat.prompting?.keepThinking ? stripReasoningTags(m.content, how.format) : m.content }));
  const result = await planTurn({
    connected: target, model, mode: settings.commandMode, temperature: settings.temperature, autoRetry: settings.autoRetry, reasoning: settings.reasoning, signal,
    system: systemPrompt({ personaName: loaded.persona?.name, personaDescription: loaded.persona?.content, creativity: settings.creativity, personality: settings.personality }),
    user: userPrompt({ state, report, turn, userMessage: loaded.current.content, history, instructions: settings.instructions, compendium: compendiumOf(chat, loaded) }),
    pressures: planningPressures(state, report),
  }, clockOf(deps));
  if (!result.ok) return failed(result.reason, result.attempts, result.calls);

  const { round } = result;
  const directive = sanitizeForPlayerCharacter(enrichFromMomentum(round.directive, report), loaded.persona?.name);
  const ctx = { turn, userAction: loaded.current.content, now: at, model };
  const finish = entry("turn_finish", "success", `Turn ${turn} - planned, directive built`, undefined, model);
  if (result.extra > 0) lines.push(entry("turn_finish", "info", "extra planning call ignored", `${result.extra} more commit_planning_round call${result.extra === 1 ? "" : "s"} in the same reply; the first was used.`, model));
  const produce = (b: DirectorState | null, replaced?: DirectorState | null): DirectorState => {
    const missed: DirectorEditRecord[] = [];
    const carried = carry(b, replaced, missed);
    return fitState(logged(retry(applyRound(logged(carried, lines), round, ctx).state, missed), [finish]));
  };
  return { status: "planned", turn, directive, base, entries: added(state, produce(base?.state ?? null)), produce };
}

/**
 * Stores the reply's snapshot once the reply has committed (never before: a reply that fails or is dropped leaves nothing). `replaced` is the snapshot of the version this one replaces, read
 * just before the commit, so an edit made to it while the call was out is carried. The story state in effect at the reply is read again here. A snapshot that cannot be written (the scene moved
 * on, or the state is too large even after giving up what can go) is lost for this turn only and reported; the next turn plans from the last state that was stored, which is whole. The guard
 * is the version read an instant before the write, so it protects a moment, not the whole call: the edits that came in during the call are carried by `produce`, not by the guard. The one
 * window left is an edit made after the commit and before this read: it lands on the new version first, and the replaced version's older edits are then replayed after it, so an order-sensitive
 * pair (an add and a Reset) can swap. Closing it needs the replay inside the store's own write, which the store contract does not offer; the window is a few milliseconds.
 * Returns true, or the sentence for the page.
 */
export async function commitDirector(deps: DirectorDeps, chatId: string, run: DirectorRun, message: Pick<Message, "id">, replaced?: DirectorSnapshot | null): Promise<true | string> {
  try {
    const now = await deps.chats.getDirector(chatId, message.id);
    const saved = await deps.chats.putDirector(chatId, message.id, run.produce(now?.state ?? null, replaced?.state), { expectedVersion: now?.version ?? null });
    return saved !== null ? true : NOT_SAVED;
  } catch (error) {
    // Too large with only a person's own content left to give up (bounds.ts) is the one failure the person can fix, and they are told how.
    return error instanceof StudioValidationError && error.message.includes("too large") ? TOO_LARGE : NOT_SAVED;
  }
}
