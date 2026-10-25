/**
 * SpritePack - visual emotion / expression pack editor (label -> image).
 * Platform-agnostic value+onChange. Bridges live outside this leaf.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type JSX, type KeyboardEvent } from "react";
import {
  labelFromFilename,
  newPackItemId,
  normalizeLabel,
  normalizePack,
  reorderPackItems,
  type ExpressionProfile,
  type SpritePackItem,
  type SpritePackValue,
} from "../../../core/media";
import { ToggleSwitch } from "../toggle-switch";
import type { AssetBatchUpload, AssetUpload } from "../../_shared/asset-upload";
import styles from "./styles.module.css";
import { importSpriteZip } from "./zip-import";
import { readSpriteImage } from "./upload-image";
import { profileGhostSlots, SpritePreview } from "./presentation";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, rowsOf, useFocusedRangeIndex, useGridColumns, useOccurrenceKeys, useVirtualRows, type Range } from "../../_shared/virtual-list";

export type { SpritePackItem, SpritePackValue };
export interface SpritePackProps {
  value: SpritePackValue;
  onChange(next: SpritePackValue): void;
  showEnabled?: boolean;
  showDefault?: boolean;
  allowMultiFile?: boolean;
  /** Soft checklist ghosts from host profile */
  profile?: ExpressionProfile;
  showSlots?: boolean;
  /** Scroll/highlight this label when the dialog opens from the strip */
  focusLabel?: string | null;
  /** Session-staged media for an owning editor; standalone read-only utilities retain data URIs. */
  uploadAsset?: AssetUpload;
  uploadBatch?: AssetBatchUpload;
  discardUploads?(receipts: readonly string[]): Promise<void>;
  onUploadReceipt?(receipt: string): void;
}

