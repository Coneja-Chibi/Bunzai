/** Reject unsupported writes addressed by any scene, message, version or take identity. */
import { str } from "../core/guards";
import type { CoreSceneRecords } from "../stage/store/sqlite/core-record-store";
import { err } from "./server-security";

const ALLOWED = new Set(["start", "send", "turn", "stop", "review", "connection", "search", "rename", "delete", "favorite", "folder", "core-settings"]);
export async function coreWriteGuard(path: string, body: Record<string, unknown>, records?: CoreSceneRecords): Promise<Response | null> {
  if (!records || !path.startsWith("/api/chats/") || ALLOWED.has(path.slice("/api/chats/".length))) return null;
  const ids = [str(body.chatId), str(body.id)];
  const linked = await Promise.all(ids.filter(Boolean).map((id) => records.sceneFor(id)));
  const messages = [str(body.messageId), str(body.id).split(":")[0] ?? ""].filter(Boolean);
  const messageScenes = await Promise.all(messages.map((id) => records.sceneForMessage(id)));
  const branchScenes = await Promise.all([str(body.branchId), str(body.id)].filter(Boolean).map((id) => records.sceneForBranch(id)));
  if (linked.some(Boolean) || messageScenes.some(Boolean) || branchScenes.some(Boolean)) {
    return err("this action is not yet connected to rp-core; export the scene before changing it", 501);
  }
  return null;
}
