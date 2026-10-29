/**
 * The Story Director's one blocking model call (RoleCall `dm/runDM.ts` phase 1 and `runDMRound.ts`): the planning command, forced, through the transport the scene chose. "Tool call" sends it
 * as a native forced tool; "Tagged" asks for a text `<tool_call>` block and reads it with the same reader. Failure is a reason, never an empty success, and never a switch of transport:
 * a connection that takes no tools fails a Tool call scene with that said (RoleCall's fallback to Tagged is unreachable in production, map 13 #7).
 * Retries, in RoleCall's order: a transient refusal (429, 502, 503, 504, 524) is re-sent once on the same transport after 600 to 1,000 ms, always, and that spends nothing else;
 * a reply that is not a usable command gets one corrective pass with the bad reply in context, only while Auto-retry is on (RoleCall's toggle is inert, this one is real).
 * The whole of it, retries included, may take 600 seconds (not 600 per call); the turn's Stop aborts it. Nothing here writes anything.
 */
import { attemptError } from "../core/director/attempt-error";
import { isRecord } from "../core/guards";
import { PLANNING_TOOL, PLANNING_TOOL_NAME, readPlanningRound } from "../core/director/plan-round";
import { splitReasoning } from "../core/reasoning-tags";
import type { DirectorCommandMode, PlanningRound } from "../stage/contracts/director-types";
import { ProviderError, type ProviderCompletion, type ProviderMessage, type ProviderOptions } from "../stage/contracts/provider";
import { refusesTools } from "../stage/provider/transport-core";
import type { Connected } from "./scene-turn";

export const PLANNER_TIMEOUT_MS = 600_000;
export const TRANSIENT_STATUSES: readonly number[] = [429, 502, 503, 504, 524];
const TRANSIENT_BASE_MS = 600;
const TRANSIENT_JITTER_MS = 400;
export const PLANNER_MAX_TOKENS = 16_384;

export type PlannerFailure = "no_connection" | "no_tool_support" | "inference_error" | "undecodable" | "no_tool_calls" | "missing_planning_call" | "missing_directive" | "aborted" | "timeout";

/** RoleCall's words for why the Director did not plan (`DMStreamService.ts:1180-1189`), plus the two reasons only this app has. */
export const FAILURE_COPY: Record<PlannerFailure, string> = {
  no_connection: "Story Director's model is no longer in Kit. Pick another in the Director settings.",
  no_tool_support: "Story Director needs a model with tool calling, and this one does not offer it. Pick another Director model, or switch the command mode to Tagged.",
  inference_error: "Story Director could not reach a working provider.",
  undecodable: "Story Director commands could not be decoded.",
  no_tool_calls: "Story Director returned no planning command.",
  missing_planning_call: "Story Director omitted its required planning command.",
  missing_directive: "Story Director's planning command did not include a narrator directive.",
  aborted: "Story Director was cancelled before planning completed.",
  timeout: "Story Director did not answer in time.",
};

export interface PlannerAttempt { transport: DirectorCommandMode; outcome: "completed" | "errored" | "aborted"; ms: number; error?: string; finish?: string; tokens?: string }
export type PlannerResult = { ok: true; round: PlanningRound; attempts: PlannerAttempt[]; /** Planning calls past the first in the reply that was used; they are ignored. */ extra: number } | { ok: false; reason: PlannerFailure; attempts: PlannerAttempt[]; calls: number };

export interface PlannerRequest {
  connected: Connected;
  model: string;
  system: string;
  user: string;
  /** The momentum pressure message, sent after the user prompt; empty sends none. */
  pressures: string;
  mode: DirectorCommandMode;
  temperature: number;
  reasoning?: ProviderOptions["reasoning_effort"] | undefined;
  autoRetry: boolean;
  signal: AbortSignal;
}
/** `timeoutMs` is the Director's whole budget for a turn, retries included; `mono` is a clock that only moves forward, which the budget is measured on (`now` is the store's, for durations shown). */
export interface PlannerClock { sleep(ms: number): Promise<void>; jitter(): number; timeoutMs: number; now(): number; mono(): number }

const TAGGED_RULES = `## How to answer
You have no native tool interface. Answer with exactly one block and nothing else:
<tool_call>{"name": "${PLANNING_TOOL_NAME}", "arguments": { ... }}</tool_call>
The "arguments" object must follow this JSON schema, and every required field must be present:
${JSON.stringify(PLANNING_TOOL.function.parameters)}`;

type Read = { ok: true; round: PlanningRound; extra: number } | { ok: false; reason: PlannerFailure; said: string; names: string[]; hadCalls: boolean };

