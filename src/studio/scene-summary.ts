/**
 * The chat summary's writer (rc-parity 08, Memory; RoleCall `hooks/useSceneSummary.ts` and `page.tsx:1360-1434`, which run in the browser behind about 800 lines of fencing against a changing account,
 * route and history). Here it runs on the server after a reply has landed, in the scene's lane, and cannot touch the reply: Rolling recap and Growing timeline refresh or extend the take's text once
 * enough messages have come in, Every exchange adds one `Turn N:` line per finished exchange, and Backfill history rebuilds the text from the whole take. A write carries the time it was read at, so
 * a summary generated from an old reading never overwrites one the person edited meanwhile. Every failure is a sentence kept on the scene (`Last summary run failed:`); the saved text stays as it was.
 * No message, prompt or summary text is logged.
 */
import { cardView } from "../core/assembly/card";
import { bodyOf } from "../core/guards";
import { splitReasoning } from "../core/reasoning-tags";
import {
  PAIR_PROMPT, backfillPrompt, checkPairBackfill, combinePrompt, exchangesOf, nextTurn, pairPrompt, renderTemplate, rollingPrompt, tidyLine, type BackfillMode, type Said,
} from "../core/summary/prompts";
import { SUMMARY_DEFAULTS, automationActive, resolveSummary, summaryWindow, type ResolvedSummary } from "../core/summary/settings";
import { playedBody } from "../entities/character/variant";
import type { CharacterBody } from "../entities/character/schema";
import type { Chat, ChatConnection, ChatStore, Message, SummarySettings, TakeSummary } from "../stage/contracts/chat-store";
import { ProviderError } from "../stage/contracts/provider";
import { StudioConflictError } from "./atomic-file";
import { StudioNotFoundError } from "./errors";
import { enqueue } from "./compendium-queue";
import { WHOLE_BRANCH } from "./scene-branch";
import type { Connected } from "./scene-turn";
import { loadCast, type TurnKind } from "./scene-turn-load";

export interface SummaryDeps {
  chats: ChatStore;
  /** Resolves a saved connection (the summary model, or the scene's own); null when Kit no longer has it. */
  connect(connection: ChatConnection): Promise<Connected | null>;
  readCastMember?(kind: "character" | "persona", id: string): Promise<unknown | null>;
}

/** A failure in words for the person; it is what the Memory tab shows after "Last summary run failed:". */
export class SummaryFailure extends StudioConflictError {}

const NO_MODEL = "Choose a configured Summary Model before automatic summaries can run.";
const LENGTH = "The summary reached the configured Max output tokens. Increase that setting and try again.";
const running = new Set<string>();

/** Whether a run is going for this scene now (RoleCall's `isSummarizing`). */
export const isSummarizing = (chatId: string): boolean => running.has(chatId);

interface Setup { chat: Chat; branchId: string; name: string; s: ResolvedSummary; connected: Connected; model: string }

async function setup(deps: SummaryDeps, chatId: string): Promise<Setup> {
  const cast = await loadCast(deps.chats, chatId, deps.readCastMember);
  if (!cast) throw new StudioNotFoundError("that scene does not exist");
  const { chat, snapshot } = cast;
  const s = resolveSummary(chat.summary?.settings);
  const target = s.model ?? chat.connection;
  const connected = target ? await deps.connect(target) : null;
  if (!target || !connected) throw new SummaryFailure(NO_MODEL);
  const character = playedBody(bodyOf(snapshot.character) as unknown as CharacterBody, chat.variantId);
  return { chat, branchId: chat.activeBranchId, name: cardView(character).name, s, connected, model: target.model };
}

/** One call: the prompt as the only message, at the summary's own temperature and output budget. A capacity error is told apart so a backfill can split. */
async function ask(d: Setup, prompt: string, signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
  try {
    const done = await d.connected.provider.send(
      { model: d.model, messages: [{ role: "user", content: prompt }], options: { temperature: d.s.temperature, max_tokens: d.s.maxTokens, ...(d.s.reasoning ? { reasoning_effort: "low" as const } : {}) } },
      signal ? { signal } : {},
    );
    return { text: splitReasoning(done.content).reply.trim(), truncated: done.finish_reason === "length" || done.finish_reason === "max_tokens" };
  } catch (e) {
    if (e instanceof ProviderError && e.code === "context_length_exceeded") throw new Capacity();
    throw new SummaryFailure(e instanceof Error && e.message ? e.message : "Summary generation failed.");
  }
}
class Capacity extends Error {}

