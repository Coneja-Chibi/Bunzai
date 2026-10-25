/**
 * `GET /api/chats/variables` (rc-parity 08, the Context wing's State tab; RoleCall reads `chat_variables` and `global_variables` straight from the browser):
 * the active take's macro variables (ChatStore rule 17) and the library's globals, as the stores hold them, sorted by name. A read only. A global document
 * that cannot be read is refused by `readGlobals`, never shown as an empty list.
 */
import type { ChatStore } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import { readGlobals } from "../studio/scene-turn-load";
import { err, json } from "./server-security";
import type { SceneVariable, SceneVariables } from "./app-contract-scenes";

const byKey = (a: SceneVariable, b: SceneVariable): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export async function handleVariablesRoute(url: URL, chats: ChatStore, state: StateStore): Promise<Response> {
  const chat = await chats.getChat(url.searchParams.get("chatId") ?? "");
  if (!chat) return err("that scene is gone", 404);
  const local = await chats.variables(chat.activeBranchId);
  const global = await readGlobals(state);
  const out: SceneVariables = {
    local: Object.entries(local ?? {}).map(([key, v]): SceneVariable => ({ key, value: v.value, createdAt: v.createdAt, updatedAt: v.updatedAt })).sort(byKey),
    global: [...global].map(([key, v]): SceneVariable => ({ key, value: v.value, createdAt: v.createdAt, updatedAt: v.updatedAt })).sort(byKey),
  };
  return json(out);
}
