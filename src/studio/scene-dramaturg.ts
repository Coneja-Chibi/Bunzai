/**
 * A Dramaturg turn (specs/stage/dramaturg.md, "A turn"): the person asks the scene's out-of-character consultant a question, and it answers
 * from the evidence the scene engine loads for the next reply, changing nothing in the scene. `prepareDramaturgTurn` does steps 1 to 3
 * before any stream opens and answers a refusal as a status for plain HTTP: the Prop off, an empty or too-long question, a turn already
 * running for the scene, the conversation moved on since the page read it, no model, a tier table that does not grant `dramaturg.ask` its
 * `write` (it writes the Dramaturg's own conversation and nothing else, the Story Director's precedent), or a scene that cannot load.
 * The scene reads as the narrator reads it: each message without its thinking or tool-call leaks, the preset's blocks on or off as the
 * scene's choices and toggles set them; when the model states its window, the conversation goes before the evidence does.
 * `run` does steps 4 and 5: a streaming send (through the narrator's tool loop with the read tools when the connection takes tools), then
 * one append of the question and the answer under the revision read at the start; a failure or a Stop appends the question and what arrived,
 * marked failed. Inline thinking is neither streamed nor saved. One turn per scene: the slot is held from a granted prepare until its run
 * ends, so the route must call `run`.
 */
import type { TurnRuntime } from "./scene-turn-runtime";
import { cardView } from "../core/assembly/card";
import { personaBlock } from "../core/assembly/persona-preview";
import { PresetPlanError, presetPlan } from "../core/assembly/preset";
import { turnWindow } from "../core/assembly/request";
import { dramaturgEvidence, type EvidenceInput } from "../core/dramaturg/context";
import { dramaturgHistory, fitHistory } from "../core/dramaturg/history";
import { dramaturgPrompt } from "../core/dramaturg/prompt";
import { DRAMATURG_QUESTION_MAX, dramaturgOn, resolveDramaturg, type ResolvedDramaturg } from "../core/dramaturg/settings";
import { isRecord, str } from "../core/guards";
import { resolveSelections } from "../core/macros/choice-groups";
import { effectiveToggles, toChoiceGroups } from "../core/preset/choices";
import { resolveReasoning } from "../core/reasoning-capture";
import { splitReasoning } from "../core/reasoning-tags";
import { countPrompt } from "../core/tokens";
import { dramaturgInputTokens } from "../core/dramaturg/request";
import { toErrorMessage } from "../error-message";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import type { ChatStore, Message } from "../stage/contracts/chat-store";
import {
  DRAMATURG_FAILURE_MAX, DRAMATURG_MODEL_LABEL_MAX, DRAMATURG_READS_MAX, DRAMATURG_TEXT_MAX,
  type ChatStoreDramaturg, type DramaturgEntryInput, type DramaturgRead, type DramaturgThread,
} from "../stage/contracts/dramaturg-types";
import { ProviderError, type ProviderEvent, type ProviderMessage, type ProviderRequest } from "../stage/contracts/provider";
import { sendWithTools, type NarratorTool } from "../stage/provider/tool-loop";
import { StudioConflictError } from "./errors";
import { StudioNotFoundError, StudioValidationError } from "./errors";
import { dramaturgTools, readSummary, sceneLines } from "./dramaturg-tools";
import type { Connected, TurnDeps } from "./scene-turn";
import { loadTurn, type LoadedTurn, type TurnReader } from "./scene-turn-load";

/** One event of a turn, in order; `done`, `failed` and `stopped` end it and carry the conversation as saved (none when nothing could be). */
export type DramaturgEvent =
  | { type: "text"; delta: string }
  | { type: "read"; tool: string; summary: string }
  | { type: "done"; thread: DramaturgThread }
  | { type: "failed"; message: string; thread?: DramaturgThread }
  | { type: "stopped"; thread: DramaturgThread };

export interface DramaturgDeps extends Pick<TurnDeps, "connect" | "readPreset" | "readLorebook" | "readLibrary" | "choiceDefaults" | "now"> {
  runtime: TurnRuntime;
  /** The scene is only read; the Dramaturg's own record is read and appended to. */
  chats: TurnReader & Pick<ChatStore, "searchMessages"> & Pick<ChatStoreDramaturg, "getDramaturg" | "appendDramaturg">;
  /** The scene tier table (kit/tools/safety/scene-tiers.ts), injectable so a test can change it. */
  tiers?: Readonly<Record<"dramaturg.ask", string>>;
}

