/**
 * `GET /api/chats/linked?kind=tracker&id=...`: the live scenes that link a library piece (studio/piece-links.ts), as `[{ chatId, title }]`. Read only; a kind
 * a scene does not link (the kind hub says which do) and a missing id are a 400, never an empty list.
 */
import type { ChatStore } from "../stage/contracts/chat-store";
import { StudioValidationError } from "../studio/errors";
import { linkableKinds, scenesLinking } from "../studio/piece-links";
import { json } from "./server-security";

export async function handleLinkedRoute(req: Request, url: URL, chats: ChatStore): Promise<Response | null> {
  if (url.pathname !== "/api/chats/linked" || req.method !== "GET") return null;
  const id = url.searchParams.get("id");
  const found = await scenesLinking(chats, url.searchParams.get("kind") ?? "", id ?? "");
  if (!found) throw new StudioValidationError(`kind must be one of: ${linkableKinds().join(", ")}`);
  if (!id) throw new StudioValidationError("id is required");
  return json(found);
}
