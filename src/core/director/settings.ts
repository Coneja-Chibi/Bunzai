/**
 * The Director's settings with their defaults (ChatStore rule 47, plan 15 decision 10), resolved once so no reader invents its own: Sage, Tool call, temperature 0.7, Auto-retry on,
 * creativity moderate. On or off is not a setting; it is the `story-director` Prop being in the scene's Props.
 */
import { DIRECTOR_CALLS_DEFAULT, DIRECTOR_EVERY_DEFAULT } from "../../stage/contracts/director-types";
import type { Chat, ChatConnection, ChatReasoningEffort, DirectorCommandMode, DirectorCreativity, DirectorPersonality } from "../../stage/contracts/chat-store";

/** The id of the Story Director Prop; in the scene's Props means on. */
export const DIRECTOR_PROP_ID = "story-director";
export const DIRECTOR_DEFAULT_TEMPERATURE = 0.7;

export interface ResolvedDirector {
  personality: DirectorPersonality;
  commandMode: DirectorCommandMode;
  temperature: number;
  autoRetry: boolean;
  creativity: DirectorCreativity;
  instructions: string;
  autoUpdate: boolean;
  every: number;
  callsPerReply: number;
  model?: ChatConnection;
  reasoning?: ChatReasoningEffort;
}

export const directorOn = (chat: Pick<Chat, "props">): boolean => chat.props?.on.includes(DIRECTOR_PROP_ID) === true;

export function resolveDirector(chat: Pick<Chat, "director">): ResolvedDirector {
  const d = chat.director ?? {};
  return {
    personality: d.personality ?? "the-balanced", commandMode: d.commandMode ?? "tool-call", temperature: d.temperature ?? DIRECTOR_DEFAULT_TEMPERATURE, autoRetry: d.autoRetry ?? true,
    creativity: d.creativity ?? "moderate", instructions: d.instructions ?? "", autoUpdate: d.autoUpdate ?? true, every: d.every ?? DIRECTOR_EVERY_DEFAULT, callsPerReply: d.callsPerReply ?? DIRECTOR_CALLS_DEFAULT, ...(d.model ? { model: d.model } : {}), ...(d.reasoning ? { reasoning: d.reasoning } : {}),
  };
}
