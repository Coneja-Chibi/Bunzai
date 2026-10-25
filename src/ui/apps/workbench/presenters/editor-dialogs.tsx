/**
 * Editor modal dialogs: export, sprite pack, named assets.
 * Extracted from Editor.tsx so the shell stays under the line cap.
 */
import type { JSX } from "react";
import { toErrorMessage } from "../../../../error-message";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { ExportDialog } from "../../../components/export-dialog";
import { SpritePackDialog } from "../../../components/sprite-pack/dialog";
import { NamedAssetsDialog } from "../../../components/named-assets/dialog";
import {
  type NamedAssetsValue,
  type SpritePackValue,
  normalizePack,
} from "../../../../core/media";
import { emptyPackBody } from "../../../../entities/pack/schema";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import { groupsFromLumiOriginal, packFromBodyDraft } from "../media/session";
import { readWorkshopModule } from "../workshop/module";
import type { AssetBatchUpload, AssetTransfer, AssetUpload } from "../../../_shared/asset-upload";
import type { StagedAssetUpload } from "../../../app-contract-editor";
import { buildPiecePatch } from "../../../_shared/editor-patch";
import type { ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import { recOr } from "../../../../core/guards";

export function EditorDialogs({
  exportOpen,
  setExportOpen,
  spritesOpen,
  setSpritesOpen,
  setSpritesFocusLabel,
  spritesFocusLabel,
  namedOpen,
  setNamedOpen,
  ctx,
  piece,
  initEnt,
  exportEntity,
  baseDraft,
  originalDraft,
  name,
  mediaSprites,
  mediaSpriteGroups,
  mediaNamedAssets,
  spritePack,
  namedBag,
  targets,
  packCatalog,
  applyFaceOnly,
  applySpritePack,
  applyNamed,
  uploadNamedAsset,
  uploadAsset,
  uploadBatch,
  stagedUploads,
  discardUploads,
  pinUploads,
  unpinUploads,
  transferAssets,
  acceptUploads,
}: {
  exportOpen: boolean;
  setExportOpen(v: boolean): void;
  spritesOpen: boolean;
  setSpritesOpen(v: boolean): void;
  setSpritesFocusLabel(v: string | null): void;
  spritesFocusLabel: string | null;
  namedOpen: boolean;
  setNamedOpen(v: boolean): void;
  ctx: AppContext;
  piece: StudioEntitySummary;
  initEnt: Record<string, unknown>;
  exportEntity: unknown;
  baseDraft: Record<string, unknown>;
  originalDraft: Record<string, unknown>;
  name: string;
  mediaSprites: boolean;
  mediaSpriteGroups: boolean;
  mediaNamedAssets: boolean;
  spritePack: SpritePackValue;
  namedBag: NamedAssetsValue;
  targets: string[];
  packCatalog: readonly { id: string; name: string }[];
  applyFaceOnly(pack: SpritePackValue, wantLabel?: string | null): void;
  applySpritePack(pack: SpritePackValue, groups?: Record<string, SpritePackValue>): void;
  applyNamed(value: NamedAssetsValue, uploads: import("../../../app-contract-editor").StagedAssetUpload[]): void;
  uploadNamedAsset(file: File, signal?: AbortSignal): Promise<import("../../../app-contract-editor").StagedAssetUpload>;
  uploadAsset: AssetUpload;
  uploadBatch: AssetBatchUpload;
  stagedUploads: StagedAssetUpload[];
  discardUploads(refs: readonly string[]): Promise<void>;
  pinUploads(refs: readonly string[]): void;
  unpinUploads(refs: readonly string[]): void;
  transferAssets: AssetTransfer;
  acceptUploads(refs: readonly string[]): void;
}): JSX.Element {
  return (
    <>
      {exportOpen && (
        <ExportDialog
          ctx={ctx}
          name={name}
          hasPackage={!!readWorkshopModule(originalDraft)}
          entity={{
            ...(exportEntity && typeof exportEntity === "object" ? exportEntity as Record<string, unknown> : initEnt),
            body: baseDraft,
            original: { ...recOr(exportEntity && typeof exportEntity === "object" ? (exportEntity as Record<string, unknown>).original : {}), ...originalDraft },
            kind: piece.kind,
            id: piece.id,
          }}
          onClose={() => setExportOpen(false)}
        />
      )}

      {spritesOpen && mediaSprites && (
        <SpritePackDialog
          characterName={name}
          pack={spritePack}
          groups={groupsFromLumiOriginal(originalDraft)}
          targets={targets}
          showEnabled={mediaSpriteGroups}
          showDefault
          showGroups={mediaSpriteGroups}
          focusLabel={spritesFocusLabel}
          packCatalog={packCatalog}
          onFetchPack={async (key, onReceipt, signal) => {
            const colon = key.indexOf(":");
            const kind = colon > 0 ? key.slice(0, colon) : "character";
            const id = colon > 0 ? key.slice(colon + 1) : key;
            const loaded = await ctx.api.getLightEditableEntity(`kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
            const body = recOr(recOr(loaded.entity).body);
            const source = kind === "pack" ? normalizePack(body.pack) : packFromBodyDraft(body, {});
            const refs = [...new Set(source.items.map((item) => item.ref).filter((ref) => ref.startsWith("\u0000") || ref.startsWith("data:")))];
            const transferred = await transferAssets(refs, signal);
            transferred.receipts.forEach((receipt) => onReceipt?.(receipt));
            return normalizePack({ ...source, items: source.items.map((item) => ({ ...item, ref: transferred.assets[item.ref] ?? item.ref })) });
          }}
          onSaveAsLibraryPack={async (pack, groups, signal) => {
            const stagedAssets = new Set(stagedUploads.map((upload) => upload.asset));
            const refs = [
              ...pack.items.map((item) => item.ref),
              ...Object.values(groups ?? {}).flatMap((group) => group.items.map((item) => item.ref)),
            ];
            if (refs.some((ref) => stagedAssets.has(ref))) {
              ctx.setStatus("Save these media edits to the character before copying the pack to the library.");
              return false;
            }
            const packName = (name || "Character") + " pack";
            const blobRefs = [...new Set(refs.filter((ref) => ref.startsWith("\u0000") || ref.startsWith("data:")))];
            let transfer: { assets: Record<string, string>; receipts: string[] };
            try { transfer = await transferAssets(blobRefs, signal); }
            catch (error) {
              const reason = toErrorMessage(error, "before creation.");
              ctx.setStatus(error instanceof Error ? `Pack copy failed: ${reason}` : `Pack copy failed ${reason}`);
              return false;
            }
            const rewrite = (value: SpritePackValue): SpritePackValue => normalizePack({
              ...value, items: value.items.map((item) => ({ ...item, ref: transfer.assets[item.ref] ?? item.ref })),
            });
            const body = emptyPackBody(packName);
            body.pack = rewrite(pack);
            if (groups && Object.keys(groups).length > 0) body.groups = Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, rewrite(value)]));
            let created: StudioEntitySummary | null = null;
            try {
              if (signal?.aborted) throw new Error("Pack copy canceled before creation.");
              created = await ctx.api.saveEntity({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: packName.toLowerCase().replace(/\s+/g, "-").slice(0, 48) || "pack", body: emptyPackBody(packName) });
              const light = await ctx.api.getLightEditableEntity(`kind=pack&id=${encodeURIComponent(created.id)}`);
              if (signal?.aborted) throw new Error("Pack copy canceled before media was attached.");
              const next = { ...recOr(light.entity), body } as ParsedCanonicalEntity;
              await ctx.api.patchEditedEntity("pack", created.id, light.revision, buildPiecePatch(light.entity as ParsedCanonicalEntity, next), transfer.receipts);
              acceptUploads(transfer.receipts);
              ctx.setStatus(`saved library pack · ${created.name ?? packName}`);
              return true;
            } catch (error) {
              let cleaned = true;
              if (created) {
                try { cleaned = (await ctx.api.deleteEntity("pack", created.id)).deleted; }
                catch { cleaned = false; }
              }
              if (transfer.receipts.length) await discardUploads(transfer.receipts);
              const reason = toErrorMessage(error, "the media could not be attached");
              ctx.setStatus(`Pack copy failed: ${reason}.${cleaned ? " The empty draft was removed." : " An empty draft may remain and needs cleanup."}`);
              return false;
            }
          }}
          onFaceOnly={applyFaceOnly}
          onApply={applySpritePack}
          uploadAsset={uploadAsset}
          uploadBatch={uploadBatch}
          onUploadReceipt={() => undefined}
          discardUploads={discardUploads}
          pinUploads={pinUploads}
          unpinUploads={unpinUploads}
          onClose={() => {
            setSpritesOpen(false);
            setSpritesFocusLabel(null);
          }}
        />
      )}

      {namedOpen && mediaNamedAssets && (
        <NamedAssetsDialog
          characterName={name}
          value={namedBag}
          upload={uploadNamedAsset}
          discardUploads={discardUploads}
          pinUploads={pinUploads}
          unpinUploads={unpinUploads}
          onApply={applyNamed}
          onClose={() => setNamedOpen(false)}
        />
      )}
    </>
  );
}
