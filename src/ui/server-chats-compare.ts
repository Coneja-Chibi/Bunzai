/** `GET /api/chats/compare-takes?chatId&a&b`: two takes of one scene read side by side (studio/scene-take-compare.ts). Read only. */
import { str } from "../core/guards";
import type { ChatStore } from "../stage/contracts/chat-store";
import { compareTakes } from "../studio/scene-take-compare";
import { json } from "./server-security";

export async function handleCompareRoute(req: Request, url: URL, chats: ChatStore): Promise<Response | null> {
  if (req.method !== "GET" || url.pathname !== "/api/chats/compare-takes") return null;
  const q = url.searchParams;
  return json(await compareTakes(chats, { chatId: str(q.get("chatId")), a: str(q.get("a")), b: str(q.get("b")) }));
}
