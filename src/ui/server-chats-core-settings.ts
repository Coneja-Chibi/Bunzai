/** Persist rp-core feature switches for the linked, active scene take. */
import { str } from "../core/guards";
import type { ChatStore } from "../stage/contracts/chat-store";
import type { CoreSceneRecords } from "../stage/store/sqlite/core-record-store";
import { exportScene } from "../studio/scene-export";
import { readCoreSceneState } from "../studio/core-inspect";
import { setCoreSceneFeature } from "../studio/core-inspect";
import { err, json } from "./server-security";

export async function handleCoreSettings(
  body: Record<string, unknown>, chats: ChatStore, records: CoreSceneRecords | undefined, home: string,
): Promise<Response> {
  const chatId = str(body["chatId"]);
  const feature = body["feature"];
  const enabled = body["enabled"];
  if (!chatId || (feature !== "director" && feature !== "memory") || typeof enabled !== "boolean") return err("expected chatId, feature and enabled", 400);
  const linked = records ? await records.sceneFor(chatId) : null;
  if (!records || !linked) return err("this scene does not use rp-core", 404);
  if ((await chats.getChat(chatId))?.activeBranchId !== linked.branchId) return err("this take is not connected to rp-core yet", 409);
  try { return json(await setCoreSceneFeature(records, home, linked.sessionId, feature, enabled)); }
  catch (error) { if (error instanceof Error && /rp-core session locked/.test(error.message)) return err("wait for the current turn to finish", 409); throw error; }
}


export async function handleCoreRead(url: URL, chats: ChatStore, records: CoreSceneRecords | undefined, home: string): Promise<Response | null> {
  if (url.pathname === "/api/chats/export") return (await exportScene(chats, url.searchParams.get("id") ?? "")) ?? err("that scene is gone", 404);
  if (url.pathname !== "/api/chats/core-state") return null;
  const linked = records ? await records.sceneFor(url.searchParams.get("chatId") ?? "") : null;
  if (!records || !linked) return err("this scene does not use rp-core", 404);
  const offset = Number(url.searchParams.get("offset") ?? "0");
  if (!Number.isSafeInteger(offset) || offset < 0) return err("invalid memory page", 400);
  return json(await readCoreSceneState(records, home, linked.sessionId, offset));
}
