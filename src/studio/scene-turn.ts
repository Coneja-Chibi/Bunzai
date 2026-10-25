/**
 * The turn loop: one reply, one new version of the last reply, or more text
 * on the end of it (Continue, rule 13), the way RoleCall does it. Checkpoint, load, assemble, write the variables, stream through the scene's
 * connection while saving the text as it arrives, commit with the trace, then teach the meter.
 * Stop keeps what arrived; a failure saves nothing and hands back the draft; a crash keeps what
 * arrived, found by resumeScene the next time the scene opens.
 *
 * Errors before the checkpoint opens (no connection, a stale take) throw, so the route answers them
 * as plain HTTP errors. From the checkpoint on, every outcome is an event.
 */
import { toErrorMessage } from "../error-message";
import { running } from "./scene-turn-running";
export { stopTurn } from "./scene-turn-running";
export { commitAnyway, discardWaiting, resumeScene } from "./scene-turn-resume";
import { rebaseDiff } from "../core/assembly/lore-effects";
import { PresetPlanError } from "../core/assembly/preset";
import { GUIDANCE_MAX } from "../core/assembly/guided-swipe";
import { continuationAddition } from "../core/assembly/continuation";
import { tagThinkingState } from "../core/reasoning-tags";
import { recoverThinkingEnd } from "./scene-turn-recover";
import { thinkingSignature } from "./scene-turn-reasoning";
import { modelTakesPrefill } from "../core/assembly/request";
import { countPrompt, estimateFor, modelKey } from "../core/tokens";
import type { ChatConnection, ChatStore, Generation, JsonObject, Message } from "../stage/contracts/chat-store";
import type { MacroVariable } from "../core/macros";
import { ProviderError, type Provider, type ProviderEvent, type ProviderRole } from "../stage/contracts/provider";
import type { StateStore } from "../stage/contracts/state-store";
import { StudioConflictError } from "./atomic-file";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { assembleRequest, openedWith, prepareRequest, shapeRequest } from "./scene-turn-build";
import { carriedBy, trackersAfterReply } from "./scene-turn-after-trackers";
import { loadTurn, writeGlobals, type ReadPreset, type TurnKind } from "./scene-turn-load";
import { isFallbackWorthy } from "./scene-turn-fallback";
import { learnReply } from "./scene-turn-meter";
import { applyEdits, awaitReview } from "./scene-turn-review";
import { promptRegex, recounted, type RegexItem } from "./scene-turn-regex";
import { finalCutStage } from "./scene-turn-final-cut";
import type { RegexRule, RegexSetBody } from "../entities/regex/schema";
import type { ReadLorebook } from "./scene-lore";
import { recallSection, runRecall } from "./compendium-recall";
import { directorOn } from "../core/director/settings";
import type { DirectorActivity } from "../stage/contracts/director-types";
import { summaryOf } from "../core/director/tracker-round";
import { cancelTrackerRound, startTrackerRound } from "./scene-director-trackers";
import { reconcileTrackers } from "./scene-tracker-undo";
import { commitDirector, runDirector, type DirectorDeps, type DirectorRun } from "./scene-director";
import { sendReply, sentTools, toolTurn, withToolCalls, type NarratorToolsFor } from "./scene-turn-tools";
import { failedAttempt, requestParams, routeOf, splitEntryKey, traceOf, traceOptions, type RequestParams, type RouteAttempt } from "./scene-turn-trace";

export { splitEntryKey };