export type DramaturgTurn =
  | { ok: false; status: number; message: string }
  /** `signal` ends the turn as a Stop does; the spec keeps a turn running when the page leaves, so the route passes none for that. */
  | { ok: true; run(emit: (event: DramaturgEvent) => void, signal?: AbortSignal): Promise<void> };

/** Whether a turn is running for the scene now (the panel's `busy`). */
export const dramaturgBusy = (runtime: TurnRuntime, chatId: string): boolean => runtime.dramaturg.has(chatId);

/**
 * Stops the scene's running turn; what arrived is kept, marked as stopped. With `revision`, only a turn that started from that revision, so
 * a late Stop from one window never ends the next turn another window began. False when nothing was stopped.
 */
export function stopDramaturg(runtime: TurnRuntime, chatId: string, revision?: number): boolean {
  const turn = runtime.dramaturg.get(chatId);
  if (!turn || (revision !== undefined && turn.revision !== revision)) return false;
  turn.controller.abort(new DOMException("The Dramaturg was stopped.", "AbortError"));
  return true;
}

const MAX_ROUNDS = 8;

interface Ready {
  settings: ResolvedDramaturg;
  connected: Connected;
  model: string;
  tools: NarratorTool<never>[];
  /** The system message and the conversation so far. */
  messages: ProviderMessage[];
  reply: number;
}

/** The lore in the prompt of the take's latest reply (its trace's injected entries), whole from the scene's books, and the count its budget cut. */
async function firedLore(chats: TurnReader, live: readonly Message[], books: NonNullable<LoadedTurn["lore"]>["books"]): Promise<Pick<EvidenceInput, "lore" | "loreCut">> {
  const reply = live.filter((m) => m.role === "assistant").at(-1);
  const trace = reply ? await chats.swipeTrace(reply.id, reply.swipes[reply.current]!.id) : null;
  const lore = isRecord(trace?.["lore"]) ? trace["lore"] : {};
  const hits = (key: string) => (Array.isArray(lore[key]) ? (lore[key] as unknown[]).filter(isRecord) : []);
  return {
    lore: hits("injected").map((h) => {
      const book = books.find((b) => b.id === str(h["bookId"]));
      const entry = book?.body.entries.find((e) => e.id === str(h["entryId"]));
      return { title: entry?.title || str(h["title"]), book: book?.name ?? str(h["bookId"]), content: entry?.content ?? str(h["content"]), reason: str(h["reason"]), matched: Array.isArray(h["matched"]) ? h["matched"].map(String) : [] };
    }),
    loreCut: hits("cut").length,
  };
}