/** One reply, read: the tagged block or the native calls, exactly one planning command, its arguments read once. */
function readReply(done: ProviderCompletion, mode: DirectorCommandMode): Read {
  const said = splitReasoning(done.content ?? "").reply;
  let calls: { name: string; args: unknown }[] = [];
  if (mode === "tagged") {
    const blocks = [...said.matchAll(/<tool_call>([\s\S]*?)<\/tool_call>/g)];
    calls = blocks.map((b) => {
      try {
        const parsed: unknown = JSON.parse(b[1]!.trim());
        const args = isRecord(parsed) ? parsed["arguments"] ?? parsed["args"] ?? parsed["parameters"] : undefined;
        return { name: isRecord(parsed) && typeof parsed["name"] === "string" ? parsed["name"] : "", args: typeof args === "string" ? safeParse(args) : args };
      } catch {
        return { name: PLANNING_TOOL_NAME, args: undefined };
      }
    });
  } else {
    calls = (done.tool_calls ?? []).map((c) => ({ name: c.function.name, args: safeParse(c.function.arguments) }));
  }
  const names = calls.map((c) => c.name);
  if (calls.length === 0) return { ok: false, reason: "no_tool_calls", said, names, hadCalls: false };
  // One or more planning calls: the first is the plan, the rest are ignored (RoleCall accepts the round when any call is the command, and the command's own description says a duplicate is discarded).
  const planning = calls.filter((c) => c.name === PLANNING_TOOL_NAME);
  if (planning.length === 0) return { ok: false, reason: "missing_planning_call", said, names, hadCalls: true };
  if (!isRecord(planning[0]!.args)) return { ok: false, reason: "undecodable", said, names, hadCalls: true };
  const read = readPlanningRound(planning[0]!.args);
  return read.ok ? { ok: true, round: read.round, extra: planning.length - 1 } : { ok: false, reason: "missing_directive", said, names, hadCalls: true };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text.trim() || "{}");
  } catch {
    return undefined;
  }
}

const transient = (e: unknown): boolean => e instanceof ProviderError && TRANSIENT_STATUSES.includes(e.status);

export async function planTurn(req: PlannerRequest, clock: PlannerClock): Promise<PlannerResult> {
  const attempts: PlannerAttempt[] = [];
  let calls = 0;
  const deadline = clock.mono() + clock.timeoutMs;
  if (req.mode === "tool-call" && req.connected.tools !== true) return { ok: false, reason: "no_tool_support", attempts, calls };
  const base: ProviderMessage[] = [
    { role: "system", content: req.mode === "tagged" ? `${req.system}\n\n${TAGGED_RULES}` : req.system },
    { role: "user", content: req.user },
    ...(req.pressures.trim() ? [{ role: "user" as const, content: req.pressures }] : []),
  ];
  const options: ProviderOptions = {
    temperature: req.temperature, max_tokens: PLANNER_MAX_TOKENS, stream: false,
    ...(req.mode === "tool-call" ? { tools: [PLANNING_TOOL], tool_choice: { type: "function" as const, function: { name: PLANNING_TOOL_NAME } } } : {}),
    ...(req.reasoning ? { reasoning_effort: req.reasoning, ...(req.reasoning === "none" ? {} : { params: { enable_thinking: true } }) } : {}),
  };

  type Sent = { done: ProviderCompletion } | { fail: PlannerFailure } | { refused: true };
  /** One send: the reply, the reason there is none, or a transient refusal. */
  const send = async (messages: ProviderMessage[]): Promise<Sent> => {
    const started = clock.now();
    const left = deadline - clock.mono();
    if (left <= 0) return { fail: "timeout" };
    const timer = AbortSignal.timeout(left);
    calls++;
    try {
      const done = await req.connected.provider.send({ model: req.model, messages, options }, { signal: AbortSignal.any([req.signal, timer]) });
      attempts.push({ transport: req.mode, outcome: "completed", ms: clock.now() - started, ...(done.finish_reason ? { finish: done.finish_reason } : {}), ...(done.usage ? { tokens: `${done.usage.promptTotal ?? 0}+${done.usage.output ?? 0}` } : {}) });
      return { done };
    } catch (error) {
      const stopped = req.signal.aborted;
      attempts.push({ transport: req.mode, outcome: stopped ? "aborted" : "errored", ms: clock.now() - started, error: attemptError(error) });
      if (stopped) return { fail: "aborted" };
      if (timer.aborted) return { fail: "timeout" };
      if (refusesTools(error)) return { fail: "no_tool_support" };
      return transient(error) ? { refused: true } : { fail: "inference_error" };
    }
  };
  const once = async (messages: ProviderMessage[], resend: boolean): Promise<ProviderCompletion | PlannerFailure> => {
    let out = await send(messages);
    if (resend && "refused" in out) {
      // The provider refused before generating, so nothing was billed and nothing ran: one re-send on the same transport, after a pause that is not the same for everyone.
      await clock.sleep(TRANSIENT_BASE_MS + clock.jitter() * TRANSIENT_JITTER_MS);
      if (req.signal.aborted) return "aborted";
      out = await send(messages);
    }
    return "done" in out ? out.done : "fail" in out ? out.fail : "inference_error";
  };

  const first = await once(base, true);
  if (typeof first === "string") return { ok: false, reason: first, attempts, calls };
  const read = readReply(first, req.mode);
  if (read.ok) return { ok: true, round: read.round, attempts, extra: read.extra };
  if (!req.autoRetry) return { ok: false, reason: read.reason, attempts, calls };

  const echo = read.said.trim().slice(0, 1_200) || (read.names.length > 0 ? `I attempted these commands: ${read.names.join(", ")}.` : "I did not emit a command.");
  const corrective = `That response did not complete the required ${PLANNING_TOOL_NAME} command. ` +
    (req.mode === "tagged" ? `Correct it now: return exactly one <tool_call> block for ${PLANNING_TOOL_NAME} ` : `Correct it now: call ${PLANNING_TOOL_NAME} exactly once through the provided native tool interface `) +
    "with a complete directive and valid arguments. Do not call any other command.";
  const second = await once([...base, { role: "assistant", content: echo }, { role: "user", content: corrective }], false);
  if (typeof second === "string") return { ok: false, reason: second, attempts, calls };
  const again = readReply(second, req.mode);
  return again.ok ? { ok: true, round: again.round, attempts, extra: again.extra } : { ok: false, reason: again.reason, attempts, calls };
}
