/**
 * Carries a run's setter answers to the open scene. Each setter answers the whole chat as the store then held it, so the
 * last one run wins; the persona setter answers the whole scene (RoleCall's wings do the same); lore and props answer their
 * own shapes and have no chat, so the Booth and the page re-read those.
 */
import type { LoadoutUnit } from "../../../../core/loadout-panels";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";

/** `order` is the order the units were written: the apply order, or its reverse for Undo. */
export function patchScene(scene: OpenScene, patch: Partial<Record<LoadoutUnit, unknown>>, order: readonly LoadoutUnit[]): OpenScene {
  let next = scene;
  for (const unit of order) {
    const answer = patch[unit];
    if (!answer || unit === "lore" || unit === "props") continue;
    next = unit === "persona" ? (answer as OpenScene) : { ...next, chat: answer as Chat };
  }
  return next;
}
