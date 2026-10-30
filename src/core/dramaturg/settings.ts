/**
 * The Dramaturg's settings with their defaults (specs/stage/dramaturg.md; ChatStore rule 48), resolved once so no reader invents its own: the scene's
 * own model, no reasoning level, temperature 0.7. On or off is not a setting; it is the `dramaturg` Prop being in the scene's Props.
 */
import type { Chat, ChatConnection, ChatReasoningEffort } from "../../stage/contracts/chat-store";
import type { DramaturgSettings } from "../../stage/contracts/dramaturg-types";

/** The id of the Dramaturg Prop (specs/stage/chat-store.md rule 21); in the scene's Props means on. */
export const DRAMATURG_PROP_ID = "dramaturg";
export const DRAMATURG_DEFAULT_TEMPERATURE = 0.7;
/** The longest question a turn takes. */
export const DRAMATURG_QUESTION_MAX = 8_000;

export interface ResolvedDramaturg {
  /** Absent: the scene's own model. */
  model?: ChatConnection;
  reasoning?: ChatReasoningEffort;
  temperature: number;
}

export const dramaturgOn = (chat: Pick<Chat, "props">): boolean => chat.props?.on.includes(DRAMATURG_PROP_ID) === true;

export const resolveDramaturg = (s: DramaturgSettings): ResolvedDramaturg => ({
  ...(s.model ? { model: s.model } : {}), ...(s.reasoning ? { reasoning: s.reasoning } : {}), temperature: s.temperature ?? DRAMATURG_DEFAULT_TEMPERATURE,
});
