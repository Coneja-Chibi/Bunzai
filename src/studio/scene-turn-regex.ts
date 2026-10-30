/**
 * A scene's prompt regex (RoleCall's `prompt_only` placement, apps/rc lib/ai/prompt-assembly.ts:3496-3522) for the turn loop. The
 * rules are imported data and may only run in the sandbox worker on the page (ADR-009, AGENTS rule 3), so the turn does what the
 * Prompt Inspector does: it holds the request, sends the conversation's messages and the rules to the page, and waits for the page
 * to answer with the changed texts. Nothing here compiles or runs a rule. It fails closed: a worker that cannot run or an answer
 * that does not match what was asked ends the turn before anything is written or sent; a page that never answers holds the turn
 * (there is no timeout) until Stop or until the page leaves, and nothing is sent meanwhile, because
 * a rule may exist to redact. Messages only: preset blocks, notes and lore are not conversation and are never sent for a rewrite.
 */
import { countText } from "../core/tokens";
import { restoreEscapedBraces } from "../core/macros/normalize";
import { promptDepths, sceneRules, type SceneSet } from "../core/regex/scene-pass";
import type { RegexRule, RegexSetBody } from "../entities/regex/schema";
import { isRecord } from "../core/guards";
import type { AssemblyResult } from "../core/assembly/types";
import type { TurnRuntime } from "./scene-turn-runtime";
import type { TurnEvent } from "./scene-turn";

/** The page's answer: the changed text of each message it was asked about, a failure it reports, or Cancel (Stop, or the page leaving). */
export type RegexAnswer = { kind: "done"; texts: Readonly<Record<number, string>> } | { kind: "failed"; error: string } | { kind: "cancel" };

export const answerRegex = (runtime: TurnRuntime, chatId: string, turnId: string, answer: RegexAnswer): boolean => runtime.regex.answer(chatId, turnId, answer);
/** Waits for the page's answer to a regex event this turn emitted. */
export const awaitRegex = (runtime: TurnRuntime, turnId: string, chatId: string, signal: AbortSignal): Promise<RegexAnswer> => runtime.regex.wait(turnId, chatId, signal);

/** The request message at `index` that the rules may rewrite, with its role and depth from the end of the conversation. */
export interface RegexItem { index: number; role: "user" | "assistant"; depth: number; text: string }

const CONVERSATION = new Set(["history", "current", "greeting"]);

export interface PromptRegexInput {
  runtime: TurnRuntime;
  /** The scene's switched-on regex set ids, in order (ChatStore rule 42). */
  setIds: readonly string[] | undefined;
  readRegex: ((id: string) => Promise<RegexSetBody | null>) | undefined;
  /** The assembled request's trace blocks and messages, aligned (assemble.ts: result.messages and result.trace share their order). */
  trace: AssemblyResult["trace"];
  messages: readonly { role: string; content: string }[];
  /** The assembly's macro help (AssemblyResult.expansion). */
  expansion: AssemblyResult["expansion"];
  turnId: string;
  chatId: string;
  signal: AbortSignal;
  emit(event: TurnEvent): void;
}

/** What the turn does next: carry on with these edits (empty when no rule applies), or end now with this event. */
export type PromptRegexOutcome = { edits: Readonly<Record<number, string>>; stop?: undefined } | { stop: TurnEvent; edits?: undefined };

const failed = (message: string): PromptRegexOutcome => ({ stop: { type: "failed", category: "regex_error", code: "regex_unavailable", message, draft: "" } });

export async function promptRegex(input: PromptRegexInput): Promise<PromptRegexOutcome> {
  if (!input.setIds?.length || !input.readRegex) return { edits: {} };
  const read = input.readRegex;
  const sets: SceneSet[] = [];
  for (const id of input.setIds) {
    const body = await read(id).catch(() => null);
    if (body) sets.push({ id, rules: body.rules, enabled: body.enabled !== false });
  }
  const rules: RegexRule[] = sceneRules(sets, "prompt");
  const depths = promptDepths(input.trace.map((b) => ({ role: b.role, chat: CONVERSATION.has(b.source.kind) })));
  const items: RegexItem[] = [];
  depths.forEach((depth, index) => {
    const m = input.messages[index];
    if (depth !== null && m && m.content !== "") items.push({ index, role: m.role as "user" | "assistant", depth, text: m.content });
  });
  if (rules.length === 0 || items.length === 0) return { edits: {} };
  const macroRules = rules.some((r) => r.replace.includes("{{"));
  input.emit({ type: "regex", turnId: input.turnId, rules, items, macros: input.expansion.names });
  const answer = await input.runtime.regex.wait(input.turnId, input.chatId, input.signal);
  if (answer.kind === "cancel") return { stop: { type: "stopped", message: null } };
  if (answer.kind === "failed") return failed(`This scene's regex could not run, so nothing was sent. ${answer.error}`);
  const edits: Record<number, string> = {};
  for (const [key, text] of Object.entries(answer.texts)) {
    const item = items.find((i) => String(i.index) === key);
    if (!item || typeof text !== "string") return failed("This scene's regex answered for a message it was not asked about, so nothing was sent.");
    // RoleCall expands a replacement's macros after the rule and treats what the rule captured as data: the page hid the braces of captured text,
    // so the expansion sees only the authored macros, and every hidden brace comes back.
    if (text !== item.text) edits[item.index] = macroRules ? restoreEscapedBraces(input.expansion.expand(text)) : text;
  }
  return { edits };
}

/** The page's answer parsed once: the shape the route accepts, or null. */
export function regexAnswerOf(b: Record<string, unknown>): RegexAnswer | null {
  if (b["kind"] === "cancel") return { kind: "cancel" };
  if (b["kind"] === "failed") return typeof b["error"] === "string" ? { kind: "failed", error: b["error"].slice(0, 500) } : null;
  if (b["kind"] !== "done" || !isRecord(b["texts"])) return null;
  const texts: Record<number, string> = {};
  for (const [k, v] of Object.entries(b["texts"])) {
    if (!/^[0-9]{1,4}$/.test(k) || typeof v !== "string") return null;
    texts[Number(k)] = v;
  }
  return { kind: "done", texts };
}

/** The result with each rewritten message's block recounted, so the Tokens view and the estimate show what is sent. */
export function recounted(result: AssemblyResult, edits: Readonly<Record<number, string>>): AssemblyResult {
  return Object.keys(edits).length === 0 ? result : { ...result, trace: result.trace.map((b, i) => (edits[i] === undefined ? b : { ...b, tokens: countText(edits[i]!) })) };
}
