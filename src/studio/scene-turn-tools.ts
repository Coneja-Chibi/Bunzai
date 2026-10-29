/**
 * The turn's side of the narrator tool loop. Which tools a reply gets (none unless the scene's
 * Narrator Tool Access is on, the connection takes tools, and the reply is not a Continue), the send itself (the plain send when there
 * are none), and what the stored trace and request keep of the calls: a `tools` section, plus one trace block and one request text per
 * tool answer, so the Tokens sheet and the raw request show what the model was told. Split out of scene-turn.ts for the file-size cap.
 */
import { TOOL_BUDGET_MS_DEFAULT, TOOL_ROUNDS_DEFAULT } from "../core/assembly/tool-rounds";
import { countText } from "../core/tokens";
import { mulberry32 } from "../core/lore/rng";
import type { MacroContext } from "../core/macros";
import type { Chat, JsonObject } from "../stage/contracts/chat-store";
import type { ProviderCompletion, ProviderEvent, ProviderMessage, ProviderRequest } from "../stage/contracts/provider";
import { refusesTools } from "../stage/provider/transport-core";
import { sendWithTools, type NarratorTool, type ToolCallRecord } from "../stage/provider/tool-loop";
import type { Connected } from "./scene-turn";
import type { LoadedTurn, TurnKind } from "./scene-turn-load";
import type { ToolWrites, TurnWrites } from "./scene-turn-writes";

/**
 * What a turn's tools are made from: the scene, what the turn loaded, the turn's seeded randomness (the same seed rolls the same),
 * and the turn's macro context, which the turn fills once the prompt is built (tools are made before then and called after). No tool is handed the
 * turn's write door through it: that goes, as a second argument, to the one tool that writes (library-trackers.ts).
 */
export interface ToolsContext { chat: Chat; loaded: LoadedTurn; rand: () => number; macros: { context?: MacroContext } }
/** The tools a scene's reply may call; the server supplies the real list. `writes` is the turn's scene-state door (scene-turn-writes.ts), for the trackers' tool only. */
export type NarratorToolsFor = (ctx: ToolsContext, writes: ToolWrites) => NarratorTool<never>[] | Promise<NarratorTool<never>[]>;

/** What one turn collects as its tool rounds run; read by the trace, the meter and the fallback rule. */
export interface ToolTurn {
  tools: NarratorTool<never>[];
  /** Filled by the turn with the assembled macro context, before any tool is called. */
  macros: { context?: MacroContext };
  maxRounds: number;
  /** The time all of the reply's tool calls may take (ms): the setting, else the default. */
  budgetMs: number;
  calls: ToolCallRecord[];
  extra: ProviderMessage[];
  rounds: number;
  tokens: { prompt: number; output: number };
}

export async function toolTurn(find: NarratorToolsFor | undefined, kind: TurnKind, chat: Chat, loaded: LoadedTurn, seed: number, writes: TurnWrites, budgetMs: number | undefined): Promise<ToolTurn> {
  const on = chat.prompting?.toolAccess === true && kind !== "continue";
  const macros: { context?: MacroContext } = {};
  return { macros, tools: on && find ? await find({ chat, loaded, rand: mulberry32(seed), macros }, writes) : [], maxRounds: chat.prompting?.toolRounds ?? TOOL_ROUNDS_DEFAULT, budgetMs: budgetMs ?? TOOL_BUDGET_MS_DEFAULT, calls: [], extra: [], rounds: 0, tokens: { prompt: 0, output: 0 } };
}

/** The definitions the Prompt Inspector shows: only when this connection will actually be sent them. */
export const sentTools = (turn: ToolTurn, connected: Connected): { name: string; description: string; parameters: JsonObject }[] =>
  connected.tools === true ? turn.tools.map((t) => ({ name: t.definition.function.name, description: t.definition.function.description, parameters: t.definition.function.parameters as JsonObject })) : [];

/** What a failed send says when the server refused the tools it was sent: never a retry without them, the model named and the way out plain. Null for any other failure. */
export const toolsRefusal = (error: unknown, model: string, turn: ToolTurn, connected: Connected): string | null =>
  connected.tools === true && turn.tools.length > 0 && refusesTools(error) ? `${model} cannot use tools, so turn off this scene's Narrator Tool Access for it, or pick a model that supports tools.` : null;

/** One send of the reply: through the tool loop when the connection takes the turn's tools, else the plain send. */
export async function sendReply(
  connected: Connected,
  request: ProviderRequest,
  io: { signal: AbortSignal; onEvent: (event: ProviderEvent) => void },
  turn: ToolTurn,
  now: () => number,
): Promise<ProviderCompletion> {
  if (connected.tools !== true || turn.tools.length === 0) return connected.provider.send(request, io);
  const done = await sendWithTools(connected.provider, request, io, { tools: turn.tools, maxRounds: turn.maxRounds, toolBudgetMs: turn.budgetMs, now, onCall: (r) => void turn.calls.push(r) });
  turn.extra = done.extra;
  turn.rounds = done.rounds;
  turn.tokens = done.tokens;
  return done.completion;
}

/** The trace and the request texts with this turn's tool calls added; unchanged when there were none. */
export function withToolCalls<T extends { texts: string[] }>(turn: ToolTurn, trace: JsonObject, request: T): { trace: JsonObject; request: T } {
  if (turn.calls.length === 0) return { trace, request };
  const blocks = Array.isArray(trace["blocks"]) ? (trace["blocks"] as JsonObject[]) : [];
  const section: JsonObject = {
    maxRounds: turn.maxRounds,
    rounds: turn.rounds,
    defs: turn.tools.map((t) => t.definition.function.name),
    // Names, arguments, outcomes and counts: never what the tool returned (04b F12).
    calls: turn.calls.map((c) => ({ round: c.round, name: c.name, args: c.args, ok: c.ok, ...(c.error ? { error: c.error } : {}), ms: c.ms, chars: c.text.length, tokens: countText(c.text), ...(c.detail ? { detail: c.detail as JsonObject } : {}) })),
  };
  return {
    trace: { ...trace, blocks: [...blocks, ...turn.calls.map((c): JsonObject => ({ source: { kind: "tool", id: c.name }, role: "tool", tokens: countText(c.text) }))], tools: section },
    request: { ...request, texts: [...request.texts, ...turn.calls.map((c) => c.text)] },
  };
}
