/**
 * RoleCall's Fallback Model setting (FallbackModelControl.tsx): which model answers when the scene's own
 * model fails. A per-user studio pref (RoleCall keeps it per account, not per chat). The Booth's Narrator
 * Model row writes it (booth-fallback-row.tsx); use-scene-turn.ts sends it with each turn and scene-turn.ts
 * honours it. Bunzai has no helper model or house default, so RoleCall's Auto mode has no meaning here;
 * the stored choices are off (fail visibly, the default) and a custom connection.
 */
import type { ChatConnection } from "../../../stage/contracts/chat-store";
import { isRecord, str } from "../../../core/guards";

export const FALLBACK_KEY = "scenes.fallbackModel";

export type FallbackModel = { mode: "off" } | { mode: "custom"; connection: ChatConnection };

/** Reads the pref fail-closed: anything unreadable, or a custom choice without a whole connection, is off. */
export function readFallback(raw: unknown): FallbackModel {
  if (!isRecord(raw) || raw["mode"] !== "custom" || !isRecord(raw["connection"])) return { mode: "off" };
  const id = str(raw["connection"]["id"]);
  const model = str(raw["connection"]["model"]);
  return id && model ? { mode: "custom", connection: { id, model } } : { mode: "off" };
}