export type TurnEvent =
  | { type: "start"; turnId: string; kind: TurnKind; messageId: string | null }
  /** A piece of the reply: added to the end, or, when `full` is set, the whole text so far. */
  | { type: "text"; delta: string; full?: true }
  /** A piece of the model's native reasoning, shaped like a text piece: it is not part of the reply. */
  | { type: "reasoning"; delta: string; full?: true }
  /** The Prompt Inspector's pause: the exact request, held until the page answers (scene-turn-review.ts). */
  | { type: "review"; turnId: string; messages: { role: ProviderRole; content: string }[]; tokens: number; /** The tool definitions this request will carry, when it carries any. */ tools?: { name: string; description: string; parameters: JsonObject }[]; /** The generation parameters this request sends and leaves out (scene-turn-trace.ts). */ params?: RequestParams }
  /** The scene's prompt regex, held for the page's sandbox worker (scene-turn-regex.ts): the rules and the conversation messages to rewrite; the page answers with the changed texts. */
  | { type: "regex"; turnId: string; rules: RegexRule[]; items: RegexItem[]; macros: { user: string; char: string }; /** "display" asks for the scene's text-rewriting display rules (Final Cut's input), else the prompt rules. */ phase?: "display" }
  /** Final Cut's pass `index` of `of` has started, before the reply is saved (scene-turn-final-cut.ts); the page shows RoleCall's "Final Cut pass...". */
  | { type: "finalcut"; pass: string; index: number; of: number }
  | { type: "done"; message: Message }
  | { type: "stopped"; message: Message | null }
  | { type: "failed"; category: string; code: string; message: string; draft: string }
  | { type: "conflict"; turnId: string; draft: string }
  /** The Compendium's recall before the reply (only when it is on): the page may show it; the reply never waits on its outcome. */
  /** The Start Reply With text the reply is being written after, sent as the assistant's own opening: the page may show it in front of the reply (Show Prefill in Chat). */
  | { type: "prefill"; text: string }
  /** The Story Director's planning before the reply (only when its Prop is on; never on Continue): the reply waits on it, and a failure only means no directive this turn. `entries` are its activity lines. */
  | { type: "director"; status: "planning" | "planned" | "failed"; reason?: string; entries?: DirectorActivity[] }
  | { type: "world"; status: "recalling" | "recalled" | "skipped" | "failed"; count?: number; reason?: string };

/** A scene's connection, resolved: the provider to send through, and what it says about itself. */
export interface Connected {
  provider: Provider;
  /** The connection's kind (its Kit spoke), for the meter's key. */
  kind: string;
  /** The model's context window, when the connection states one. */
  context?: number;
  /** Whether a scene may send this connection tool calls (the spoke declares them; absent means no). */
  tools?: boolean;
}

export interface TurnDeps {
  chats: ChatStore;
  state: StateStore;
  /** Resolves the scene's saved connection; null when Kit no longer has it. */
  connect(connection: ChatConnection): Promise<Connected | null>;
  /** The library's current body of the scene's preset (ChatStore rule 19). */
  readPreset: ReadPreset;
  /** The library's current body of a lorebook the scene reads (2e-d4 plan step 1). */
  readLorebook: ReadLorebook;
  /** The library's current body of a regex set the scene has on (ChatStore rule 42); absent: a scene's regex is not applied. */
  readRegex?(id: string): Promise<RegexSetBody | null>;
  /** Used only for migration-22 development scenes whose frozen cells were intentionally dropped. */
  readCastMember?(kind: "character" | "persona", id: string): Promise<unknown | null>;
  /** The person's saved choice answers for a preset (the pref `scenes.presetChoiceDefaults`), under the scene's own; absent: none. */
  choiceDefaults?(presetId: string): Promise<Record<string, unknown> | undefined>;
  /** The person's own Anti-Slop banks (studio/final-cut-library.ts), merged into the Anti-Slop pass; absent: none. */
  finalCutBanks?(): Promise<Record<string, import("../core/final-cut/banks").Bank>>;
  /** The first-party tools a reply may call when the scene's Narrator Tool Access is on (scene-turn-tools.ts). */
  narratorTools?: NarratorToolsFor;
  now(): number;
  randomSeed(): number;
  /** The Story Director's pause, jitter and call limit, so a test need not wait; absent: the real ones (scene-director-call.ts). */
  director?: DirectorDeps["director"];
}

/** Thrown before a turn opens when the scene has no usable connection: the "no connection" capsule. */
export class NoConnectionError extends StudioConflictError {
  constructor(message = "this scene has no connection; pick one in the AI wing") {
    super(message);
  }
}

/** Save the streamed text every 400 characters or every second, whichever comes first. */
const SAVE_EVERY_CHARS = 400;
const SAVE_EVERY_MS = 1_000;