/** Steps 1 to 3 past the slot: everything a refusal can come from, as a Studio error. */
async function gather(deps: DramaturgDeps, chatId: string, revision: number, question: string, signal: AbortSignal): Promise<Ready> {
  const { chats } = deps;
  const chat = await chats.getChat(chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  if (!dramaturgOn(chat)) throw new StudioConflictError("the Dramaturg is not on in this scene; switch it on in the Props wing");
  const thread = await chats.getDramaturg(chatId);
  if (!thread) throw new StudioNotFoundError("that scene does not exist");
  if (thread.revision !== revision) throw new StudioConflictError("the Dramaturg's conversation has changed since this page read it; reload it");
  const settings = resolveDramaturg(thread.settings);
  const connection = settings.model ?? chat.connection;
  if (!connection) throw new StudioConflictError("Pick a model for the scene or the Dramaturg");
  const connected = await deps.connect(connection, signal);
  if (!connected) throw new StudioConflictError("that model's connection is gone from Kit; pick another for the scene or the Dramaturg");
  const loaded = await loadTurn(chats, chatId, "draft", deps.readPreset, deps.readLorebook, deps.readLibrary, deps.choiceDefaults);
  if (!loaded) throw new StudioNotFoundError("that scene does not exist");

  const live = loaded.take.filter((m) => !m.cut);
  const card = cardView(loaded.character);
  const lines = sceneLines(live, card.name, loaded.persona?.name ?? "", { reasoning: resolveReasoning(loaded.preset?.reasoning, chat.prompting), keepThinking: chat.prompting?.keepThinking === true });
  // The blocks on or off as the narrator's are (assemble.ts): the preset's choices set the baseline, the scene's own switches go on top.
  const groups = toChoiceGroups(loaded.preset?.choices);
  const blocks = loaded.preset ? presetPlan(loaded.preset, effectiveToggles(groups, resolveSelections(groups, loaded.choices), loaded.promptToggles)).info : [];
  const books = loaded.lore?.books ?? [];
  const tools = connected.tools === true ? dramaturgTools({ branchId: loaded.branchId, lines, books, blocks }, chats) : [];
  const evidence = dramaturgEvidence({
    card: { name: card.name, description: card.description, personality: card.personality, scenario: card.scenario, examples: card.examples, postHistory: card.postHistory, characterPrompt: card.macroFields.charPrompt ?? "" },
    ...(loaded.persona ? { persona: { name: loaded.persona.name || "User", text: personaBlock(loaded.persona, loaded.character, deps.now()) } } : {}),
    preset: blocks.flatMap((b) => (b.enabled && b.content?.trim() ? [{ id: b.id, name: b.name, content: b.content }] : [])),
    ...(await firedLore(chats, live, books)),
    messages: lines.filter((l) => !l.hidden),
    hidden: lines.filter((l) => l.hidden).length,
  });
  const system = `${dramaturgPrompt({ tools: tools.length > 0 })}\n\n---\n\n${evidence.block}`;
  const window = turnWindow(connected.context);
  const fixed: ProviderMessage[] = [{ role: "system", content: system }, { role: "user", content: question }];
  const definitions = tools.map((tool) => tool.definition);
  const budget = window.context - window.reply;
  const fixedTokens = dramaturgInputTokens(fixed, definitions);
  const overflow = "The Dramaturg's evidence exceeds this model's context budget. Pick a model with a larger context window or reduce the scene's evidence.";
  if (fixedTokens > budget) throw new StudioConflictError(overflow);
  const history = fitHistory(dramaturgHistory(thread.entries), fixedTokens, budget, (content) => countPrompt([JSON.stringify({ role: "assistant", content })]).total);
  const provider: Connected["provider"] = { ...connected.provider, send: (request, io) => {
    if (dramaturgInputTokens(request.messages, request.options.tools) + window.reply > window.context) throw new ProviderError(overflow, { category: "invalid_request_error", code: "context_length_exceeded", status: 400 });
    return connected.provider.send(request, io);
  } };
  return { settings, connected: { ...connected, provider }, model: connection.model, tools, reply: window.reply, messages: [fixed[0]!, ...history] };
}

const statusOf = (e: unknown): number | null =>
  e instanceof StudioValidationError ? 400 : e instanceof StudioNotFoundError ? 404 : e instanceof StudioConflictError || e instanceof PresetPlanError ? 409 : null;

export async function prepareDramaturgTurn(deps: DramaturgDeps, input: { chatId: string; question: string; revision: number }): Promise<DramaturgTurn> {
  const refuse = (status: number, message: string): DramaturgTurn => ({ ok: false, status, message });
  const question = input.question.trim();
  if (!question) return refuse(400, "Ask the Dramaturg something first.");
  if (question.length > DRAMATURG_QUESTION_MAX) return refuse(400, `A question is at most ${DRAMATURG_QUESTION_MAX.toLocaleString("en-US")} characters.`);
  const tier = (deps.tiers ?? SCENE_ACTION_TIERS)["dramaturg.ask"];
  if (tier !== "write") return refuse(409, `dramaturg.ask is set to the ${String(tier)} tier, and the Dramaturg needs write to keep its own conversation`);
  if (deps.runtime.closed) return refuse(409, "The roleplay core is closed.");
  if (deps.runtime.dramaturg.has(input.chatId)) return refuse(409, "The Dramaturg is already answering in this scene; wait for it or stop it.");
  const own = new AbortController();
  const runtime = deps.runtime;
  runtime.dramaturg.set(input.chatId, { controller: own, revision: input.revision });
  let phase: "preparing" | "prepared" | "running" | "settled" = "preparing";
  let settle!: () => void;
  const done = new Promise<void>((resolve) => { settle = resolve; });
  runtime.tasks.add(done);
  const release = (): void => {
    phase = "settled";
    runtime.dramaturg.delete(input.chatId);
    runtime.tasks.delete(done);
    own.signal.removeEventListener("abort", onAbort);
    settle();
  };
  const onAbort = (): void => { if (phase === "prepared") release(); };
  own.signal.addEventListener("abort", onAbort);
  let ready: Ready;
  try {
    ready = await gather(deps, input.chatId, input.revision, question, own.signal);
    own.signal.throwIfAborted();
    phase = "prepared";
  } catch (e) {
    release();
    if (own.signal.aborted) return refuse(409, "The Dramaturg was stopped before it could answer.");
    const status = statusOf(e);
    if (status === null) throw e;
    return refuse(status, (e as Error).message);
  }
  return { ok: true, run: async (emit, signal) => {
    if (phase !== "prepared") throw new StudioConflictError("this Dramaturg turn has already ended or started");
    phase = "running";
    try { await answer(deps, input.chatId, input.revision, question, ready, own, emit, signal); }
    finally { release(); }
  } };
}

const CUT = `\n\n[cut: the answer was longer than ${DRAMATURG_TEXT_MAX.toLocaleString("en-US")} characters]`;

/** An answer as the store takes it: each field within its cap (dramaturg-types.ts), so the append is never refused for length; a cut answer says so. */
const answerEntry = (text: string, model: string, reads: DramaturgRead[], failed?: string): DramaturgEntryInput => ({
  role: "assistant", text: text.length > DRAMATURG_TEXT_MAX ? text.slice(0, DRAMATURG_TEXT_MAX - CUT.length) + CUT : text, model: model.slice(0, DRAMATURG_MODEL_LABEL_MAX),
  ...(reads.length > 0 ? { reads: reads.slice(0, DRAMATURG_READS_MAX) } : {}), ...(failed ? { failed: failed.slice(0, DRAMATURG_FAILURE_MAX) } : {}),
});

async function answer(deps: DramaturgDeps, chatId: string, revision: number, question: string, r: Ready, own: AbortController, emit: (event: DramaturgEvent) => void, outer?: AbortSignal): Promise<void> {
  const signal = outer ? AbortSignal.any([own.signal, outer]) : own.signal;
  const reads: DramaturgRead[] = [];
  let raw = "";
  let shown = "";
  // The stream is a preview of the reply without its inline thinking: text that would rewrite what was shown is held back, and the saved
  // answer is what `done` carries.
  const onEvent = (e: ProviderEvent): void => {
    if (e.channel !== "content") return;
    raw = "full" in e ? e.full : raw + e.delta;
    const reply = splitReasoning(raw, undefined, true).reply;
    if (reply.length > shown.length && reply.startsWith(shown)) {
      emit({ type: "text", delta: reply.slice(shown.length) });
      shown = reply;
    }
  };
  const level = r.settings.reasoning;
  const request: ProviderRequest = {
    model: r.model,
    messages: [...r.messages, { role: "user", content: question }],
    options: { temperature: r.settings.temperature, stream: true, max_tokens: r.reply, ...(level ? { reasoning_effort: level, ...(level === "none" ? {} : { params: { enable_thinking: true } }) } : {}) },
  };
  let entry: DramaturgEntryInput;
  let failure: string | null = null;
  try {
    signal.throwIfAborted();
    const completion = r.tools.length > 0
      ? (await sendWithTools(r.connected.provider, request, { signal, onEvent }, {
        tools: r.tools, maxRounds: MAX_ROUNDS, now: deps.now,
        onCall: (call) => {
          const read = { tool: call.name, summary: readSummary(call) };
          reads.push(read);
          emit({ type: "read", ...read });
        },
      })).completion
      : await r.connected.provider.send(request, { signal, onEvent });
    const text = splitReasoning(completion.content).reply;
    if (!text) throw new ProviderError("The model sent back nothing.", { category: "api_error", code: "backend_error", status: 502 });
    entry = answerEntry(text, completion.model ?? r.model, reads);
  } catch (e) {
    failure = signal.aborted ? "Stopped." : toErrorMessage(e, "the Dramaturg could not answer");
    entry = answerEntry(splitReasoning(raw, undefined, true).reply, r.model, reads, failure);
  }
  let thread: DramaturgThread | null;
  try {
    thread = await deps.chats.appendDramaturg(chatId, [{ role: "user", text: question }, entry], { expectedRevision: revision });
  } catch (e) {
    return emit({ type: "failed", message: e instanceof StudioConflictError ? "The conversation was cleared while this answer was written, so it was not saved." : toErrorMessage(e, "the answer could not be saved") });
  }
  if (!thread) return emit({ type: "failed", message: "That scene is gone, so the answer was not saved." });
  emit(failure === null ? { type: "done", thread } : signal.aborted ? { type: "stopped", thread } : { type: "failed", message: failure, thread });
}
