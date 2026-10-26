/**
 * The Pipeline layer's writes: switch a block on or off, or move one, as a single preset patch built
 * from the preset editor's own helpers. Same write rules as links (link-write.ts): fresh read, no write
 * over unsaved Desk edits, conflict says so and does not retry.
 */
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { PresetBody } from "../../../../entities/preset";
import type { ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import { bulkSetEnabled, reorderBlock } from "../preset/session";
import { buildOrder } from "../../../../core/preset";
import { writePiece, type LinkResult } from "./link-write";
import { reorderChangesBuild } from "./pipeline";

/** `set` carries the state the person saw switched to, and `move` the build order they saw, so a
 * preset that changed underneath is never edited against what was on screen. */
export type BlockEdit = { t: "set"; id: string; enabled: boolean } | { t: "move"; from: string; to: string; seen: readonly string[] };

const REFUSED_MOVE = "Build order follows placement, then Order, so that move would change nothing. Change them in the Desk.";

const STALE = "The blocks changed since they were drawn, so nothing was moved. The latest blocks are shown.";

/** The body after the edit, null when it already holds, or a sentence saying why it is refused (nothing is sent then). */
function apply(body: PresetBody, edit: BlockEdit): PresetBody | string | null {
  const block = body.prompts.find((p) => p.id === (edit.t === "set" ? edit.id : edit.from));
  if (!block) return "That block is no longer in the preset. The latest blocks are shown.";
  if (edit.t === "set") return block.enabled === edit.enabled ? null : bulkSetEnabled(body, new Set([edit.id]), edit.enabled);
  if (buildOrder(body).map((p) => p.id).join("\u0000") !== edit.seen.join("\u0000")) return STALE;
  if (!body.prompts.some((p) => p.id === edit.to)) return "That block is no longer in the preset. The latest blocks are shown.";
  const next = reorderBlock(body, edit.from, edit.to);
  return reorderChangesBuild(body, next) ? next : REFUSED_MOVE;
}

export async function writePreset(ctx: AppContext, preset: StudioEntitySummary, edit: BlockEdit): Promise<LinkResult> {
  const verb = edit.t === "set" ? "switch a block in" : "move a block in";
  let refused: string | null = null;
  const result = await writePiece(
    ctx,
    preset,
    {
      saved: edit.t === "set" ? `switched a block ${edit.enabled ? "on" : "off"} in ${preset.name}` : `moved a block in ${preset.name}`,
      conflict: `${preset.name} changed somewhere else first, so nothing was changed. The latest blocks are shown.`,
      failed: verb,
    },
    (entity) => {
      if (entity.kind !== "preset") return null;
      const next = apply(entity.body, edit);
      if (next === null) return null;
      if (typeof next === "string") { refused = next; return null; }
      return { ...entity, body: next } as ParsedCanonicalEntity;
    },
  );
  if (refused) ctx.setStatus(refused);
  return result;
}
