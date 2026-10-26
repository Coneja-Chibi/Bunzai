/**
 * SpritePackDialog - sealed stage, soft slots, optional Lumi groups, pack grid, health.
 * Also: cross-card pack attach, face-only thin export, sprite-sheet slice.
 * Sheet helpers live in sheet-slice.ts; attach/sheet panels in dialog-panels.tsx.
 */
import { Button, Tabs } from "../button";
import { useMemo, useRef, useState, type JSX } from "react";
import { toErrorMessage } from "../../../error-message";
import {
  emptyPack,
  newPackItemId,
  normalizePack,
  packHealth,
  profileById,
  profileForTargets,
  SHEET_MAX_CELLS,
  ST_GOEMOTIONS,
  type SpritePackValue,
} from "../../../core/media";
import { InkDialog } from "../ink-dialog";
import { DialogFooter, DialogHeader } from "../ink-dialog/chrome";
import { ExpressionStage } from "../expression-stage";
import { SpritePack } from "./index";
import { AttachPanel, SheetSlicePanel } from "./dialog-panels";
import { readFileAsDataUri, sliceSheetToItems } from "./sheet-slice";
import { bytesToBase64 } from "../../../core/base64";
import type { AssetBatchUpload, AssetUpload } from "../../_shared/asset-upload";
import styles from "./styles.module.css";

export type PackCatalogEntry = {
  id: string;
  name: string;
};

export interface SpritePackDialogProps {
  characterName: string;
  pack: SpritePackValue;
  /** Lumi multi-char packs: name -> pack. Flat pack is primary when empty. */
  groups?: Record<string, SpritePackValue>;
  targets?: readonly string[];
  showEnabled?: boolean;
  showDefault?: boolean;
  showGroups?: boolean;
  /** Opened from strip double-click: scroll/highlight this face */
  focusLabel?: string | null;
  /** Other cards in the studio that may have packs */
  packCatalog?: readonly PackCatalogEntry[];
  /** Load pack from another character id (fail closed -> null) */
  onFetchPack?(id: string, onReceipt?: (receipt: string) => void, signal?: AbortSignal): Promise<SpritePackValue | null>;
  /**
   * Promote default (or focus) face to portrait and clear emotion pack.
   * Parent applies to body + twins.
   */
  onFaceOnly?(pack: SpritePackValue, wantLabel?: string | null): void;
  /** Save this pack as a reusable library pack entity */
  onSaveAsLibraryPack?(
    pack: SpritePackValue,
    groups?: Record<string, SpritePackValue>,
    signal?: AbortSignal,
  ): boolean | Promise<boolean>;
  onApply(pack: SpritePackValue, groups?: Record<string, SpritePackValue>): void;
  uploadAsset?: AssetUpload;
  uploadBatch?: AssetBatchUpload;
  onUploadReceipt?(receipt: string): void;
  discardUploads?(receipts: readonly string[]): Promise<void>;
  pinUploads?(receipts: readonly string[]): void;
  unpinUploads?(receipts: readonly string[]): void;
  onClose(): void;
}

const FLAT = "__flat__";

