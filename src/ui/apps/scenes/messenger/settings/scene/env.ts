/**
 * What the scene scope's Prompt categories (writing.tsx, memory.tsx) read of the open scene and the one way they leave it: the page's wing arguments (the scene, the app context, the page's
 * way of taking a changed scene back) and the shell's program opener (settings/scopes.tsx `OpenProgram`), for the rows that lead to a whole tool.
 */
import { toErrorMessage } from "../../../../../../error-message";
import type { Chat } from "../../../../../../stage/contracts/chat-store";
import { onChatOf, type WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";

export interface SceneEnv { a: WingArgs; open: OpenProgram }

/** The open scene's chat. */
export const chatOf = (env: SceneEnv): Chat => env.a.scene.chat;

/** A panel's new chat, taken into the page's scene. */
export const takeChat = (env: SceneEnv): ((chat: Chat) => void) => onChatOf(env.a);

/** A failed write is said on the status line, in the words the Full Chat panel uses. */
export const sayFailed = (env: SceneEnv, what: string): ((e: unknown) => void) => (e) => env.a.ctx.setStatus(`${what} could not be saved: ${toErrorMessage(e)}`);

/** A builder takes the environment whole or, as the other scene pages do, the wing arguments and the opener. */
export function sceneEnv(first: SceneEnv | WingArgs, open?: OpenProgram): SceneEnv {
  if (open) return { a: first as WingArgs, open };
  return "open" in first && "a" in first ? first : { a: first as WingArgs, open: () => undefined };
}
