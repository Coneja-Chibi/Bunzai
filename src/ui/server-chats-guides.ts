/**
 * The Prompting wing's routes: the guide library (list, save, delete; studio/guides.ts) and a scene's
 * switched-on guides and scene note (ChatStore rule 37). A guide is checked once at the boundary
 * (core/guide-record.ts); the scene's patch is checked by the store. The scene's regex sets (rule 42) and trackers (rule 43) ride here too.
 */
import { str } from "../core/guards";
import { randomUUID } from "node:crypto";
import type { ChatPromptingPatch, ChatRegexPatch, ChatStore, ChatTrackerPatch, TrackerModule } from "../stage/contracts/chat-store";
import type { StateStore } from "../stage/contracts/state-store";
import { deleteGuide, listGuides, saveGuide } from "../studio/guides";
import { err, json } from "./server-security";

type Body = Record<string, unknown>;

/** The guide and prompting routes, or null when the path is not one of them. */
export async function handleGuideRoute(req: Request, p: string, chats: ChatStore, state: StateStore, b: Body | null): Promise<Response | null> {
  if (req.method === "GET") return p === "/api/chats/guides" ? json(await listGuides(state)) : null;
  if (!b) return null;
  if (p === "/api/chats/guides/save") return json(await saveGuide(state, b["guide"], Date.now(), randomUUID));
  if (p === "/api/chats/guides/delete") return json({ deleted: await deleteGuide(state, str(b["id"]), Date.now()) });
  if (p === "/api/chats/prompting") {
    const chat = await chats.setPrompting(str(b["chatId"]), b["prompting"] as ChatPromptingPatch);
    return chat ? json(chat) : err("that scene is gone", 404);
  }
  if (p === "/api/chats/regex") {
    const chat = await chats.setRegex(str(b["chatId"]), b["regex"] as ChatRegexPatch);
    return chat ? json(chat) : err("that scene is gone", 404);
  }
  if (p === "/api/chats/trackers") {
    const chat = await chats.setTracker(str(b["chatId"]), b["module"] as TrackerModule, b["patch"] as ChatTrackerPatch);
    return chat ? json(chat) : err("that scene is gone", 404);
  }
  return null;
}
