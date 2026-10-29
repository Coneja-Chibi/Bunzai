/**
 * The Pipeline layer's writes: switch a block on or off, or move one, as a single preset patch built
 * from the preset editor's own helpers. Same write rules as links (link-write.ts): fresh read, no write
 * over unsaved Desk edits, conflict says so and does not retry.
 */
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import type { PresetBody } from "../../../../entities/preset";
import type { ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import { addMarker, bulkSetEnabled, patchBlock, reorderBlock } from "../preset/session";
import { buildOrder, type FeatureMarkerSlot } from "../../../../core/preset";
import { writePiece, type LinkResult } from "./link-write";
import { reorderChangesBuild } from "./pipeline";

/** `set` carries the state the person saw switched to, and `move` the build order they saw, so a
 * preset that changed underneath is never edited against what was on screen. */
export type BlockEdit =
  | { t: "set"; id: string; enabled: boolean }
  | { t: "move"; from: string; to: string; seen: readonly string[] }
  /** a feature's marker onto a block (added there when the preset has none), or taken out so the feature keeps its own spot */
  | { t: "place"; slot: FeatureMarkerSlot; to: string; seen: readonly string[] }
  | { t: "unplace"; slot: FeatureMarkerSlot; seen: readonly string[] };

const REFUSED_MOVE = "Build order follows placement, then Order, so that move would change nothing. Change them in the Desk.";

const STALE = "The blocks changed since they were drawn, so nothing was moved. The latest blocks are shown.";
const GONE = "That block is no longer in the preset. The latest blocks are shown.";
/** A refusal when the preset no longer matches what was drawn (its build order, and the target block), else null. */
const drift = (body: PresetBody, seen: readonly string[], to: string): string | null =>
  buildOrder(body).map((p) => p.id).join("\u0000") !== seen.join("\u0000") ? STALE
  : body.prompts.some((p) => p.id === to) ? null : GONE;

/** The body after the edit, null when it already holds, or a sentence saying why it is refused (nothing is sent then). */
function apply(body: PresetBody, edit: BlockEdit): PresetBody | string | null {
  if (edit.t === "place" || edit.t === "unplace") return applyPlace(body, edit);
  const block = body.prompts.find((p) => p.id === (edit.t === "set" ? edit.id : edit.from));
  if (!block) return GONE;
  if (edit.t === "set") return block.enabled === edit.enabled ? null : bulkSetEnabled(body, new Set([edit.id]), edit.enabled);
  const refused = drift(body, edit.seen, edit.to);
  if (refused) return refused;
  const next = reorderBlock(body, edit.from, edit.to);
  return reorderChangesBuild(body, next) ? next : REFUSED_MOVE;
}

/** The slot's marker to edit: the one the assembler fills (the first switched-on one in the preset's order, core/assembly/preset.ts), else the first switched off. */
const markerOf = (body: PresetBody, slot: FeatureMarkerSlot) => {
  const all = body.prompts.filter((p) => p.marker && p.markerSlot === slot);
  return all.find((p) => p.enabled) ?? all[0];
};

/**
 * Place: the marker takes the list place of the block it was dropped on (reorderBlock, as a block drag does) and that
 * block's placement, depth and order, so it is built there, and is switched on. Own spot switches the marker off rather
 * than deleting it, so what was set on it in the Desk is kept for the next place.
 */
function applyPlace(body: PresetBody, edit: Extract<BlockEdit, { t: "place" | "unplace" }>): PresetBody | string | null {
  const marker = markerOf(body, edit.slot);
  const refused = drift(body, edit.seen, edit.t === "place" ? edit.to : marker?.id ?? "");
  if (edit.t === "unplace") {
    if (!marker?.enabled) return null;
    return refused ?? bulkSetEnabled(body, new Set([marker.id]), false);
  }
  if (refused) return refused;
  if (marker?.id === edit.to && marker.enabled) return null;
  const target = body.prompts.find((p) => p.id === edit.to)!;
  const at = { placement: target.placement, injectionDepth: target.injectionDepth, injectionOrder: target.injectionOrder };
  const withMarker = marker ? body : addMarker(body, edit.slot);
  const id = marker?.id ?? markerOf(withMarker, edit.slot)!.id;
  const placed = patchBlock(withMarker, id, { ...at, enabled: true });
  const next = id === edit.to ? placed : reorderBlock(placed, id, edit.to);
  const same = marker !== undefined && marker.enabled && marker.placement === at.placement && marker.injectionDepth === at.injectionDepth && marker.injectionOrder === at.injectionOrder;
  return same && !reorderChangesBuild(body, next) ? REFUSED_MOVE : next;
}

const SAVED: Record<Exclude<BlockEdit["t"], "set">, (name: string) => string> = {
  move: (name) => `moved a block in ${name}`,
  place: (name) => `placed a marker in ${name}`,
  unplace: (name) => `switched a marker off in ${name}`,
};

export async function writePreset(ctx: AppContext, preset: StudioEntitySummary, edit: BlockEdit): Promise<LinkResult> {
  const verb = edit.t === "set" ? "switch a block in" : edit.t === "move" ? "move a block in" : edit.t === "place" ? "place a marker in" : "switch a marker off in";
  let refused: string | null = null;
  const result = await writePiece(
    ctx,
    preset,
    {
      saved: edit.t === "set" ? `switched a block ${edit.enabled ? "on" : "off"} in ${preset.name}` : SAVED[edit.t](preset.name),
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
