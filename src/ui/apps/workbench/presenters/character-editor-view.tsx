/** Character editor's shell composition: chrome, active presenter, and media/export dialogs. */
import type { CSSProperties, JSX, ReactNode } from "react";
import type { AppContext, CoverageInfo, StudioEntitySummary } from "../../../app-contract";
import type { Stub } from "../../../components/native-card";
import { StubEditor } from "../../../components/native-card";
import type { SpritePackValue, NamedAssetsValue } from "../../../../core/media";
import { useAccentVars } from "../../../_shared/use-scoped-accents";
import { EditorChrome } from "./editor-chrome";
import { EditorDialogs } from "./editor-dialogs";
import { buildEditorBodyViews } from "./editor-body-views";
import { useCharacterPreferences } from "../use-character-preferences";
import { str } from "../editor-derive";
import { useSurfaceVariant } from "../../../_shared/surface-variant";
import styles from "../editor-styles";

type Preferences = ReturnType<typeof useCharacterPreferences>;
type BodyViews = ReturnType<typeof buildEditorBodyViews>;

export function CharacterEditorView({
  ctx, piece, topRight, prefs, bodyViews, coverage, platformLabel, chips,
  nativeStub, setNativeStub, workshop, setWorkshop, saving, dirty, doSave, openExport, version,
  exportOpen, setExportOpen, exportEntity, spritesOpen, setSpritesOpen, spritesFocusLabel,
  setSpritesFocusLabel, namedOpen, setNamedOpen, baseDraft, originalDraft, name,
  mediaCaps, spritePack, namedBag, targets, packCatalog, applyFaceOnly, applySpritePack,
  applyNamed, uploadNamedAsset, uploadAsset, uploadBatch, stagedUploads, discardUploads, pinUploads, unpinUploads, transferAssets, acceptUploads, initEnt,
}: {
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
  prefs: Preferences;
  bodyViews: BodyViews;
  coverage: CoverageInfo[];
  platformLabel(id: string): string;
  chips: readonly (readonly [string, boolean])[];
  nativeStub: Stub | null;
  setNativeStub(value: Stub | null): void;
  workshop: boolean;
  setWorkshop(value: boolean): void;
  saving: boolean;
  dirty: boolean;
  doSave(): Promise<boolean>;
  openExport(): void;
  exportOpen: boolean;
  setExportOpen(value: boolean): void;
  exportEntity: unknown;
  spritesOpen: boolean;
  setSpritesOpen(value: boolean): void;
  spritesFocusLabel: string | null;
  setSpritesFocusLabel(value: string | null): void;
  namedOpen: boolean;
  setNamedOpen(value: boolean): void;
  baseDraft: Record<string, unknown>;
  originalDraft: Record<string, unknown>;
  name: string;
  version: string;
  initEnt: Record<string, unknown>;
  mediaCaps: { sprites: boolean; spriteGroups: boolean; namedAssets: boolean };
  spritePack: SpritePackValue;
  namedBag: NamedAssetsValue;
  targets: string[];
  packCatalog: readonly { id: string; name: string }[];
  applyFaceOnly(pack: SpritePackValue, wantLabel?: string | null): void;
  applySpritePack(pack: SpritePackValue, groups?: Record<string, SpritePackValue>): void;
  applyNamed(value: NamedAssetsValue, uploads: import("../../../app-contract-editor").StagedAssetUpload[]): void;
  uploadNamedAsset(file: File, signal?: AbortSignal): Promise<import("../../../app-contract-editor").StagedAssetUpload>;
  uploadAsset: import("../../../_shared/asset-upload").AssetUpload;
  uploadBatch: import("../../../_shared/asset-upload").AssetBatchUpload;
  stagedUploads: import("../../../app-contract-editor").StagedAssetUpload[];
  discardUploads(refs: readonly string[]): Promise<void>;
  pinUploads(refs: readonly string[]): void;
  unpinUploads(refs: readonly string[]): void;
  transferAssets: import("../../../_shared/asset-upload").AssetTransfer;
  acceptUploads(refs: readonly string[]): void;
}): JSX.Element {
  const { editorScale, stepScale, setEditorScale, scaleMin, scaleMax, mode, setMode, editorLayout, setEditorLayout } = prefs;
  const { lensActive, lensVisibleCount, lensTotalCount, flowView, bentoView, playbillView, framedView, workshopView, hasBehavior, entityAccent } = bodyViews;
  const accentVars = useAccentVars();
  const themedFrame = useSurfaceVariant("editor.frame") !== "core";
  const rootStyle: CSSProperties = { ...(accentVars(entityAccent) ?? {}), ...(editorScale !== 1 ? { zoom: editorScale } : {}) };
  return (
    <div className={styles.root} style={rootStyle}>
      {nativeStub && <StubEditor title={nativeStub.title} note={nativeStub.note} onClose={() => setNativeStub(null)}>{nativeStub.view}</StubEditor>}
      <EditorChrome coverage={coverage} targets={targets} platformLabel={platformLabel} toggleTarget={prefs.toggleTarget}
        clearTargets={prefs.clearTargets} offTarget={prefs.offTarget} pickOffTarget={prefs.pickOffTarget}
        lensActive={lensActive} lensVisibleCount={lensVisibleCount} lensTotalCount={lensTotalCount}
        chips={chips} name={name} version={version}
        onClose={() => ctx.workbench.remove(piece.id, piece.kind)} editorScale={editorScale} stepScale={stepScale}
        setEditorScale={setEditorScale} scaleMin={scaleMin} scaleMax={scaleMax}
        mode={mode} setMode={setMode} editorLayout={editorLayout} setEditorLayout={setEditorLayout} layoutLocked={themedFrame}
        hasBehavior={hasBehavior} workshop={workshop} setWorkshop={setWorkshop} saving={saving} dirty={dirty}
        doSave={doSave} openExport={openExport} topRight={topRight} styles={styles} />
      {workshop && hasBehavior ? workshopView : mode === "grid" ? (themedFrame ? framedView : editorLayout === "playbill" ? playbillView : bentoView) : flowView}
      <EditorDialogs exportOpen={exportOpen} setExportOpen={setExportOpen} spritesOpen={spritesOpen}
        setSpritesOpen={setSpritesOpen} setSpritesFocusLabel={setSpritesFocusLabel} spritesFocusLabel={spritesFocusLabel}
        namedOpen={namedOpen} setNamedOpen={setNamedOpen} ctx={ctx} piece={piece} initEnt={initEnt}
        exportEntity={exportEntity} baseDraft={baseDraft} originalDraft={originalDraft} name={name}
        mediaSprites={mediaCaps.sprites} mediaSpriteGroups={mediaCaps.spriteGroups} mediaNamedAssets={mediaCaps.namedAssets}
        spritePack={spritePack} namedBag={namedBag} targets={targets} packCatalog={packCatalog}
        applyFaceOnly={applyFaceOnly} applySpritePack={applySpritePack} applyNamed={applyNamed}
        uploadNamedAsset={uploadNamedAsset} uploadAsset={uploadAsset} uploadBatch={uploadBatch}
        stagedUploads={stagedUploads} discardUploads={discardUploads} pinUploads={pinUploads} unpinUploads={unpinUploads}
        transferAssets={transferAssets} acceptUploads={acceptUploads} />
    </div>
  );
}