/** The take's live messages that the model should read: user and assistant, not hidden from the prompt, each as the model sees it (thinking cut). */
async function liveMessages(chats: ChatStore, branchId: string): Promise<{ said: Said[]; total: number; ids: string[] }> {
  const all = (await chats.readMessages(branchId, { limit: WHOLE_BRANCH })).messages.filter((m) => !m.cut);
  const read = all.filter((m) => !m.hidden && (m.role === "user" || m.role === "assistant"));
  return { said: read.map((m) => ({ role: m.role, content: splitReasoning(m.swipes[m.current]?.content ?? "").reply })), total: all.length, ids: read.map((m) => m.id) };
}

const lines = (messages: readonly Said[], s: ResolvedSummary): string =>
  messages.map((m) => `[${m.role}]: ${s.truncate && m.content.length > SUMMARY_DEFAULTS.sourceLimit ? `${m.content.slice(0, SUMMARY_DEFAULTS.sourceLimit)}...` : m.content}`).join("\n");

const guarded = async (chats: ChatStore, branchId: string, input: { text: string; through: number; last?: string }, at: number | null): Promise<TakeSummary | null> =>
  (await chats.setSummary(branchId, input, { at }))?.summary ?? null;

/** A rolling run: refresh or extend the take's summary from its last messages (RoleCall `generateSummary`, scope auto). */
async function rolling(deps: SummaryDeps, d: Setup, take: TakeSummary | null): Promise<void> {
  const { said, total } = await liveMessages(deps.chats, d.branchId);
  const window = summaryWindow(d.s);
  const recent = window === undefined ? said : said.slice(-window);
  if (recent.length === 0) return;
  const existing = take?.text ?? "";
  const template = d.s.prompt || rollingPrompt(d.s.mode, existing !== "");
  const history = existing && !template.includes("{{existingSummary}}") ? `[Existing summary]: ${existing}\n\n${lines(recent, d.s)}` : lines(recent, d.s);
  const out = await ask(d, renderTemplate({ template, characterName: d.name, conversationHistory: history, existingSummary: existing }));
  if (out.text === "") return;
  if (out.truncated) throw new SummaryFailure(LENGTH);
  await guarded(deps.chats, d.branchId, { text: out.text, through: total }, take?.at ?? null);
}

/** A per-exchange run: one `Turn N:` line for the reply that just landed, once per reply (RoleCall `generatePairSummary`). */
async function pair(deps: SummaryDeps, d: Setup, take: TakeSummary | null, landed: Message): Promise<void> {
  if (take?.last === landed.id) return;
  const all = (await deps.chats.readMessages(d.branchId, { limit: WHOLE_BRANCH })).messages.filter((m) => !m.cut);
  const at = all.findIndex((m) => m.id === landed.id);
  const user = [...all.slice(0, Math.max(at, 0))].reverse().find((m) => m.role === "user");
  const reply = splitReasoning(landed.swipes[landed.current]?.content ?? "").reply;
  const said = user ? splitReasoning(user.swipes[user.current]?.content ?? "").reply : "";
  if (!said || !reply) return;
  const cut = (text: string): string => (d.s.truncate ? text.slice(0, SUMMARY_DEFAULTS.sourceLimit) : text);
  const out = await ask(d, pairPrompt({ template: d.s.prompt?.trim() || PAIR_PROMPT, characterName: d.name, userMessage: cut(said), assistantMessage: cut(reply) }));
  if (out.truncated) throw new SummaryFailure("The per-exchange summary reached the configured Max output tokens. Increase that setting and try again.");
  const line = tidyLine(out.text);
  if (!line) return;
  const existing = take?.text ?? "";
  const text = `${existing ? `${existing.trimEnd()}\n` : ""}Turn ${nextTurn(existing)}: ${line}`;
  await guarded(deps.chats, d.branchId, { text, through: Math.min(all.length, (take?.through ?? 0) + 2), last: landed.id }, take?.at ?? null);
}