export function SpritePack({
  value,
  onChange,
  showEnabled = false,
  showDefault = true,
  allowMultiFile = true,
  profile,
  showSlots = false,
  focusLabel = null,
  uploadAsset,
  uploadBatch,
  discardUploads,
  onUploadReceipt,
}: SpritePackProps): JSX.Element {
  const pack = useMemo(() => normalizePack(value), [value]);
  const latestPack = useRef(pack);
  latestPack.current = pack;
  const fileRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const zipAbort = useRef<AbortController | null>(null);
  const zipBusy = useRef(false);
  const pickerAbort = useRef<AbortController | null>(null);
  const replaceIdRef = useRef<string | null>(null);
  const slotLabelRef = useRef<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragFocusKey, setDragFocusKey] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [zipImporting, setZipImporting] = useState(false);
  const focusDone = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { zipAbort.current?.abort(); pickerAbort.current?.abort(); }, []);
  const { cols, gapPx, rowRef } = useGridColumns();
  const rows = rowsOf(pack.items, cols);
  const { keys: rowKeys, indexOf: rowIndex } = useOccurrenceKeys(pack.items, "sprite-slot", (item) => item.id, undefined, (item) => item.label);
  const flatIndex = useCallback((target: HTMLElement) => {
    const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
    return key ? rowIndex(key) : -1;
  }, [rowIndex]);
  const { focusedIndex, onFocus, onBlur } = useFocusedRangeIndex(flatIndex, useCallback((index: number) => Math.floor(index / Math.max(1, cols)), [cols]),
    useCallback((index: number) => rowKeys[index], [rowKeys]), rowIndex, { restoreReparentedFocus: true });
  const dragFlatIndex = dragFocusKey === null ? -1 : rowIndex(dragFocusKey);
  const dragIndex = dragFlatIndex < 0 ? -1 : Math.floor(dragFlatIndex / Math.max(1, cols));
  const virtualizer = useVirtualRows({
    mode: "grid",
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 150,
    gap: gapPx,
    rangeExtractor: useCallback((range: Range) => {
      const indexes = keepFocusedInRange(range, focusedIndex);
      return dragIndex < 0 || dragIndex >= range.count || indexes.includes(dragIndex) ? indexes : [...indexes, dragIndex].sort((a, b) => a - b);
    }, [focusedIndex, dragIndex]),
    initialRect: FALLBACK_VIEWPORT,
  });
  const visibleRows = virtualizer.getVirtualItems();
  const firstVisible = visibleRows[0]?.index;

  const commit = (next: SpritePackValue): void => { latestPack.current = normalizePack(next); onChange(latestPack.current); };
  const setItems = (items: SpritePackItem[], base = latestPack.current): void => commit({ ...base, items });

  // New focus target (e.g. strip double-click) always re-scrolls.
  useEffect(() => {
    focusDone.current = false;
  }, [focusLabel]);

  useEffect(() => {
    if (!focusLabel || focusDone.current) return;
    const index = pack.items.findIndex((item) => normalizeLabel(item.label) === normalizeLabel(focusLabel));
    if (index >= 0) {
      virtualizer.scrollToIndex(Math.floor(index / Math.max(1, cols)), { align: "auto" });
      focusDone.current = true;
    }
  }, [focusLabel, pack.items, cols, virtualizer]);

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const index = flatIndex(document.activeElement as HTMLElement);
    if (index >= 0) bridgeTabAcrossVirtualBoundary(event,
      { scrollToIndex: (i, options) => virtualizer.scrollToIndex(Math.floor(i / Math.max(1, cols)), options) },
      pack.items.length, index, event.currentTarget, (i) => rowKeys[i]!);
  };

  /** Drop face `fromId` onto face `toId` (stable order via core). */
  const reorder = (fromId: string, toId: string): void => {
    if (fromId === toId) return;
    const ids = pack.items.map((i) => i.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    commit(reorderPackItems(pack, next));
  };

  const addFiles = async (files: FileList | File[] | null): Promise<void> => {
    if (!files || files.length === 0) return;
    const all = [...files];
    const zips = all.filter(
      (f) =>
        f.name.toLowerCase().endsWith(".zip") ||
        f.type === "application/zip" ||
        f.type === "application/x-zip-compressed",
    );
    if (zips.length && zipBusy.current) { setUploadNote("A ZIP batch is already importing; wait for it to finish."); return; }
    const zipController = new AbortController();
    if (zips.length) { zipBusy.current = true; zipAbort.current = zipController; setZipImporting(true); }
    try {
    for (const z of zips) {
      if (zipController.signal.aborted) return;
      try {
        const result = await importSpriteZip(z, normalizePack({ items: [] }), uploadAsset, uploadBatch, zipController.signal, onUploadReceipt, discardUploads);
        if (zipController.signal.aborted) return;
        if (result.note) setUploadNote(result.note);
        if (result.pack) { const current = latestPack.current; setUploadNote(null); commit({ ...current, items: [...current.items, ...result.pack.items], defaultLabel: current.defaultLabel ?? result.pack.defaultLabel }); }
      } catch {
        setUploadNote("ZIP import failed or was canceled; no files were added.");
        if (zipController.signal.aborted) return;
      }
    }
    } finally { if (zips.length) { zipBusy.current = false; zipAbort.current = null; setZipImporting(false); } }
    const list = all.filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    const replaceId = replaceIdRef.current;
    replaceIdRef.current = null;
    const slotLabel = slotLabelRef.current;
    slotLabelRef.current = null;

    if (replaceId) {
      const file = list[0]!;
      const controller = new AbortController();
      pickerAbort.current?.abort(); pickerAbort.current = controller;
      try {
        const { ref, mime } = await readSpriteImage(file, uploadAsset, controller.signal, onUploadReceipt);
        if (controller.signal.aborted) return;
        const zipDraft = latestPack.current;
        setItems(
          zipDraft.items.map((it) =>
            it.id === replaceId
              ? { ...it, ref, ...(mime ? { mime } : {}) }
              : it,
          ), zipDraft,
        );
      } catch {
        /* fail closed */
      } finally {
        if (pickerAbort.current === controller) pickerAbort.current = null;
      }
      return;
    }

    if (slotLabel && list[0]) {
      const file = list[0];
      const controller = new AbortController();
      pickerAbort.current?.abort(); pickerAbort.current = controller;
      try {
        const { ref, mime } = await readSpriteImage(file, uploadAsset, controller.signal, onUploadReceipt);
        if (controller.signal.aborted) return;
        const zipDraft = latestPack.current;
        const existing = zipDraft.items.find(
          (it) => normalizeLabel(it.label) === normalizeLabel(slotLabel),
        );
        if (existing) {
          setItems(
            zipDraft.items.map((it) =>
              it.id === existing.id ? { ...it, ref, ...(mime ? { mime } : {}) } : it,
            ), zipDraft,
          );
        } else {
          const item: SpritePackItem = {
            id: newPackItemId(),
            label: slotLabel,
            ref,
            ...(mime ? { mime } : {}),
          };
          commit({
            ...zipDraft,
            items: [...zipDraft.items, item],
            defaultLabel: zipDraft.defaultLabel ?? slotLabel,
          });
        }
      } catch {
        /* fail closed */
      } finally {
        if (pickerAbort.current === controller) pickerAbort.current = null;
      }
      return;
    }

    const added: SpritePackItem[] = [];
    const controller = new AbortController();
    pickerAbort.current?.abort(); pickerAbort.current = controller;
    for (const file of list) {
      try {
        const { ref, mime } = await readSpriteImage(file, uploadAsset, controller.signal, onUploadReceipt);
        if (controller.signal.aborted) return;
        const label = labelFromFilename(file.name);
        const item: SpritePackItem = { id: newPackItemId(), label, ref };
        if (mime) item.mime = mime;
        added.push(item);
      } catch {
        /* skip bad file */
      }
    }
    if (pickerAbort.current === controller) pickerAbort.current = null;
    if (added.length === 0) return;
    const batch = allowMultiFile ? added : added.slice(0, 1);
    const zipDraft = latestPack.current;
    commit({
      ...zipDraft,
      items: [...zipDraft.items, ...batch],
      defaultLabel: zipDraft.defaultLabel ?? batch[0]?.label,
    });
  };

  const onDropAdd = (e: DragEvent): void => {
    e.preventDefault();
    void addFiles(e.dataTransfer.files);
  };

  const coreSlots = profileGhostSlots(pack, profile, showSlots);

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        {showEnabled ? (
          <ToggleSwitch
            on={pack.enabled !== false}
            onChange={(on) => commit({ ...pack, enabled: on })}
            label={pack.enabled === false ? "Pack off" : "Pack on"}
          />
        ) : null}
        {showDefault && pack.items.length > 0 ? (
          <>
            <span className={styles.lbl}>Default</span>
            <span className={styles.meta}>{pack.defaultLabel ?? "(auto)"}</span>
            <button type="button" className={styles.toolBtn} disabled={!pack.defaultLabel}
              onClick={() => commit({ ...pack, defaultLabel: undefined })}>auto</button>
          </>
        ) : null}
        {profile ? (
          <span className={styles.meta}>
            {profile.label} · {pack.items.length}/{profile.slots.length || "?"}
          </span>
        ) : (
          <span className={styles.meta}>
            {pack.items.length} {pack.items.length === 1 ? "face" : "faces"}
          </span>
        )}
      </div>

      {showSlots && coreSlots.length > 0 ? (
        <div className={styles.grid} style={{ marginBottom: "0.65rem" }}>
          {coreSlots.map((slot) => {
            const hit = pack.items.find(
              (it) => normalizeLabel(it.label) === normalizeLabel(slot),
            );
            if (hit) return null;
            return (
              <button
                key={`ghost-${slot}`}
                type="button"
                className={styles.add}
                style={{ minHeight: "5rem", borderStyle: "dashed" }}
                title={`Add ${slot}`}
                onClick={() => {
                  slotLabelRef.current = slot;
                  fileRef.current?.click();
                }}
              >
                <span>+ {slot}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <p className={styles.hint} style={{ marginTop: 0, marginBottom: "0.35rem" }}>
        Drag faces to reorder. Double-click a strip thumb to jump here.
      </p>

      <div className={styles.gridViewport} ref={scrollRef} onFocus={onFocus} onBlur={onBlur} onKeyDown={onListKeyDown}>
        <div className={styles.gridSpace} style={{ height: virtualizer.getTotalSize() }}>
          {visibleRows.map((virtualRow) => (
            <div key={virtualRow.index} ref={(el) => { virtualizer.measureElement(el); if (virtualRow.index === firstVisible) rowRef(el); }}
              data-index={virtualRow.index} className={`${styles.grid} ${styles.gridRow}`} style={{ transform: `translateY(${String(virtualRow.start)}px)` }}>
        {(rows[virtualRow.index] ?? []).map((it, cellIndex) => {
          const flat = virtualRow.index * Math.max(1, cols) + cellIndex;
          const isDef =
            pack.defaultLabel !== undefined &&
            normalizeLabel(pack.defaultLabel) === normalizeLabel(it.label);
          const focused =
            focusLabel !== null &&
            focusLabel !== undefined &&
            normalizeLabel(focusLabel) === normalizeLabel(it.label);
          const over = dragOverId === it.id;
          return (
            <div
              key={rowKeys[flat]}
              data-pick={rowKeys[flat]}
              id={`sp-slot-${flat}`}
              className={`${styles.slot}${focused ? ` ${styles.slotFocus}` : ""}${over ? ` ${styles.slotDrag}` : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverId(it.id);
              }}
              onDragLeave={() => {
                setDragOverId((cur) => (cur === it.id ? null : cur));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIdRef.current;
                setDragOverId(null);
                if (from) reorder(from, it.id);
                dragIdRef.current = null;
                setDragFocusKey(null);
              }}
            >
              <div
                className={styles.preview}
                title="Drag to reorder"
                draggable
                onDragStart={() => {
                  dragIdRef.current = it.id;
                  setDragFocusKey(rowKeys[flat]!);
                }}
                onDragEnd={() => {
                  dragIdRef.current = null;
                  setDragFocusKey(null);
                  setDragOverId(null);
                }}
              >
                {it.ref ? (
                  <SpritePreview refValue={it.ref} alt={it.label} />
                ) : (
                  <span className={styles.ph}>?</span>
                )}
                {isDef ? <span className={styles.def}>Def</span> : null}
                {focused ? <span className={styles.focus}>Focus</span> : null}
              </div>
              <input
                className={styles.name}
                value={it.label}
                aria-label="Expression label"
                onChange={(e) => {
                  const label = e.target.value;
                  setItems(
                    pack.items.map((row) => (row.id === it.id ? { ...row, label } : row)),
                  );
                }}
              />
              <div className={styles.ops}>
                <button
                  type="button"
                  title="Set as default"
                  onClick={() => commit({ ...pack, defaultLabel: it.label })}
                >
                  Default
                </button>
                <button
                  type="button"
                  title="Replace image"
                  onClick={() => {
                    replaceIdRef.current = it.id;
                    fileRef.current?.click();
                  }}
                >
                  Replace
                </button>
                <button
                  type="button"
                  title="Remove"
                  onClick={() => {
                    const items = pack.items.filter((row) => row.id !== it.id);
                    const next: SpritePackValue = { ...pack, items };
                    if (
                      pack.defaultLabel &&
                      normalizeLabel(pack.defaultLabel) === normalizeLabel(it.label)
                    ) {
                      next.defaultLabel = items[0]?.label;
                    }
                    commit(next);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.grid}>
        <button
          type="button"
          className={styles.add}
          onClick={() => {
            replaceIdRef.current = null;
            slotLabelRef.current = null;
            fileRef.current?.click();
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropAdd}
        >
          <span>+ Add</span>
          <span>drop images</span>
        </button>
        {zipImporting ? <button type="button" className={styles.toolBtn} onClick={() => zipAbort.current?.abort()}>Cancel ZIP</button> : null}
        <button
          type="button"
          className={styles.add}
          onClick={() => zipRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropAdd}
        >
          <span>ZIP</span>
          <span>import pack</span>
        </button>
      </div>

      <p className={styles.hint}>
        Label from filename. ZIP of images works. Same pack exports per host via Press.
      </p>
      {uploadNote && <p className={styles.hint} role="status">{uploadNote}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple={allowMultiFile}
        className={styles.hidden}
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={zipRef}
        type="file"
        accept=".zip,application/zip"
        className={styles.hidden}
        onChange={(e) => {
          void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
