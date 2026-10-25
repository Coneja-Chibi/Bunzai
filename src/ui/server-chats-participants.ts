/**
 * The Cast wing's participant routes under /api/chats/participants: read a scene's stored roster,
 * change it (the store checks and refuses a bad change whole), and RECONCILE RECENT SCENE: propose from the newest N messages (one model
 * call per 12,000 characters; stores nothing), apply what the person confirmed as one run, and undo a run. Bodies are parsed once here.
 */
import { str } from "../core/guards";
import type { ChatStore, ParticipantChange } from "../stage/contracts/chat-store";
import { applyParticipants, proposeParticipants, undoParticipantRun, type ParticipantDeps } from "../studio/scene-participants";
import { connect } from "./server-chats-turn";
import { err, json } from "./server-security";

type Body = Record<string, unknown>;

const peopleOf = (raw: unknown): { name: string; description: string | null }[] | null =>
  Array.isArray(raw) && raw.length <= 50 && raw.every((p) => typeof p === "object" && p !== null && typeof (p as Body)["name"] === "string")
    ? raw.map((p) => ({ name: str((p as Body)["name"]), description: typeof (p as Body)["description"] === "string" ? str((p as Body)["description"]) : null }))
    : null;

/** The participants route, or null when the path is not one. */
export async function handleParticipantsRoute(req: Request, url: URL, chats: ChatStore, b: Body | null): Promise<Response | null> {
  const p = url.pathname;
  if (!p.startsWith("/api/chats/participants")) return null;
  if (req.method === "GET") {
    const chat = await chats.getChat(url.searchParams.get("chatId") ?? "");
    return chat ? json({ participants: chat.participants ?? null }) : err("that scene is gone", 404);
  }
  if (!b) return null;
  const deps: ParticipantDeps = { chats, connect, newId: () => crypto.randomUUID() };
  const chatId = str(b["chatId"]);
  if (p === "/api/chats/participants") {
    const chat = await chats.updateParticipants(chatId, b["change"] as ParticipantChange);
    return chat ? json({ participants: chat.participants ?? null }) : err("that scene is gone", 404);
  }
  if (p === "/api/chats/participants/reconcile") return json(await proposeParticipants(deps, chatId, Number(b["count"]), req.signal));
  if (p === "/api/chats/participants/apply") {
    const people = peopleOf(b["people"]);
    if (!people) return err("expected { chatId, people: [{ name, description? }] }");
    const done = await applyParticipants(deps, chatId, people);
    return json({ run: done.run, added: done.added, participants: done.chat.participants ?? null });
  }
  if (p === "/api/chats/participants/undo") return json({ participants: (await undoParticipantRun(deps, chatId, str(b["run"]))).participants ?? null });
  return null;
}