/** A reply, a new version or a continue has landed: run the automatic summary when it is due. Never throws; a failure is kept on the scene and the next run clears it. */
export function summarizeAfter(deps: SummaryDeps, chatId: string, kind: TurnKind, landed: Message): void {
  void enqueue(chatId, async () => {
    if (running.has(chatId)) return;
    try {
      const chat = await deps.chats.getChat(chatId);
      const s = resolveSummary(chat?.summary?.settings);
      if (!chat || !automationActive(s)) return;
      const take = await deps.chats.summaryOf(landed.branchId);
      if (s.method === "rolling" && (await deps.chats.countMessages(landed.branchId)) - (take?.through ?? 0) < s.interval) return;
      if (s.method === "pair" && kind === "continue") return;
      if (running.has(chatId)) return;
      running.add(chatId);
      try {
        const d = await setup(deps, chatId);
        await deps.chats.setSummaryError(chatId, null);
        if (s.method === "pair") await pair(deps, d, take, landed);
        else await rolling(deps, d, take);
      } finally {
        running.delete(chatId);
      }
    } catch (e) {
      if (!(e instanceof SummaryFailure) && e instanceof StudioConflictError) return;
      const message = e instanceof SummaryFailure ? e.message : e instanceof Capacity ? "The summary model could not take that much text. Lower the messages per summary or choose a model with a larger window." : "Summary generation failed.";
      await deps.chats.setSummaryError(chatId, message.slice(0, 500)).catch(() => undefined);
    }
  }).catch(() => undefined);
}

/**
 * Summarize now: the automatic step (`rolling`, or `pair` for the last reply) run once on request, under the same `running` guard as the automatic run and Backfill, so two runs never overlap. Unlike the automatic
 * run it says so when nothing was written: no messages, nothing new to add, or an empty answer. The old text stays on any failure; the summary history is the undo.
 */
export async function summarizeNow(deps: SummaryDeps, chatId: string): Promise<TakeSummary> {
  if (running.has(chatId)) throw new SummaryFailure("A summary is already being written for this scene.");
  running.add(chatId);
  try {
    const d = await setup(deps, chatId);
    const take = await deps.chats.summaryOf(d.branchId);
    if (d.s.method === "pair") {
      const last = [...(await deps.chats.readMessages(d.branchId, { limit: WHOLE_BRANCH })).messages].reverse().find((m) => !m.cut && !m.hidden && m.role === "assistant");
      if (!last) throw new SummaryFailure("There are no messages to summarize yet.");
      if (take?.last === last.id) throw new SummaryFailure("The latest exchange is already in the summary.");
      await pair(deps, d, take, last);
    } else {
      if ((await liveMessages(deps.chats, d.branchId)).said.length === 0) throw new SummaryFailure("There are no messages to summarize yet.");
      await rolling(deps, d, take);
    }
    const wrote = await deps.chats.summaryOf(d.branchId);
    if (!wrote || wrote.at === take?.at) throw new SummaryFailure("The summary model returned no text, so nothing was saved.");
    await deps.chats.setSummaryError(chatId, null);
    return wrote;
  } catch (e) {
    if (!(e instanceof SummaryFailure) && e instanceof StudioConflictError) throw new SummaryFailure("The summary changed while it was being written, so the new one was not saved. Try again.");
    if (e instanceof Capacity) throw new SummaryFailure("The summary model could not take that much text. Lower the messages per summary or choose a model with a larger window.");
    throw e;
  } finally {
    running.delete(chatId);
  }
}

/**
 * Backfill history (RoleCall `generateSummary`, scope backfill): the whole take in one call, split in halves when a call does not fit the model or reaches the output budget, the halves
 * combined; Every exchange asks for numbered lines and checks the count. The old summary stays unless the whole run succeeds. Throws a SummaryFailure naming the problem.
 */
