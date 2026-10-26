/**
 * PackEditor - open a library pack entity as a "folder": name, brief, full sprite grid.
 * Same SpritePack leaf as Manage Sprites; save writes the pack entity.
 */
import { Button } from "../../components/button";
import { useCallback, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import {
  emptyPack,
  normalizePack,
  resolvePackFace,
  type SpritePackValue,
} from "../../../core/media";
import { ExpandTextarea } from "../../components/expand";
import { toErrorMessage } from "../../_shared/error-message";
import { SpritePack } from "../../components/sprite-pack";
import { packEditorDocument } from "./pack-editor-core";
import { useEditorGuards } from "./use-editor-guards";
import { EditorSaveQueue, useEditorHistoryKeys, useEditorRevision } from "../../_shared/editor-state";
import { buildPiecePatch } from "../../_shared/editor-patch";
import { useArtSrc } from "../../_shared/art-cache";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../../../entities/runtime-schema";
import type { SaveIntent } from "../../../stage/contracts/content-store";
import { referencedAssetUploads, useAssetUploads } from "../../_shared/asset-upload";
import { useSurfaceVariant } from "../../_shared/surface-variant";
import { EditorField } from "./layout/editor-field";
import { EditorLayout } from "./layout/editor-layout";
import styles from "./PackEditor.module.css";

function canonicalPack(entity: unknown, id: string): Extract<ParsedCanonicalEntity, { kind: "pack" }> {
  const parsed = parseCanonicalEntity(entity);
  if (parsed.kind !== "pack" || parsed.id !== id) throw new Error("Pack editor received a mismatched entity");
  return parsed;
}

export interface PackEditorProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

export function PackEditor({ entity, revision, ctx, piece, topRight }: PackEditorProps): JSX.Element {
  const revisionRef = useRef(revision);
  const init = useMemo(() => packEditorDocument(entity), [entity]);
  const { body, dirty, edit, captureRevision, releaseSubmission, commit, canUndo, canRedo, undo, redo } =
    useEditorRevision(init.body, { kind: "pack", id: piece.id });
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const [saving, setSaving] = useState(false);
  const { uploads, uploadAsset, uploadBatch, accept, discard, discardUnused } = useAssetUploads(
    ctx.api.uploadAsset,
    ctx.api.discardAssetUploads,
    (error) => ctx.setStatus(toErrorMessage(error, "could not stage media")),
  );
  const queue = useRef(new EditorSaveQueue());
  useEffect(() => () => { queue.current.invalidate(); }, []);
  const initialEntity = useMemo(() => canonicalPack(entity, piece.id), [entity, piece.id]);
  const baselineEntity = useRef(initialEntity);
  const { name, brief = "", pack } = body;
  const groups = body.groups;
  const editName = (value: string): void => edit((current) => ({ ...current, name: value }), { key: "name", read: (current) => current.name });
  const editBrief = (value: string): void => edit((current) => ({ ...current, brief: value || undefined }), { key: "brief", read: (current) => current.brief ?? "" });
  const editPack = (value: SpritePackValue): void => edit((current) => ({ ...current, pack: normalizePack(value) }), { key: "pack", read: (current) => current.pack });
  const doSave = useCallback(async (intent: SaveIntent = "manual"): Promise<boolean> => {
    if (!dirty) return true;
    const submitted = body;
    const submittedUploads = referencedAssetUploads(submitted, uploads);
    const unusedUploads = uploads.filter((upload) => !submittedUploads.some((used) => used.ref === upload.ref));
    const atRevision = captureRevision();
    const result = await queue.current.run(async (isCurrent) => {
      setSaving(true);
      try {
        const next = { ...baselineEntity.current, body: submitted };
        const saved = await ctx.api.patchEditedEntity("pack", piece.id, revisionRef.current, buildPiecePatch(baselineEntity.current, next), submittedUploads.map((upload) => upload.ref), intent);
        if (!isCurrent()) return false;
        baselineEntity.current = next;
        revisionRef.current = saved.revision;
        commit(submitted, atRevision);
        accept(submittedUploads.map((upload) => upload.ref));
        if (unusedUploads.length) void discardUnused(unusedUploads.map((upload) => upload.ref), bodyRef.current);
        ctx.setStatus(`saved pack · ${submitted.name}`);
        return true;
      } catch (error) {
        if (isCurrent()) ctx.setStatus(toErrorMessage(error, "save failed"));
        return false;
      } finally { if (isCurrent()) setSaving(false); }
    }).finally(() => releaseSubmission(atRevision));
    return result ?? false;
  }, [dirty, body, captureRevision, ctx, piece.id, commit, releaseSubmission, uploads, accept, discardUnused]);

  useEditorGuards(ctx, piece, dirty, doSave);
  useEditorHistoryKeys(canUndo, canRedo, () => { undo(); }, () => { redo(); }, ctx.setStatus, "pack");

  useEffect(() => {
    ctx.setStatus(
      dirty
        ? `pack · ${name || piece.name} · unsaved`
        : `pack · ${name || piece.name} · ${pack.items.length} faces`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, name, pack.items.length, piece.name]);

  const cover = resolvePackFace(pack, pack.defaultLabel)?.ref ?? pack.items[0]?.ref ?? null;
  const coverAsset = useArtSrc(cover);

  const frame = useSurfaceVariant("editor.frame");
  const coverBlock = (
    <div
      className={styles.cover}
      ref={coverAsset.ref as (node: HTMLDivElement | null) => void}
      style={coverAsset.src ? { backgroundImage: `url("${coverAsset.src}")` } : undefined}
      aria-hidden
    >
      {!cover ? <b>{(name || "P").charAt(0).toUpperCase()}</b> : null}
    </div>
  );
  const briefInput = (
    <ExpandTextarea label="Brief" value={brief} onChange={(e) => editBrief(e.target.value)} rows={3} placeholder="Optional shelf blurb" />
  );
  const packNotes = (
    <>
      <p className={styles.hint}>
        Library pack folder. Attach onto a character: Manage Sprites → Copy pack from card →
        Pack · …
      </p>
      <p className={styles.meta}>
        {pack.items.length} face{pack.items.length === 1 ? "" : "s"}
        {pack.defaultLabel ? ` · default ${pack.defaultLabel}` : ""}
      </p>
    </>
  );
  const spriteGrid = (
    <SpritePack
      value={pack.items.length ? pack : emptyPack()}
      onChange={editPack}
      showEnabled={false}
      showDefault
      showSlots
      uploadAsset={uploadAsset}
      uploadBatch={uploadBatch}
      discardUploads={discard}
    />
  );

  return (
    <div className={styles.root} data-kind="pack">
      <div className={styles.bar}>
        <span className={styles.kindTag}>pack folder</span>
        <input
          className={styles.name}
          value={name}
          onChange={(e) => editName(e.target.value)}
          aria-label="Pack name"
          placeholder="Pack name"
        />
        <span className={styles.flag}>{dirty ? "unsaved" : "saved"}</span>
        {topRight}
        <Button variant="primary" disabled={!dirty || saving} onClick={() => void doSave()}>{saving ? "Saving…" : "Save"}</Button>
      </div>

      <div className={`${styles.room} scrollThin`}>
        {frame === "core" ? (
          <>
            <aside className={styles.aside}>
              {coverBlock}
              <label className={styles.field}>
                Brief
                {briefInput}
              </label>
              {packNotes}
            </aside>
            <main className={styles.main}>{spriteGrid}</main>
          </>
        ) : (
          <div className={styles.framed}>
            <EditorLayout
              label="Pack sections"
              rail={<>{coverBlock}{packNotes}</>}
              sections={[
                { id: "brief", title: "Brief", filled: brief.trim() !== "", node: <EditorField label="Brief" wide>{briefInput}</EditorField> },
                { id: "faces", title: "Faces", filled: pack.items.length > 0, node: spriteGrid },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
