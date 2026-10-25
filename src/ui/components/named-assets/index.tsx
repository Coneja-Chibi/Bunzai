/**
 * NamedAssets - multipurpose named file bag (Risu additional assets).
 * value+onChange; sealed previews via resolveAssetRef when map provided.
 */
import { useCallback, useEffect, useMemo, useRef, type JSX, type KeyboardEvent } from "react";
import {
  extFromNameOrRef,
  kindFromExt,
  kindFromMime,
  newNamedId,
  normalizeNamed,
  resolveAssetRef,
  type AssetFileMap,
  type NamedAsset,
  type NamedAssetsValue,
} from "../../../core/media";
import { SealedMedia } from "../sealed-media";
import { useAsset } from "../../_shared/art-cache";
import { FontPreview } from "../sealed-media/font-preview";
import type { StagedAssetUpload } from "../../app-contract-editor";
import styles from "./styles.module.css";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, useFocusedRangeIndex, useOccurrenceKeys, useVirtualRows, type Range } from "../../_shared/virtual-list";
import { extensionOf } from "../../../core/media/mime";
import { parseUploadedRef } from "../../../entities/piece-parts-blob";

export interface NamedAssetsProps {
  value: NamedAssetsValue;
  onChange(next: NamedAssetsValue): void;
  assetFiles?: AssetFileMap;
  macroHint?: boolean;
  upload?(file: File, signal?: AbortSignal): Promise<StagedAssetUpload>;
  onUploadGrant?(upload: StagedAssetUpload): void;
}

const ACCEPT =
  "image/*,audio/*,video/*,.mp3,.mp4,.webm,.wav,.ogg,.ttf,.otf,.woff,.woff2,.css,.svg,.avif";

const readDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("named-assets: data URL expected"));
    };
    reader.onerror = () => reject(new Error("named-assets: read failed"));
    reader.readAsDataURL(file);
  });

export function NamedAssets({
  value,
  onChange,
  assetFiles,
  macroHint = true,
  upload,
  onUploadGrant,
}: NamedAssetsProps): JSX.Element {
  const bag = useMemo(() => normalizeNamed(value), [value]);
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(bag.items, "named-asset", (item) => item.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadController = useRef<AbortController | null>(null);
  const replaceId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => index, []),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex);
  const virtualizer = useVirtualRows({
    mode: "variable",
    count: bag.items.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => rowKeys[index]!,
    estimateSize: () => 96,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event, virtualizer, bag.items.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };

  const commit = (items: NamedAsset[]): void => onChange(normalizeNamed({ items }));
  useEffect(() => () => uploadController.current?.abort(), []);

  const addFiles = async (files: FileList | null): Promise<void> => {
    if (!files?.length) return;
    const controller = new AbortController();
    uploadController.current?.abort();
    uploadController.current = controller;
    const rid = replaceId.current;
    replaceId.current = null;
    if (rid) {
      const file = files[0]!;
      try {
        const staged = upload ? await upload(file, controller.signal) : null;
        if (controller.signal.aborted) return;
        if (staged) onUploadGrant?.(staged);
        const ref = staged?.asset ?? await readDataUri(file);
        const ext = extensionOf(file.name);
        const mime = staged?.mime ?? file.type;
        const kind = kindFromMime(mime) ?? kindFromExt(ext);
        commit(
          bag.items.map((it) =>
            it.id === rid
              ? { ...it, ref, kind, ext, mime: (staged?.mime ?? file.type) || undefined }
              : it,
          ),
        );
      } catch {
        /* fail closed */
      }
      if (uploadController.current === controller) uploadController.current = null;
      return;
    }
    const added: NamedAsset[] = [];
    for (const file of [...files]) {
      try {
        const staged = upload ? await upload(file, controller.signal) : null;
        if (controller.signal.aborted) break;
        if (staged) onUploadGrant?.(staged);
        const ref = staged?.asset ?? await readDataUri(file);
        const name = file.name.replace(/\.[^.]+$/, "") || "asset";
        const ext = extensionOf(file.name);
        const mime = staged?.mime ?? file.type;
        const kind = kindFromMime(mime) ?? kindFromExt(ext);
        added.push({
          id: newNamedId(),
          name,
          ref,
          kind,
          ...(ext ? { ext } : {}),
          ...(mime ? { mime } : {}),
        });
      } catch {
        /* skip */
      }
    }
    if (added.length && !controller.signal.aborted) commit([...bag.items, ...added]);
    if (uploadController.current === controller) uploadController.current = null;
  };

  return (
    <div>
      {bag.items.length === 0 ? (
        <div className={styles.empty}>
          No named assets. On Risu these feed backdrop macros (image / audio / video / raw).
        </div>
      ) : (
        <div className={styles.assetScroll} ref={scrollRef} onFocus={onFocus} onKeyDown={onListKeyDown}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th>Kind</th>
              <th>Preview</th>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            <tr aria-hidden className={styles.spacer}><td colSpan={4} style={{ padding: 0, border: 0 }}><div style={{ height: virtualizer.getTotalSize() }} /></td></tr>
            {virtualizer.getVirtualItems().map((row) => {
              const it = bag.items[row.index];
              if (!it) return null;
              const src = resolveAssetRef(it.ref, assetFiles);
              return (
                <tr key={rowKeys[row.index]} ref={virtualizer.measureElement} data-index={row.index} data-pick={rowKeys[row.index]} className={styles.virtualRow}
                  style={{ transform: `translateY(${String(row.start)}px)` }}>
                  <td>
                    <span className={styles.kind}>{it.kind}</span>
                  </td>
                  <td>
                    <AssetPreview kind={it.kind} refValue={it.ref} src={src} name={it.name} />
                  </td>
                  <td>
                    <input
                      className={styles.name}
                      value={it.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        commit(
                          bag.items.map((row) =>
                            row.id === it.id
                              ? {
                                  ...row,
                                  name,
                                  ext: extFromNameOrRef(name, row.ref) || row.ext,
                                }
                              : row,
                          ),
                        );
                      }}
                    />
                  </td>
                  <td>
                    <div className={styles.ops}>
                      <button
                        type="button"
                        onClick={() => {
                          replaceId.current = it.id;
                          fileRef.current?.click();
                        }}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={() => commit(bag.items.filter((row) => row.id !== it.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
      <div className={styles.addRow}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPri}`}
          onClick={() => {
            replaceId.current = null;
            fileRef.current?.click();
          }}
        >
          + Add files
        </button>
        <span className={styles.hint}>mp3 mp4 png webp ttf css …</span>
      </div>
      {macroHint ? (
        <div className={styles.macro}>
          Risu macros (read-only)
          <br />
          <code>{"{{image::name}}"}</code>
          <code>{"{{audio::name}}"}</code>
          <code>{"{{video::name}}"}</code>
          <code>{"{{raw::name}}"}</code>
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        className={styles.hidden}
        accept={ACCEPT}
        multiple
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function AssetPreview({ kind, refValue, src, name }: { kind: NamedAsset["kind"]; refValue: string; src: string | null; name: string }): JSX.Element {
  const marker = parseUploadedRef(refValue);
  const external = !!src?.startsWith("http");
  const asset = useAsset(marker ? { sha: marker.sha } : src && !external ? { url: src } : null);
  if (kind === "font" && marker) return <FontPreview sha={marker.sha} name={name} />;
  return <SealedMedia kind={kind} src={external ? src! : asset.src ?? null} name={name} artRef={external ? undefined : asset.ref} />;
}
