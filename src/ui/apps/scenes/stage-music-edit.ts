/**
 * Renaming and removing a Mood Music track are edits to the pack that holds it (a track is a pack item), saved the way the pack
 * editor and the backdrop picker save: one light read, one patch naming the new revision. Nothing about a track lives anywhere
 * else, so there is no second store to keep in step. A removed track's file stays in the library with the pack's earlier versions.
 */
import { patchPackItem, removePackItem } from "../../../entities/pack/operations";
import type { PackBody } from "../../../entities/pack/schema";
import { parseCanonicalEntity } from "../../../entities/runtime-schema";
import type { AppContext } from "../../app-contract";
import { buildPiecePatch } from "../../_shared/editor-patch";

export async function editPack(ctx: AppContext, packId: string, edit: (body: PackBody) => PackBody): Promise<void> {
  const loaded = await ctx.api.getLightEditableEntity(`kind=pack&id=${encodeURIComponent(packId)}`);
  const baseline = parseCanonicalEntity(loaded.entity);
  if (baseline.kind !== "pack") throw new Error("not a pack");
  await ctx.api.patchEditedEntity("pack", packId, loaded.revision, buildPiecePatch(baseline, { ...baseline, body: edit(baseline.body) }), [], "manual");
}

export const renameTrack = (ctx: AppContext, packId: string, itemId: string, title: string): Promise<void> =>
  editPack(ctx, packId, (body) => patchPackItem(body, itemId, { label: title.trim() }));

export const removeTrack = (ctx: AppContext, packId: string, itemId: string): Promise<void> =>
  editPack(ctx, packId, (body) => removePackItem(body, itemId));
