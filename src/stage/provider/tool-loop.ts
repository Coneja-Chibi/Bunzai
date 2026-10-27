/**
 * The narrator's tool loop, at the provider boundary: the writing model may call first-party,
 * read-only tools while it writes. Each round is one `provider.send`; the calls it asks for are run and answered, and the next round
 * carries them. RoleCall's NarratorEngine is the model (narrator-engine.ts:165 rounds, :324-342 the closing text-only call).
 * Differences by design: arguments are parsed once here against the tool's own strict schema and a refusal is told to the model
 * (RoleCall F13: no forced tool choice that 502s, no salvage of calls written as text); the calls echoed to the provider are rebuilt
 * from what was parsed, so a malformed one cannot make the next request invalid; a Stop ends the loop with the signal's reason.
 */
import type { Provider, ProviderCompletion, ProviderEvent, ProviderMessage, ProviderRequest, ProviderToolCall, ProviderToolDefinition } from "../contracts/provider";
import { isRecord } from "../../core/guards";
import { toErrorMessage } from "../../error-message";
import type { ToolAccess } from "../../kit/tools/safety/risk";

export interface ToolOutcome {
  /** What the model is told. */
  text: string;
  /** Plain JSON for the trace and the Activity card; never entry or prompt text. */
  detail?: Record<string, unknown>;
}

/** A first-party tool. `parse` is the one place the model's arguments are read; `run` only ever sees a parsed value. */
export interface NarratorTool<A = unknown> {
  /** The Kit tier (kit/tools/safety/risk.ts). The loop runs read tools only until a write tier is designed. */
  access: ToolAccess;
  definition: ProviderToolDefinition;
  parse(raw: unknown): { args: A } | { error: string };
  run(args: A, signal: AbortSignal | undefined): Promise<ToolOutcome>;
}

export interface ToolCallRecord {
  /** 1-based tool round the call was made in. */
  round: number;
  id: string;
  name: string;
  /** The arguments as the model sent them, capped. */
  args: string;
  ok: boolean;
  error?: string;
  ms: number;
  /** What the model was told. */
  text: string;
  detail?: Record<string, unknown>;
}

export interface ToolLoopConfig {
  tools: readonly NarratorTool<never>[];
  /** Tool rounds allowed; after them one more send asks for the answer (tool choice `none`). */
  maxRounds: number;
  now(): number;
  /** Called once per call, in order, as soon as it is answered. */
  onCall(record: ToolCallRecord): void;
}

export interface ToolLoopResult {
  completion: ProviderCompletion;
  /** The messages the loop added after the request's own: each round's assistant turn and its tool answers. */
  extra: ProviderMessage[];
  rounds: number;
  /** Usage summed over every send, when the provider reported any. */
  tokens: { prompt: number; output: number };
}

/** The names a call may have; any other is answered as INVALID_TOOL. */
export const SAFE_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
export const INVALID_TOOL = "invalid_tool";
const ARGS_CAP = 2_000;
const RESULT_CAP = 12_000;

function refusal(name: string, tools: readonly NarratorTool<never>[], raw: string): { args: unknown } | { error: string } {
  const tool = tools.find((t) => t.definition.function.name === name);
  if (!tool) return { error: `There is no tool named ${name}. Available: ${tools.map((t) => t.definition.function.name).join(", ")}.` };
  let value: unknown;
  try {
    value = JSON.parse(raw.trim() || "{}");
  } catch {
    return { error: "The arguments were not valid JSON." };
  }
  if (!isRecord(value)) return { error: "The arguments must be a JSON object." };
  const parsed = tool.parse(value as never);
  return "error" in parsed ? { error: parsed.error } : { args: parsed.args };
}