export function SpritePackDialog({
  characterName,
  pack,
  groups: initialGroups = {},
  targets = [],
  showEnabled = false,
  showDefault = true,
  showGroups = false,
  focusLabel = null,
  packCatalog = [],
  onFetchPack,
  onFaceOnly,
  onSaveAsLibraryPack,
  onApply,
  uploadAsset,
  uploadBatch,
  onUploadReceipt,
  discardUploads,
  pinUploads,
  unpinUploads,
  onClose,
}: SpritePackDialogProps): JSX.Element {
  const [groups, setGroups] = useState<Record<string, SpritePackValue>>(() => {
    const g: Record<string, SpritePackValue> = {};
    for (const [k, v] of Object.entries(initialGroups)) g[k] = normalizePack(v);
    return g;
  });
  const [activeGroup, setActiveGroup] = useState<string>(() => {
    const keys = Object.keys(initialGroups);
    return keys[0] ?? FLAT;
  });
  const [flat, setFlat] = useState<SpritePackValue>(() => normalizePack(pack));
  const activeGroupRef = useRef(activeGroup);
  activeGroupRef.current = activeGroup;
  const [expandSlots, setExpandSlots] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  /** in-flight guard: the save is a network round-trip, so double-clicking wrote the pack twice */
  const [saving, setSaving] = useState(false);
  const uploadReceipts = useRef(new Set<string>());
  const applied = useRef(false);
  const closed = useRef(false);
  const saveAbort = useRef<AbortController | null>(null);
  const attachAbort = useRef<AbortController | null>(null);
  const [attachId, setAttachId] = useState<string>("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [sheetCols, setSheetCols] = useState(4);
  const [sheetRows, setSheetRows] = useState(2);
  const sheetRef = useRef<HTMLInputElement>(null);
  const close = (): void => {
    if (closed.current) return;
    closed.current = true;
    saveAbort.current?.abort();
    attachAbort.current?.abort();
    unpinUploads?.([...uploadReceipts.current]);
    if (!applied.current) void discardUploads?.([...uploadReceipts.current]);
    onClose();
  };
  const trackReceipt = (receipt: string): void => {
    if (closed.current) { void discardUploads?.([receipt]); return; }
    uploadReceipts.current.add(receipt);
    pinUploads?.([receipt]);
    onUploadReceipt?.(receipt);
  };
  const revokeReceipts = (receipts: readonly string[]): void => {
    receipts.forEach((receipt) => uploadReceipts.current.delete(receipt));
    unpinUploads?.(receipts);
    void discardUploads?.(receipts);
  };

  const profile = expandSlots ? ST_GOEMOTIONS : profileForTargets(targets);
  const draft =
    showGroups && activeGroup !== FLAT
      ? groups[activeGroup] ?? emptyPack()
      : flat;

  const setDraft = (next: SpritePackValue | ((current: SpritePackValue) => SpritePackValue)): void => {
    const update = (current: SpritePackValue): SpritePackValue => normalizePack(typeof next === "function" ? next(current) : next);
    if (showGroups && activeGroup !== FLAT) {
      setGroups((g) => ({ ...g, [activeGroup]: update(g[activeGroup] ?? emptyPack()) }));
    } else {
      setFlat(update);
    }
  };

  const health = useMemo(() => packHealth(draft), [draft]);
  const groupNames = Object.keys(groups);
  const canAttach = typeof onFetchPack === "function" && packCatalog.length > 0;
  const canFaceOnly = typeof onFaceOnly === "function" && draft.items.length > 0;
  const canSaveLib =
    typeof onSaveAsLibraryPack === "function" && draft.items.length > 0;

  const addGroup = (): void => {
    const name = `Char ${groupNames.length + 1}`;
    let n = name;
    let i = 2;
    while (groups[n]) {
      n = `${name} ${i}`;
      i++;
    }
    setGroups((g) => ({ ...g, [n]: emptyPack() }));
    setActiveGroup(n);
  };

  const renameActive = (name: string): void => {
    if (activeGroup === FLAT || !name.trim()) return;
    const trimmed = name.trim();
    if (trimmed === activeGroup) return;
    setGroups((g) => {
      const next = { ...g };
      const cur = next[activeGroup] ?? emptyPack();
      delete next[activeGroup];
      next[trimmed] = cur;
      return next;
    });
    setActiveGroup(trimmed);
  };

  const removeActive = (): void => {
    if (activeGroup === FLAT) return;
    setGroups((g) => {
      const next = { ...g };
      delete next[activeGroup];
      return next;
    });
    const left = groupNames.filter((n) => n !== activeGroup);
    setActiveGroup(left[0] ?? FLAT);
  };

  const attachFromCard = async (): Promise<void> => {
    if (!onFetchPack || !attachId) return;
    setAttachBusy(true);
    setFlash(null);
    const controller = new AbortController();
    attachAbort.current?.abort();
    attachAbort.current = controller;
    const receipts = new Set<string>();
    try {
      const remote = await onFetchPack(attachId, (receipt) => {
        receipts.add(receipt);
        if (controller.signal.aborted || closed.current) void discardUploads?.([receipt]);
        else trackReceipt(receipt);
      }, controller.signal);
      if (controller.signal.aborted || closed.current || activeGroupRef.current !== activeGroup) { revokeReceipts([...receipts]); return; }
      if (!remote || remote.items.length === 0) {
        setFlash("That card has no expression pack.");
        return;
      }
      // Fresh ids so two packs do not share identity if re-merged later.
      const items = remote.items.map((it) => ({
        ...it,
        id: newPackItemId(),
      }));
      setDraft((current) =>
        normalizePack({
          ...current,
          items: [...current.items, ...items],
          defaultLabel: current.defaultLabel ?? remote.defaultLabel ?? items[0]?.label,
        }),
      );
      const src = packCatalog.find((c) => c.id === attachId)?.name ?? "card";
      setFlash(`Copied ${items.length} face${items.length === 1 ? "" : "s"} from ${src}.`);
    } catch (error) {
      if (controller.signal.aborted || closed.current) revokeReceipts([...receipts]);
      else setFlash(toErrorMessage(error, "Could not load that card."));
    } finally {
      if (attachAbort.current === controller) attachAbort.current = null;
      setAttachBusy(false);
    }
  };

  const runSheetSlice = async (file: File | undefined): Promise<void> => {
    if (!file || !file.type.startsWith("image/")) {
      setFlash("Pick an image sheet.");
      return;
    }
    const cols = Math.max(1, Math.min(16, Math.floor(sheetCols) || 1));
    const rows = Math.max(1, Math.min(16, Math.floor(sheetRows) || 1));
    if (cols * rows > SHEET_MAX_CELLS) {
      setFlash(`Grid too large (max ${SHEET_MAX_CELLS} cells).`);
      return;
    }
    try {
      const dataUri = await readFileAsDataUri(file);
      const sliced = await sliceSheetToItems(dataUri, cols, rows);
      if (sliced.length === 0) {
        setFlash("Sheet slice failed (bad size or grid).");
        return;
      }
      let usable: SpritePackValue["items"] = sliced;
      if (uploadAsset) {
        if (!uploadBatch) { setFlash("Batch staging is unavailable; the sheet was not imported."); return; }
        const files = await Promise.all(sliced.map(async (item) => {
          const blob = await (await fetch(item.ref)).blob();
          return new File([blob], `${item.label}.png`, { type: "image/png" });
        }));
        const grants = await uploadBatch(files);
        if (closed.current) {
          void discardUploads?.(grants.map((grant) => grant.receipt));
          return;
        }
        grants.forEach((grant) => {
          trackReceipt(grant.receipt);
        });
        usable = sliced.map((item, index) => ({ ...item, ref: grants[index]!.ref, mime: grants[index]!.mime }));
      }
      if (usable.length === 0) { setFlash("No sheet faces could be staged; save existing media before adding more."); return; }
      setDraft(
        normalizePack({
          ...draft,
          items: [...draft.items, ...usable],
          defaultLabel: draft.defaultLabel ?? usable[0]?.label,
        }),
      );
      setFlash(`Sliced ${sliced.length} faces from ${cols}×${rows} sheet.`);
    } catch {
      setFlash("Sheet slice failed.");
    }
  };

  return (
    <InkDialog onDismiss={close} ariaLabel="Manage sprites" sheetClassName={styles.sheet}>
      <DialogHeader title={`Manage sprites · ${characterName || "Character"}`} onClose={close} />

      {showGroups ? (
        <div className={styles.groupBar}>
          <Tabs
            label="Character groups"
            value={activeGroup}
            onChange={setActiveGroup}
            items={[{ value: FLAT, label: "Main" }, ...groupNames.map((n) => ({ value: n, label: n }))]}
          />
          <Button size="sm" onClick={addGroup} title="Add character group">
            + Group
          </Button>
          {activeGroup !== FLAT ? (
            <>
              <input
                className={styles.groupName}
                value={activeGroup}
                onChange={(e) => renameActive(e.target.value)}
                aria-label="Group name"
              />
              <Button size="sm" variant="danger" onClick={removeActive}>
                Remove group
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      <ExpressionStage pack={draft} profile={profile} />

      <div className={styles.health}>
        {health.map((h, i) => (
          <div
            key={i}
            className={
              h.kind === "ok" ? styles.healthOk
              : h.kind === "warn" ? styles.healthWarn
              : styles.healthTip
            }
          >
            {h.text}
          </div>
        ))}
      </div>

      <div className={styles.tools}>
        <Button
          size="sm"
          onClick={() => setExpandSlots((v) => !v)}
          title="Show full SillyTavern 28 slot ghosts"
        >
          {expandSlots ? "Slots: ST 28" : "Slots: core"}
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            try {
              const items = await navigator.clipboard.read();
              for (const item of items) {
                const type = item.types.find((t) => t.startsWith("image/"));
                if (!type) continue;
                const blob = await item.getType(type);
                const buf = new Uint8Array(await blob.arrayBuffer());
                const b64 = bytesToBase64(buf);
                const ref = `data:${type};base64,${b64}`;
                const label = "pasted";
                const next = normalizePack({
                  ...draft,
                  items: [
                    ...draft.items,
                    { id: newPackItemId(), label, ref, mime: type },
                  ],
                });
                setDraft(next);
                setFlash("Pasted image as “pasted” - rename the label.");
                return;
              }
              setFlash("Clipboard has no image.");
            } catch {
              setFlash("Clipboard paste blocked - drop a file instead.");
            }
          }}
        >
          Paste image
        </Button>
        {canFaceOnly ? (
          <Button
            size="sm"
            title="Promote default face to portrait and clear the pack (thin export)"
            onClick={() => {
              applied.current = true;
              onFaceOnly?.(draft, focusLabel ?? draft.defaultLabel ?? null);
              setFlash("Face-only applied: portrait set, pack cleared. Save or cancel via parent.");
              close();
            }}
          >
            Face only
          </Button>
        ) : null}
        {canSaveLib ? (
          <Button
            size="sm"
            variant="primary"
            disabled={saving}
            title="Save as a reusable pack entity in The Library"
            onClick={() => {
              const g =
                showGroups && Object.keys(groups).length > 0
                  ? Object.fromEntries(
                      Object.entries(groups).map(([k, v]) => [k, normalizePack(v)]),
                    )
                  : undefined;
              // Report save failures instead of leaving an unhandled rejection.
              setSaving(true);
              const controller = new AbortController();
              saveAbort.current = controller;
              void Promise.resolve(onSaveAsLibraryPack?.(normalizePack(flat), g, controller.signal) ?? false)
                .then((saved) => {
                  setFlash(saved ? "Saved pack to Library · open it from the Packs deck." : "Pack was not saved. Review the status message and try again.");
                })
                .catch(() => {
                  setFlash("Could not save the pack · nothing was written to the Library.");
                })
                .finally(() => {
                  setSaving(false);
                });
            }}
          >
            Save to Library
          </Button>
        ) : null}
        {flash ? <span className={styles.flash}>{flash}</span> : null}
      </div>

      {canAttach ? (
        <AttachPanel
          packCatalog={packCatalog}
          attachId={attachId}
          attachBusy={attachBusy}
          onAttachId={setAttachId}
          onAttach={() => void attachFromCard()}
        />
      ) : null}

      <SheetSlicePanel
        sheetCols={sheetCols}
        sheetRows={sheetRows}
        sheetRef={sheetRef}
        onCols={setSheetCols}
        onRows={setSheetRows}
        onPick={() => sheetRef.current?.click()}
        onFile={(file) => void runSheetSlice(file)}
      />

          <SpritePack
            key={showGroups ? activeGroup : FLAT}
        value={draft}
        onChange={setDraft}
        showEnabled={showEnabled && activeGroup === FLAT}
        showDefault={showDefault}
        profile={expandSlots ? profileById(ST_GOEMOTIONS.id) : profile}
        showSlots
        focusLabel={focusLabel}
        uploadAsset={uploadAsset}
        uploadBatch={uploadBatch}
        discardUploads={discardUploads}
        onUploadReceipt={trackReceipt}
      />

      <DialogFooter
        separated
        onCancel={close}
        onApply={() => {
          const g = showGroups && Object.keys(groups).length > 0
            ? Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, normalizePack(v)]))
            : undefined;
          applied.current = true;
          onApply(normalizePack(flat), g);
          close();
        }}
      />
    </InkDialog>
  );
}