export async function runTurn(
  deps: TurnDeps,
  /** `fallback`: the person's Fallback Model (Control Booth), tried once if the scene's model fails before writing anything. `guidance`: a guided re-roll's instruction, a swipe's alone. */
  input: { chatId: string; kind: TurnKind; expectedVersion: number; fallback?: ChatConnection; guidance?: string; /** Prompt Inspector on: stop with the exact request before anything is written or sent. */ inspect?: boolean },
  emit: (event: TurnEvent) => void,
): Promise<void> {
  const { chats, state } = deps;
  const guidance = input.guidance?.trim() ?? "";
  if (guidance && input.kind !== "swipe") throw new StudioValidationError("guidance belongs to a new version of a reply");
  if (guidance.length > GUIDANCE_MAX) throw new StudioValidationError(`guidance is longer than ${GUIDANCE_MAX} characters`);
  const chat = await chats.getChat(input.chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  // A tracker round still running for the last reply writes the trackers this turn reads: it stops and finishes writing or undoing first.
  await cancelTrackerRound(chat.id);
  if (!chat.connection) throw new NoConnectionError();
  let connected = await deps.connect(chat.connection);
  if (!connected) throw new NoConnectionError("this scene's connection is gone from Kit; pick another in the AI wing");
  const loaded = await loadTurn(chats, chat.id, input.kind, deps.readPreset, deps.readLorebook, deps.readCastMember, deps.choiceDefaults);
  if (!loaded) throw new StudioNotFoundError("that scene does not exist");
  const replacedId = loaded.target?.id;
  /** Who spoke, for the Director's tracker request after the reply. */
  const loadedTurn = loaded;
  const exchange = { characterName: loaded.character.identity.name, personaName: loaded.persona?.name ?? "User", userMessage: loaded.current.content };
  const target = loaded.target ? { kind: input.kind === "continue" ? ("continue" as const) : ("swipe" as const), messageId: loaded.target.id } : { kind: "reply" as const };
  /** The text a continue extends: the reply's current version, as stored (rule 13). */
  const original = input.kind === "continue" ? loaded.target!.swipes[loaded.target!.current]!.content : "";
  /** What the checkpoint and the commit hold: a continue holds only its addition, with any echo cut off. */
  let model = chat.connection.model;
  const stored = (streamed: string): string => (input.kind === "continue" ? continuationAddition(original, streamed, !modelTakesPrefill(model)) : streamed);
  const turn = await chats.beginTurn(loaded.branchId, target, { expectedVersion: input.expectedVersion });
  if (!turn) throw new StudioNotFoundError("that scene does not exist");

  const toolsTurn = toolTurn(deps.narratorTools, input.kind, chat, loaded);
  const controller = new AbortController();
  running.set(turn.id, { chatId: chat.id, controller });
  emit({ type: "start", turnId: turn.id, kind: input.kind, messageId: turn.messageId });
  let text = "";
  // Once the reply is in hand, nothing may throw it away: an error saving it keeps the checkpoint,
  // and the reply comes back when the scene next opens (rule 4).
  let answered = false;
  let putBackEffects: () => Promise<void> = async () => undefined;
  /** Puts back the Director's tracker updates a new version undid, when that version never lands. */
  let putBackTrackers: (() => Promise<void>) | null = null;
  let landed = false;
  /** The Story Director's plan for this reply; its snapshot is stored when, and only when, the reply commits. */
  let director: DirectorRun | null = null;
  /** The Director's call is stopped with the turn, and also whenever the turn ends for any other reason: a failure after it started must not leave it running, billed, behind a turn that is over. */
  const directorStop = new AbortController();
  controller.signal.addEventListener("abort", () => directorStop.abort(controller.signal.reason), { once: true });
  try {
    const started = deps.now();
    const prep = await prepareRequest(deps, chat, loaded, connected, model, started);
    const { window, options, presetName, reasoningFormat, meter, key, storedGlobals, undo, startLocal, startGlobal } = prep;
    // Recall (compendium-recall.ts) runs once, here: the Inspector's pause, the fallback model and a draft never ask it again.
    // The Director plans beside the Compendium's recall; both finish before anything is assembled. A Director that fails never fails the reply.
    if (directorOn(chat) && input.kind !== "continue") emit({ type: "director", status: "planning" });
    const planning = runDirector(deps, chat, loaded, { connected, model }, directorStop.signal, { kind: input.kind, format: reasoningFormat }).catch((error: unknown) => {
      emit({ type: "director", status: "failed", reason: toErrorMessage(error, "the Story Director failed") });
      return null;
    });
    const recall = await runRecall(deps, chat, loaded, { connected, model }, controller.signal, () => emit({ type: "world", status: "recalling" }));
    director = await planning;
    if (controller.signal.aborted) {
      await chats.dropTurn(turn.id);
      emit({ type: "stopped", message: null });
      return;
    }
    if (recall) emit({ type: "world", status: recall.status === "empty" ? "recalled" : recall.status, count: recall.entries.length, ...(recall.reason ? { reason: recall.reason } : {}) });
    if (director) emit({ type: "director", status: director.status, ...(director.reason ? { reason: director.reason } : {}), entries: director.entries });
    // The trackers carry only what the replies and versions that are shown did (plan 16): a cut reply's update, another version's, and the one a new version replaces, are undone first.
    if (input.kind !== "continue") {
      putBackTrackers = await reconcileTrackers(chats, chat.id, input.kind === "swipe" ? replacedId : undefined).catch(() => null);
      const fresh = putBackTrackers ? await chats.getChat(chat.id) : null;
      if (fresh?.trackers && fresh.props) loaded.trackers = { entries: fresh.trackers, on: fresh.props.on };
    }
    const built = await assembleRequest(deps, { chat, loaded, prep, started, kind: input.kind, original, guidance, recall, ...(director?.directive ? { director: director.directive } : {}) });
    const { result, asked, guided } = built;
    if (result.budget.overflow) {
      await chats.dropTurn(turn.id);
      emit({ type: "failed", category: "invalid_request_error", code: "context_length_exceeded", message: "The card and your message alone are longer than this model's window.", draft: "" });
      return;
    }
    let edits: Readonly<Record<number, string>> = {};
    const shape = (forModel: string) => shapeRequest({ chat, loaded, kind: input.kind, original, built, connected }, forModel, edits);
    let messages = shape(model);
    const regex = await promptRegex({ setIds: chat.regex?.sets, readRegex: deps.readRegex, trace: result.trace, messages, expansion: result.expansion, turnId: turn.id, chatId: chat.id, signal: controller.signal, emit });
    if (regex.stop) { await chats.dropTurn(turn.id); emit(regex.stop); return; }
    const regexEdits = regex.edits;
    edits = regexEdits;
    messages = shape(model);
    const opened = (forModel: string): string | undefined => openedWith({ chat, kind: input.kind, built }, forModel);
    if (opened(model)) emit({ type: "prefill", text: opened(model)! });
    const estimate = estimateFor(meter, key, countPrompt(messages.map((m) => m.content)), started);
    const recalled = recall ? recallSection(recall, result.recall) : undefined;
    let route: RouteAttempt[] = [{ connectionId: chat.connection.id, kind: connected.kind, model }];
    let trace = traceOf(recounted(result, regexEdits), model, window, estimate, traceOptions(options, connected.provider.params, model), guided, recalled);
    if (input.inspect) {
      // F16: the one pause gate. Cancel and Stop drop the checkpoint, so nothing was written, saved or sent.
      emit({ type: "review", turnId: turn.id, messages: messages.map((m) => ({ role: m.role, content: m.content })), tokens: estimate.mid, params: requestParams(traceOptions(options, connected.provider.params, model)), ...(sentTools(toolsTurn, connected).length > 0 ? { tools: sentTools(toolsTurn, connected) } : {}) });
      const decision = await awaitReview(turn.id, chat.id, controller.signal);
      if (decision.kind === "cancel") {
        await chats.dropTurn(turn.id);
        emit({ type: "stopped", message: null });
        return;
      }
      edits = { ...regexEdits, ...decision.edits };
      messages = shape(model);
    }
    // Step 4: RoleCall writes the variables before the request goes out; a regenerate keeps them.
    await chats.changeVariables(loaded.branchId, rebaseDiff(loaded.localVariables, startLocal, result.local));
    await writeGlobals(state, rebaseDiff(storedGlobals, startGlobal, result.global), started);
    /** A turn that does not commit (failure, Stop with nothing, nothing added) puts back every variable the lore effects of this attempt or of the reply it replaces touched, to what the library held before the turn; the others stay as RoleCall keeps them. */
    putBackEffects = async (): Promise<void> => {
      const names = (scope: "local" | "global") => new Set([...undo, ...(result.lore?.undo ?? [])].filter((u) => u.scope === scope).map((u) => u.name));
      const back = (stored: ReadonlyMap<string, MacroVariable>, scope: "local" | "global") => {
        const touched = [...names(scope)];
        return { set: Object.fromEntries(touched.filter((n) => stored.has(n)).map((n) => [n, stored.get(n)!.value])), delete: touched.filter((n) => !stored.has(n)) };
      };
      await chats.changeVariables(loaded.branchId, back(loaded.localVariables, "local")).catch(() => undefined);
      await writeGlobals(state, back(storedGlobals, "global"), started).catch(() => undefined);
    };
    // ChatStore rule 22: the take's latest request text, aligned with the stored trace's blocks
    // (result.messages and result.trace share the same order and length, section 9's own build).
    const request = { texts: applyEdits(asked, edits).map((m) => m.content) };
    let savedChars = 0;
    let savedAt = deps.now();
    let saving: Promise<unknown> = chats.saveCheckpoint(turn.id, { content: "", trace });
    const save = () => {
      savedChars = text.length;
      savedAt = deps.now();
      // A save that finds the library busy is skipped: the next one supersedes it.
      saving = saving.then(() => chats.saveCheckpoint(turn.id, { content: stored(text) })).catch(() => undefined);
    };
    // The clock for "Reasoned for" (first reasoning token to first reply token) and "Thought for" (the reply's own opening tag to its closing one).
    let reasoningFrom: number | undefined;
    let reasoningEnd: number | undefined;
    let tagFrom: number | undefined;
    let tagEnd: number | undefined;
    const onEvent = (event: ProviderEvent) => {
      if (event.channel === "reasoning") {
        reasoningFrom ??= deps.now();
        if ("full" in event) emit({ type: "reasoning", delta: event.full, full: true });
        else if (event.delta) emit({ type: "reasoning", delta: event.delta });
        return;
      }
      if (reasoningFrom !== undefined) reasoningEnd ??= deps.now();
      if ("full" in event) {
        if (event.full === text) return;
        text = event.full;
        emit({ type: "text", delta: text, full: true });
      } else {
        if (!event.delta) return;
        text += event.delta;
        emit({ type: "text", delta: event.delta });
      }
      if (tagEnd === undefined && input.kind !== "continue") {
        const state = tagThinkingState(text, reasoningFormat);
        if (state !== "none") tagFrom ??= deps.now();
        if (state === "closed") tagEnd = deps.now();
      }
      if (text.length - savedChars >= SAVE_EVERY_CHARS || deps.now() - savedAt >= SAVE_EVERY_MS) save();
    };

    let completion;
    try {
      try {
        completion = await sendReply(connected, { model, messages, options }, { signal: controller.signal, onEvent }, toolsTurn, deps.now);
      } catch (first) {
        // RoleCall's fallback (worker.ts): only a transient failure, only before anything was written, never a Stop, and
        // never the model that just failed. One try; if it fails too, the main model's error is the one reported.
        const fb = input.fallback;
        const eligible = !controller.signal.aborted && !text && reasoningFrom === undefined && toolsTurn.calls.length === 0 && isFallbackWorthy(first) && !(fb?.id === chat.connection.id && fb.model === model);
        const next = fb && eligible ? await deps.connect(fb).catch(() => null) : null;
        if (!fb || !next) throw first;
        const before = { connected, model, messages, trace, route };
        route = [failedAttempt(route[0]!, first), { connectionId: fb.id, kind: next.kind, model: fb.model }];
        connected = next;
        model = fb.model;
        messages = shape(model);
        trace = traceOf(recounted(result, regexEdits), model, window, estimate, traceOptions(options, connected.provider.params, model), guided, recalled);
        try {
          completion = await sendReply(connected, { model, messages, options }, { signal: controller.signal, onEvent }, toolsTurn, deps.now);
        } catch (second) {
          if (controller.signal.aborted || text || reasoningFrom !== undefined) throw second;
          ({ connected, model, messages, trace, route } = before);
          throw first;
        }
      }
    } catch (error) {
      await saving.catch(() => undefined);
      if (controller.signal.aborted) {
        // Stop keeps what arrived; with nothing (or, for a continue, nothing but an echo), nothing is stored.
        if (!stored(text)) {
          await putBackEffects();
          await chats.dropTurn(turn.id);
          emit({ type: "stopped", message: null });
          return;
        }
        answered = true;
        await commit({ content: stored(text), generation: { model, finishReason: "stopped", presetName, generationMs: deps.now() - started, ...(guidance ? { guidance } : {}) }, ...(input.kind === "continue" ? {} : withToolCalls(toolsTurn, { ...trace, route: routeOf(route, "stopped") }, request)) }, "stopped");
        return;
      }
      await putBackEffects();
      await chats.dropTurn(turn.id);
      const failure = error instanceof ProviderError ? error : null;
      emit({
        type: "failed",
        category: failure?.category ?? "api_error",
        code: failure?.code ?? "backend_error",
        message: toErrorMessage(error, "the reply failed"),
        draft: text,
      });
      return;
    }
    await saving.catch(() => undefined);
    // The provider trims a completion, and a continuation's leading space is part of the sentence it
    // finishes (" and the glass"): a continue keeps what streamed, trimmed only at the end.
    text = input.kind === "continue" && text ? text.trimEnd() : completion.content;
    // A reply that is only native reasoning is still a reply and is kept, as an empty message the bubble labels
    // (RoleCall refuses it, worker.ts MODEL_RESPONSE_MISSING). A continue has no
    // message of its own to keep, so one that adds nothing is refused whatever the model thought.
    const thoughtOnly = input.kind !== "continue" && !text && Boolean(completion.reasoning?.trim());
    if (!stored(text) && !thoughtOnly) {
      // A continue the model answered with nothing new: nothing to store, and the person is told.
      await putBackEffects();
      await chats.dropTurn(turn.id);
      emit({ type: "failed", category: "invalid_request_error", code: "nothing_to_add", message: "The model had nothing to add to this reply.", draft: "" });
      return;
    }
    answered = true;
    // Smart Recovery (Auto): thinking run into the reply with no wrapper, found by the scene's model and kept as a boundary.
    const thinkingEnd = input.kind === "continue" ? undefined : await recoverThinkingEnd({ provider: connected.provider, model, text, history: loaded.history, format: reasoningFormat, ...(completion.reasoning ? { native: completion.reasoning } : {}), signal: controller.signal });
    const done = deps.now();
    const reasoningMs = reasoningFrom !== undefined && completion.reasoning ? (reasoningEnd ?? done) - reasoningFrom : 0;
    const tagMs = tagFrom !== undefined ? (tagEnd ?? done) - tagFrom : 0;
    const generation: Generation = {
      model: completion.model ?? model,
      ...(completion.finish_reason ? { finishReason: completion.finish_reason } : {}),
      ...(toolsTurn.rounds > 0 ? { promptTokens: toolsTurn.tokens.prompt, completionTokens: toolsTurn.tokens.output } : {
        ...(completion.usage?.promptTotal !== undefined ? { promptTokens: completion.usage.promptTotal } : {}),
        ...(completion.usage?.output !== undefined ? { completionTokens: completion.usage.output } : {}),
      }),
      generationMs: done - started,
      ...(reasoningMs > 0 ? { reasoningMs } : {}),
      ...(tagMs > 0 ? { tagThinkingMs: tagMs } : {}),
      presetName,
      ...(guidance ? { guidance } : {}),
      ...(thinkingEnd ? { thinkingEnd } : {}),
      ...(opened(model) ? { prefill: opened(model)! } : {}),
      // Kept for the same model only to be sent back (pipeline-hooks behavior 7, step 2f).
      ...(completion.reasoning ? { reasoning: { text: completion.reasoning, ...(thinkingSignature(completion.reasoning_details) ? { signature: thinkingSignature(completion.reasoning_details)! } : {}), provider: connected.provider.id, model: completion.model ?? model } } : {}),
    };
    // Through JSON, so the stored trace is JSON exactly (the store refuses anything else).
    const usage = completion.usage ? (JSON.parse(JSON.stringify(completion.usage)) as JsonObject) : undefined;
    const cut = input.kind === "continue" ? null : await finalCutStage({ deps, chat, text, history: [...loaded.history, loaded.current], format: reasoningFormat, signal: controller.signal, emit, turnId: turn.id, ...(deps.finalCutBanks ? { userBanks: deps.finalCutBanks } : {}) });
    if (cut && "stop" in cut) { await putBackEffects(); await chats.dropTurn(turn.id); emit(cut.stop); return; }
    if (cut) text = cut.text;
    const committed = await commit({ content: stored(text), generation: { ...generation, ...(cut ? { finalCut: cut.summary } : {}) }, ...(input.kind === "continue" ? {} : withToolCalls(toolsTurn, { ...trace, route: routeOf(route, "answered", completion.model), ...(usage ? { usage } : {}), ...(cut ? { finalCut: cut.trace } : {}) }, request)) }, "done");
    // Step 7, best-effort: a lost calibration sample is harmless.
    // Not after tool rounds: their usage covers more than the request the meter would be taught it against.
    if (committed && toolsTurn.rounds === 0) {
      await learnReply(state, modelKey(connected.kind, model, completion.model), messages.map((m) => m.content), completion.usage, deps.now()).catch(() => undefined);
    }
  } catch (error) {
    if (answered) {
      // Best-effort: the checkpoint then holds the whole reply, not just the last periodic save.
      await chats.saveCheckpoint(turn.id, { content: stored(text) }).catch(() => undefined);
      emit({ type: "failed", category: "api_error", code: "backend_error", message: "The reply arrived but could not be saved yet. It is kept, and comes back when the scene reopens.", draft: stored(text) });
    } else {
      await putBackEffects();
      await chats.dropTurn(turn.id).catch(() => undefined);
      // A preset block the assembler cannot place fails the same way every time: not worth a Retry.
      const plan = error instanceof PresetPlanError;
      emit({ type: "failed", category: plan ? "invalid_request_error" : "api_error", code: plan ? "invalid_preset" : "backend_error", message: toErrorMessage(error, "the reply failed"), draft: text });
    }
  } finally {
    directorStop.abort();
    running.delete(turn.id);
    if (!landed && putBackTrackers) await putBackTrackers().catch(() => undefined);
  }

  /** Commits guarded by the version the turn began from; a conflict keeps the checkpoint, holding the whole text. */
  async function commit(result: { content: string; generation: Generation; trace?: JsonObject; request?: { texts: string[] } }, as: "done" | "stopped"): Promise<boolean> {
    try {
      // The version being replaced, read before it is: an edit the person made to it while the Director's call was out is carried onto the new one.
      const replaced = director && replacedId ? await chats.getDirector(input.chatId, replacedId).catch(() => null) : null;
      const message = await chats.commitTurn(turn!.id, result, { expectedVersion: turn!.baseVersion });
      if (!message) {
        await chats.dropTurn(turn!.id);
        emit({ type: "failed", category: "invalid_request_error", code: "invalid_parameter", message: "the message this was a new version of is gone", draft: result.content });
        return false;
      }
      // The reply is in: now, and only now, the Director's state for it is stored (a reply that fails or is dropped leaves no snapshot).
      // A snapshot that could not be stored is said so; the reply is safe and the next turn plans from the last state that was.
      const stored = director ? await commitDirector(deps, input.chatId, director, message, replaced) : true;
      if (stored !== true) emit({ type: "director", status: "failed", reason: stored });
      landed = true;
      // The Spellbook counts down first (rule 43), so the Director's round below plans against the state the next turn will see, and `done` goes out after both.
      if (as === "done") await trackersAfterReply(chats, input.chatId, carriedBy(loadedTurn)).catch(() => undefined);
      // After the reply, in the background: the Director updates the trackers that are on and due from the exchange that just happened. Never on Stop or Continue.
      if (as === "done" && stored === true && director?.status === "planned" && input.kind !== "continue") {
        startTrackerRound({ chats, connect: deps.connect, now: deps.now }, {
          chatId: input.chatId, messageId: message.id, swipeId: message.swipes[message.current]!.id, turn: director.turn, ...exchange, reply: message.swipes[message.current]?.content ?? result.content, ...(director.directive ? { directive: summaryOf(director.directive) } : {}),
        });
      }
      emit(as === "done" ? { type: "done", message } : { type: "stopped", message });
      return true;
    } catch (error) {
      if (!(error instanceof StudioConflictError)) throw error;
      await chats.saveCheckpoint(turn!.id, { content: result.content, ...(result.trace ? { trace: result.trace } : {}) });
      emit({ type: "conflict", turnId: turn!.id, draft: result.content });
      return false;
    }
  }
}
