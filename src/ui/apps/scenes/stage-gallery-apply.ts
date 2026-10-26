/**
 * "Use as background" for a Gallery picture (Question 7 of rc-parity/07-stage.md). A pack picture already is a pack item, so the scene's
 * backdrop just points at it (ChatStore rule 36, `ChatBackdrop` stays `{pack,item}`). Cast art is not in any pack, so it is copied into the
 * pack the scene already uses (else the library's first): a held picture is adopted without moving bytes (/api/asset/adopt), inline or
 * frozen-portrait bytes are uploaded, both through the backdrop picker's own `addToPack`. A picture the pack already holds is reused, and
 * a copy that fails sets no backdrop. The scene's overlay darkness carries over; a video speed does not, since the picture changed.
 */
import { base64ToBytes } from "../../../core/base64";
import { mimeFromDataUri } from "../../../core/media";
import { parseUploadedRef } from "../../../entities/piece-parts-blob";
import type { Chat, ChatBackdrop } from "../../../stage/contracts/chat-store";
import type { AppContext } from "../../app-contract";
import { artCache } from "../../_shared/art-cache";
import { toErrorMessage } from "../../_shared/error-message";
import { addToPack } from "./scene-backdrop-add";
import { backdropPack, type BackdropPack } from "./scene-backdrop-core";
import { downloadName, existingPackItem, portraitIdentity, type GalleryItem } from "./stage-gallery-core";

/** The picture's bytes as a file, for art no uploaded ref names: inline data, or the scene's frozen portrait route. */
async function fileOf(item: GalleryItem): Promise<File> {
  const ref = item.ref ?? "";
  if (ref.startsWith("data:")) {
    const mime = mimeFromDataUri(ref) ?? "image/png";
    return new File([base64ToBytes(ref.slice(ref.indexOf(",") + 1)) as BlobPart], downloadName(item.label, mime), { type: mime });
  }
  const blob = await artCache.getBlob(item.url ?? "", item.url ? portraitIdentity(item.url) : undefined);
  return new File([blob], downloadName(item.label, blob.type || "image/png"), { type: blob.type || "image/png" });
}

async function loadPack(ctx: AppContext, id: string): Promise<BackdropPack> {
  const pack = backdropPack((await ctx.api.getLightEditableEntity(`kind=pack&id=${encodeURIComponent(id)}`)).entity);
  if (!pack) throw new Error("That pack could not be read.");
  return pack;
}

export async function applyAsBackdrop(ctx: AppContext, chat: Chat, item: GalleryItem): Promise<Chat> {
  const { dim, blur } = chat.backdrop ?? {};
  const backdrop = (pack: string, picked: string): ChatBackdrop => ({ pack, item: picked, ...(dim === undefined ? {} : { dim }), ...(blur === undefined ? {} : { blur }) });
  if (item.pack) return ctx.api.setSceneBackdrop(chat.id, backdrop(item.pack.pack, item.pack.item));
  const packId = chat.backdrop?.pack ?? (await ctx.api.listEntities("pack"))[0]?.id;
  if (!packId) throw new Error("Make a pack in the Library first, then come back to use this as a background.");
  const before = await loadPack(ctx, packId);
  const held = item.ref ? existingPackItem(before, item.ref) : null;
  if (held) return ctx.api.setSceneBackdrop(chat.id, backdrop(packId, held.id));
  const result = await addToPack(ctx, packId, [{
    name: item.label,
    stage: async () => item.ref && parseUploadedRef(item.ref) ? ctx.api.adoptAssets([item.ref]).then((grants) => grants[0]!) : ctx.api.uploadAsset(await fileOf(item)),
  }]);
  const known = new Set(before.items.map((i) => i.id));
  const added = result.added > 0 ? (await loadPack(ctx, packId).catch((e: unknown) => { throw new Error(`Could not add this to your pack: ${toErrorMessage(e)}`); })).items.find((i) => !known.has(i.id)) : undefined;
  if (!added) throw new Error("Could not add this to your pack, so the backdrop is unchanged.");
  return ctx.api.setSceneBackdrop(chat.id, backdrop(packId, added.id));
}