export async function sendWithTools(
  provider: Provider,
  request: ProviderRequest,
  io: { signal?: AbortSignal; onEvent?: (event: ProviderEvent) => void },
  config: ToolLoopConfig,
): Promise<ToolLoopResult> {
  const { tools, maxRounds } = config;
  const notRead = tools.find((t) => t.access !== "read");
  if (notRead) throw new Error(`The narrator tool loop runs read-only tools; ${notRead.definition.function.name} is declared ${String(notRead.access)}.`);
  const definitions = tools.map((t) => t.definition);
  const extra: ProviderMessage[] = [];
  const used = new Set<string>();
  const contents: string[] = [];
  const tokens = { prompt: 0, output: 0 };
  let shown = "";
  let rounds = 0;
  let roundStart = 0;

  const forward = (event: ProviderEvent): void => {
    if (event.channel === "reasoning") return io.onEvent?.(event);
    if ("full" in event) {
      // A later round's authoritative text replaces only that round's own, never the rounds before it.
      shown = shown.slice(0, roundStart) + event.full;
      return io.onEvent?.({ channel: "content", full: shown });
    }
    shown += event.delta;
    io.onEvent?.({ channel: "content", delta: event.delta });
  };

  for (;;) {
    const last = rounds >= maxRounds;
    if (rounds > 0 && shown && !/\s$/.test(shown)) forward({ channel: "content", delta: "\n" });
    roundStart = shown.length;
    const options = definitions.length === 0 ? request.options : { ...request.options, tools: definitions, ...(last ? { tool_choice: "none" as const } : {}) };
    const completion = await provider.send({ ...request, messages: [...request.messages, ...extra], options }, { ...(io.signal ? { signal: io.signal } : {}), onEvent: forward });
    tokens.prompt += completion.usage?.promptTotal ?? 0;
    tokens.output += completion.usage?.output ?? 0;
    contents.push(completion.content);
    const asked = last || definitions.length === 0 ? [] : completion.tool_calls ?? [];
    if (asked.length === 0) {
      if (rounds === 0) return { completion, extra, rounds, tokens };
      return { completion: { ...completion, content: (shown || contents.join("\n")).trim() }, extra, rounds, tokens };
    }
    rounds += 1;
    const echoed: ProviderToolCall[] = [];
    const answers: ProviderMessage[] = [];
    for (const [i, raw] of asked.entries()) {
      io.signal?.throwIfAborted();
      const started = config.now();
      const name = SAFE_NAME.test(raw.function.name) ? raw.function.name : INVALID_TOOL;
      let id = raw.id.trim();
      if (!id || used.has(id)) id = `call_${rounds}_${i}`;
      while (used.has(id)) id += "_";
      used.add(id);
      const checked = refusal(name, tools, raw.function.arguments);
      let ok = false;
      let text = "";
      let detail: Record<string, unknown> | undefined;
      let error: string | undefined;
      if ("error" in checked) {
        error = checked.error;
        text = `Error: ${checked.error}`;
      } else {
        try {
          const tool = tools.find((t) => t.definition.function.name === name)!;
          const outcome = await tool.run(checked.args as never, io.signal);
          ok = true;
          text = outcome.text.length > RESULT_CAP ? `${outcome.text.slice(0, RESULT_CAP)}\n[cut: the result was longer than ${RESULT_CAP} characters]` : outcome.text;
          detail = outcome.detail;
        } catch (e) {
          io.signal?.throwIfAborted();
          error = toErrorMessage(e, "the tool failed");
          text = `Error: ${error}`;
        }
      }
      // The echoed call is rebuilt from what was parsed: an object, a safe name and an id no other call has.
      echoed.push({ ...raw, id, function: { name, arguments: "error" in checked ? "{}" : JSON.stringify(checked.args) } });
      answers.push({ role: "tool", tool_call_id: id, name, content: text });
      config.onCall({ round: rounds, id, name, args: raw.function.arguments.slice(0, ARGS_CAP), ok, ...(error ? { error } : {}), ms: config.now() - started, text, ...(detail ? { detail } : {}) });
      io.signal?.throwIfAborted();
    }
    extra.push(
      {
        role: "assistant",
        content: completion.content,
        tool_calls: echoed,
        ...(completion.reasoning ? { reasoning: { text: completion.reasoning, provider: provider.id } } : {}),
        ...(completion.reasoning_details?.length ? { reasoning_details: completion.reasoning_details } : {}),
      },
      ...answers,
    );
  }
}