export async function backfill(deps: SummaryDeps, chatId: string, signal?: AbortSignal): Promise<TakeSummary> {
  if (running.has(chatId)) throw new SummaryFailure("A summary is already being written for this scene.");
  running.add(chatId);
  try {
    const d = await setup(deps, chatId);
    const take = await deps.chats.summaryOf(d.branchId);
    const { said, total } = await liveMessages(deps.chats, d.branchId);
    if (said.length === 0) throw new SummaryFailure("There are no messages to summarize yet.");
    const mode: BackfillMode = d.s.method === "pair" ? "pair" : d.s.mode;
    const prompt = (history: string, extra: { startTurn?: number; pairCount?: number } = {}): string => backfillPrompt({ mode, characterName: d.name, conversationHistory: history, ...(d.s.prompt ? { customPrompt: d.s.prompt } : {}), ...extra });
    let text: string;
    if (mode === "pair") {
      const exchanges = exchangesOf(said);
      if (exchanges.length === 0) throw new SummaryFailure("No complete user-to-assistant exchanges are available to backfill.");
      const pairs = async (list: Said[][], startTurn: number): Promise<string> => {
        try {
          const out = await ask(d, prompt(lines(list.flat(), d.s), { startTurn, pairCount: list.length }), signal);
          if (out.truncated) {
            if (list.length === 1) throw new SummaryFailure("One exchange exceeded the configured Max output tokens. Increase that setting and try again.");
            return await splitPairs(list, startTurn);
          }
          const bad = checkPairBackfill(out.text, list.length, startTurn);
          if (bad) throw new SummaryFailure(bad);
          return out.text;
        } catch (e) {
          if (!(e instanceof Capacity)) throw e;
          if (list.length === 1) throw new SummaryFailure("One exchange plus Max output tokens is larger than the selected model's context window. Choose a model with more context, lower Max output tokens, or enable source-message truncation.");
          return await splitPairs(list, startTurn);
        }
      };
      const splitPairs = async (list: Said[][], startTurn: number): Promise<string> => {
        const mid = Math.ceil(list.length / 2);
        const left = await pairs(list.slice(0, mid), startTurn);
        const right = await pairs(list.slice(mid), startTurn + mid);
        return `${left.trimEnd()}\n${right.trimStart()}`;
      };
      text = await pairs(exchanges, 1);
    } else {
      const whole = async (list: Said[]): Promise<string> => {
        try {
          const out = await ask(d, prompt(lines(list, d.s)), signal);
          if (!out.text) throw new SummaryFailure("The summary model returned no text.");
          if (out.truncated) {
            if (list.length === 1) throw new SummaryFailure("One message exceeded the configured Max output tokens. Increase that setting and try again.");
            return await halves(list);
          }
          return out.text;
        } catch (e) {
          if (!(e instanceof Capacity)) throw e;
          if (list.length === 1) throw new SummaryFailure("One message plus Max output tokens is larger than the selected model's context window. Choose a model with more context, lower Max output tokens, or enable source-message truncation.");
          return await halves(list);
        }
      };
      const halves = async (list: Said[]): Promise<string> => {
        const mid = Math.ceil(list.length / 2);
        const earlier = await whole(list.slice(0, mid));
        const later = await whole(list.slice(mid));
        try {
          const out = await ask(d, combinePrompt(earlier, later), signal);
          if (!out.text) throw new SummaryFailure("The summary model returned no text while combining partial summaries.");
          if (out.truncated) throw new SummaryFailure("The combined summary exceeded the configured Max output tokens. Increase that setting and try again.");
          return out.text;
        } catch (e) {
          if (e instanceof Capacity) throw new SummaryFailure("The selected model cannot fit two partial summaries and the configured output budget in one call. Choose a model with more context or lower Max output tokens.");
          throw e;
        }
      };
      text = await whole(said);
    }
    try {
      const last = mode === "pair" ? [...(await deps.chats.readMessages(d.branchId, { limit: WHOLE_BRANCH })).messages].reverse().find((m) => !m.cut && m.role === "assistant")?.id : undefined;
      const wrote = await guarded(deps.chats, d.branchId, { text, through: total, ...(last ? { last } : {}) }, take?.at ?? null);
      await deps.chats.setSummaryError(chatId, null);
      return wrote!;
    } catch (e) {
      if (!(e instanceof SummaryFailure) && e instanceof StudioConflictError) throw new SummaryFailure("The summary changed while it was being written, so the new one was not saved. Try again.");
      throw e;
    }
  } finally {
    running.delete(chatId);
  }
}

/** The person's own words (Write summary / Edit, then Save): kept as they are, covering the take as it stands. The last write wins, as it does in RoleCall. */
export async function saveSummaryText(chats: ChatStore, chatId: string, text: string): Promise<TakeSummary> {
  const chat = await chats.getChat(chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  const wrote = await chats.setSummary(chat.activeBranchId, { text, through: await chats.countMessages(chat.activeBranchId) });
  if (!wrote?.summary) throw new StudioNotFoundError("that scene does not exist");
  return wrote.summary;
}

/** What the Memory tab reads: the saved settings, the text and how far it reaches, the take's live message count, the last failure, and whether a run is going. */
export interface SummaryState {
  settings: SummarySettings;
  text: string | null;
  through: number;
  at: number | null;
  total: number;
  error: string | null;
  running: boolean;
}

export async function summaryState(chats: ChatStore, chatId: string): Promise<SummaryState | null> {
  const chat = await chats.getChat(chatId);
  if (!chat) return null;
  const take = await chats.summaryOf(chat.activeBranchId);
  return {
    settings: chat.summary?.settings ?? {},
    text: take?.text ?? null,
    through: take?.through ?? 0,
    at: take?.at ?? null,
    total: await chats.countMessages(chat.activeBranchId),
    error: chat.summary?.error ?? null,
    running: running.has(chatId),
  };
}
