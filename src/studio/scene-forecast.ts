/**
 * The Next send forecast (rc-parity 08, slice 5; RoleCall's `PromptPreviewPanel` over `api/chat/preview-prompt`): the request the scene would send if the person sent this
 * message now. It is the reply turn's own build (scene-turn-build.ts: prepare, assemble, shape) run over the loaded scene with the draft as the message being answered, so
 * it cannot drift from a send the way RoleCall's second assembly path does. It writes nothing (no checkpoint, no variable, no meter lesson), asks no model, and says what it leaves
 * out: the Compendium's recall is a model call that only a real send makes, and a scene's prompt regex runs in the page's sandbox worker during a send.
 */
import { resolveCompendium } from "../core/compendium/defaults";
import { countPrompt, countText, estimateFor } from "../core/tokens";
import type { ProviderRole } from "../stage/contracts/provider";
import type { StateStore } from "../stage/contracts/state-store";
import { StudioConflictError } from "./atomic-file";
import { StudioNotFoundError } from "./errors";
import { NoConnectionError, type TurnDeps } from "./scene-turn";
import { assembleRequest, overflowMessage, prepareRequest, shapeRequest } from "./scene-turn-build";
import { sentTools, toolTurn } from "./scene-turn-tools";
import { turnWrites } from "./scene-turn-writes";
import { loadTurn, type TurnReader } from "./scene-turn-load";

export interface ForecastDeps extends Pick<TurnDeps, "connect" | "readPreset" | "readLorebook" | "readCastMember" | "choiceDefaults" | "readTracker" | "promptBudgetMs" | "clock" | "narratorTools" | "toolBudgetMs" | "now" | "randomSeed"> {
  chats: TurnReader;
  state: Pick<StateStore, "read">;
}

export interface Forecast {
  /** The request as the provider would get it, each message with the assembler's own count. */
  messages: { role: ProviderRole; content: string; tokens: number }[];
  /** The turn's own estimate for the whole request: the number the Prompt Inspector's pause shows as "about N tokens". */
  tokens: number;
  window: { context: number; reply: number; stated: boolean };
  model: string;
  /** What a send adds that a forecast does not run. */
  notes: string[];
}

export async function forecastRequest(deps: ForecastDeps, input: { chatId: string; draft: string }): Promise<Forecast> {
  const chat = await deps.chats.getChat(input.chatId);
  if (!chat) throw new StudioNotFoundError("that scene does not exist");
  if (!chat.connection) throw new NoConnectionError();
  const connected = await deps.connect(chat.connection);
  if (!connected) throw new NoConnectionError("this scene's connection is gone from Kit; pick another in the AI wing");
  const model = chat.connection.model;
  const read = await loadTurn(deps.chats, chat.id, "draft", deps.readPreset, deps.readLorebook, deps.readCastMember, deps.choiceDefaults, deps.readTracker);
  if (!read) throw new StudioNotFoundError("that scene does not exist");
  // The take so far is the history and the draft is the message being answered, as it will be once sent.
  const loaded = { ...read, current: { id: "forecast", role: "user" as const, content: input.draft, at: deps.now() } };
  const started = deps.now();
  const prep = await prepareRequest(deps, chat, loaded, connected, model, started);
  // The tool definitions a send would carry are reserved by the budget the same way (the tools are made, never called).
  const tools = await toolTurn(deps.narratorTools, "reply", chat, loaded, deps.randomSeed(), turnWrites(deps.now), await deps.toolBudgetMs?.());
  const built = await assembleRequest(deps, { chat, loaded, prep, started, kind: "reply", original: "", guidance: "", reserved: sentTools(tools, connected).map((t) => JSON.stringify(t)) });
  if (built.result.budget.overflow) throw new StudioConflictError(overflowMessage(built.result));
  const sent = shapeRequest({ chat, loaded, kind: "reply", original: "", built, connected }, model, {});
  const trace = built.result.trace;
  const messages = sent.map((m, i) => ({ role: m.role, content: m.content, tokens: i < trace.length && built.asked[i]?.content === m.content ? trace[i]!.tokens : countText(m.content) }));
  const compendium = resolveCompendium(chat.compendium);
  const notes = [
    ...(compendium.on && compendium.recall.on ? ["The Compendium's recall is not run for a forecast; its entries are added when you send."] : []),
    ...((chat.regex?.sets?.length ?? 0) > 0 ? ["Prompt regex runs when you send; this forecast shows the request before it."] : []),
  ];
  return {
    messages,
    tokens: estimateFor(prep.meter, prep.key, countPrompt(sent.map((m) => m.content)), started).mid,
    window: { context: prep.window.context, reply: prep.window.reply, stated: prep.window.stated },
    model,
    notes,
  };
}
