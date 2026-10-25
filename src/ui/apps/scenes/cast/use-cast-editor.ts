/**
 * One editing session of the scene's character or persona inside the Cast wing. It is the Workbench's
 * own editor state (useEditorRevision, EditorSaveQueue, buildPiecePatch, staged uploads) on a piece read
 * with getEditableEntity; the only difference is where the save goes: POST /api/chats/save-member, which
 * runs the same compare-and-save and then moves THIS scene onto the saved version (ChatStore rules 13
 * and 26). The patch head is the whole entity, so everything the page does not show (unknown fields,
 * escrow, other sections) round-trips untouched.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppContext } from "../../../app-contract";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import type { OpenScene } from "../../../../studio/scenes";
import { buildPiecePatch } from "../../../_shared/editor-patch";
import { EditorSaveQueue, useEditorRevision, type EditorTouch } from "../../../_shared/editor-state";
import { referencedAssetUploads, useAssetUploads } from "../../../_shared/asset-upload";
import { toErrorMessage } from "../../../_shared/error-message";
import { noteForFailure, noteForSaved, type SaveNote } from "./cast-core";

type Body = Record<string, unknown>;

export interface CastEditor<B> {
  body: B;
  dirty: boolean;
  saving: boolean;
  note: SaveNote | null;
  /** Every field edit routes through here; `key` names the top-level part of the body it touches. */
  edit(update: (body: B) => B, key: string): void;
  save(): Promise<void>;
  discard(): void;
  /** Stages a picked image and hands back what to write into the body's portrait slot. */
  uploads: ReturnType<typeof useAssetUploads>;
}

export function useCastEditor<B extends object>({ ctx, chatId, entity, revision, busy, onScene, onSaved }: {
  ctx: AppContext;
  chatId: string;
  /** the Library piece as read by getEditableEntity */
  entity: unknown;
  revision: string;
  /** a reply is being written: saving waits, and says why */
  busy: boolean;
  onScene(scene: OpenScene): void;
  /** Told the version this save made, before the scene moves, so the wing does not read its own save back. */
  onSaved(version: number | undefined): void;
}): CastEditor<B> {
  const parsed = useMemo<ParsedCanonicalEntity>(() => parseCanonicalEntity(entity), [entity]);
  const member = parsed.kind === "persona" ? "persona" : "character";
  const baseline = useRef<ParsedCanonicalEntity>(parsed);
  const revisionRef = useRef(revision);
  const queue = useRef(new EditorSaveQueue());
  useEffect(() => () => { queue.current.invalidate(); }, []);
  const initial = useMemo(() => structuredClone(parsed.body) as unknown as B, [parsed]);
  const { body, dirty, edit: editBody, captureRevision, releaseSubmission, commit, discard } = useEditorRevision<B>(initial, { kind: parsed.kind, id: parsed.id });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<SaveNote | null>(null);
  const { uploads, accept, discardUnused, ...rest } = useAssetUploads(
    ctx.api.uploadAsset,
    ctx.api.discardAssetUploads,
    (error) => setNote({ kind: "failed", text: toErrorMessage(error, "could not stage the image") }),
  );
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const what = member === "persona" ? "persona" : "card";

  const edit = useCallback((update: (b: B) => B, key: string): void => {
    const touch: EditorTouch<B> = { key, read: (value) => (value as Body)[key], write: (value, next) => ({ ...value, [key]: next }) };
    editBody(update, touch);
    setNote((n) => (n && n.kind !== "saved" ? null : n));
  }, [editBody]);

  const save = useCallback(async (): Promise<void> => {
    if (saving || !dirty) return;
    if (busy) return setNote({ kind: "busy", text: "A reply is being written. You can save when it finishes." });
    const submitted = body;
    const used = referencedAssetUploads(submitted, uploads);
    const unused = uploads.filter((u) => !used.some((x) => x.ref === u.ref));
    const atRev = captureRevision();
    await queue.current.run(async (isCurrent) => {
      setSaving(true);
      setNote(null);
      try {
        const next = { ...baseline.current, body: submitted } as unknown as ParsedCanonicalEntity;
        const patch = buildPiecePatch(baseline.current, next);
        const result = await ctx.api.saveSceneMember({
          chatId, member, kind: parsed.kind, id: parsed.id, expectedRevision: revisionRef.current, patch, uploads: used.map((u) => u.ref),
        });
        if (!isCurrent()) return;
        baseline.current = next;
        revisionRef.current = result.summary.revision ?? revisionRef.current;
        commit(submitted, atRev);
        accept(used.map((u) => u.ref));
        if (unused.length) void discardUnused(unused.map((u) => u.ref), bodyRef.current);
        onSaved(result.summary.version);
        if (result.scene) onScene(result.scene);
        setNote(noteForSaved(result.summary.version, result.applied, what));
      } catch (e) {
        if (isCurrent()) setNote(noteForFailure(e, what));
      } finally {
        if (isCurrent()) setSaving(false);
      }
    }).finally(() => releaseSubmission(atRev));
  }, [saving, dirty, busy, body, uploads, captureRevision, ctx.api, chatId, member, parsed.kind, parsed.id, commit, accept, discardUnused, onScene, onSaved, releaseSubmission, what]);

  return { body, dirty, saving, note, edit, save, discard, uploads: { uploads, accept, discardUnused, ...rest } };
}
