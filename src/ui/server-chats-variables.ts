/**
 * `GET /api/chats/variables` (rc-parity 08, the Context wing's State tab; RoleCall reads `chat_variables` and `global_variables` straight from the browser):
 * the active take's macro variables (the `vars` slot of its scene state, ChatStore rule 17) and the library's globals (folded from the operations of every
 * version shown in a live take, core/scene-state/globals.ts), sorted by name. A read only.
 */
import type { ChatStore } from "../stage/contracts/chat-store";
import { varsOf } from "../core/scene-state/vars-bridge";
import { readGlobals } from "../studio/scene-turn-load";
import { err, json } from "./server-security";
import type { SceneVariable, SceneVariables } from "./app-contract-scenes";

const byKey = (a: SceneVariable, b: SceneVariable): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export async function handleVariablesRoute(url: URL, chats: ChatStore): Promise<Response> {
  const chat = await chats.getChat(url.searchParams.get("chatId") ?? "");
  if (!chat) return err("that scene is gone", 404);
  const local = varsOf(await chats.sceneState(chat.activeBranchId));
  const global = await readGlobals(chats);
  const out: SceneVariables = {
    local: [...local].map(([key, v]): SceneVariable => ({ key, value: v.value, createdAt: v.createdAt, updatedAt: v.updatedAt })).sort(byKey),
    global: [...global].map(([key, v]): SceneVariable => ({ key, value: v.value, createdAt: v.createdAt, updatedAt: v.updatedAt })).sort(byKey),
  };
  return json(out);
}
