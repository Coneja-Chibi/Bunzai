/**
 * NamedAssetsDialog - Card assets (Risu multipurpose bag).
 */
import { useRef, useState, type JSX } from "react";
import {
  normalizeNamed,
  type AssetFileMap,
  type NamedAssetsValue,
} from "../../../core/media";
import { InkDialog } from "../ink-dialog";
import type { StagedAssetUpload } from "../../app-contract-editor";
import { DialogFooter, DialogHeader } from "../ink-dialog/chrome";
import { NamedAssets } from "./index";
import styles from "./styles.module.css";

export interface NamedAssetsDialogProps {
  characterName: string;
  value: NamedAssetsValue;
  upload(file: File, signal?: AbortSignal): Promise<StagedAssetUpload>;
  assetFiles?: AssetFileMap;
  onApply(value: NamedAssetsValue, uploads: StagedAssetUpload[]): void;
  discardUploads?(refs: readonly string[]): Promise<void>;
  pinUploads?(refs: readonly string[]): void;
  unpinUploads?(refs: readonly string[]): void;
  onClose(): void;
}

export function NamedAssetsDialog({
  characterName,
  value,
  upload,
  assetFiles,
  onApply,
  discardUploads,
  pinUploads,
  unpinUploads,
  onClose,
}: NamedAssetsDialogProps): JSX.Element {
  const [draft, setDraft] = useState(() => normalizeNamed(value));
  const [uploads, setUploads] = useState<StagedAssetUpload[]>([]);
  const applied = useRef(false);
  const closed = useRef(false);
  const close = (): void => {
    if (closed.current) return;
    closed.current = true;
    unpinUploads?.(uploads.map((upload) => upload.ref));
    if (!applied.current) void discardUploads?.(uploads.map((upload) => upload.ref));
    onClose();
  };
  const stageForDialog = async (file: File, signal?: AbortSignal): Promise<StagedAssetUpload> => {
    const grant = await upload(file, signal);
    if (closed.current) {
      await discardUploads?.([grant.ref]);
      throw new Error("dialog closed while staging");
    }
    return grant;
  };

  return (
    <InkDialog onDismiss={close} ariaLabel="Card assets" sheetClassName={styles.sheet}>
      <DialogHeader title={`Card assets · ${characterName || "Character"}`} onClose={close} />
      <NamedAssets value={draft} onChange={setDraft} assetFiles={assetFiles} upload={stageForDialog} onUploadGrant={(item) => {
        pinUploads?.([item.ref]);
        setUploads((current) => current.some((old) => old.ref === item.ref) ? current : [...current, item]);
      }} />
      <DialogFooter onCancel={close} onApply={() => { applied.current = true; onApply(normalizeNamed(draft), uploads); close(); }} />
    </InkDialog>
  );
}
