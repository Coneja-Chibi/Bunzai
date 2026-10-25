/** Writable Workbench editor for canonical quick-reply sets. Message scripts remain inert text. */
import { useCallback, useMemo, useRef, type CSSProperties, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { useAccentVars } from "../../../_shared/use-scoped-accents";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { QuickReplyBody } from "../../../../entities/quickreply/schema";
import type { ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import { applyPiecePatch, buildPiecePatch, buildTouchedPatch, OccurrenceIndex, useEditorHistoryKeys, useEditorRevision, useEditorSave, type EditorTouch } from "../../../_shared/editor-state";
import { partNames } from "../../../../entities/piece-parts";
import { EditorEhead } from "../../../components/editor-ehead";
import { EditorConflict } from "../editor-conflict";
import { useEditorGuards } from "../use-editor-guards";
import { useReseedOnReread } from "../use-reseed";
import { apiStatusIs } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";
import { addReply, bodyFromEntity, patchReply, removeReply, replyTouch } from "./session";
import s from "./quickreply.module.css";
import { framed as f, useFramed } from "../framed";
import { EditorLayout } from "../layout/editor-layout";
import { recOr } from "../../../../core/guards";
import { QuickReplyList } from "./reply-list";

export interface QuickReplyEditorProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}


export function QuickReplyEditor({ entity, revision, ctx, piece, topRight }: QuickReplyEditorProps): JSX.Element {
  const accentVars = useAccentVars();
  const framed = useFramed();
  const revisionRef = useRef(revision);
  const initial = useMemo(() => bodyFromEntity(entity), [entity]);
  const { body, baseline, dirty, edit: editRawBody, capturePatchState, commit, reseed, canUndo, canRedo, undo: undoBody, redo: redoBody } =
    useEditorRevision(initial, { kind: "quickreply", id: piece.id });
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const replyIndex = useRef(new OccurrenceIndex<QuickReplyBody["replies"][number]>());
  const indexReady = useRef(false);
  if (!indexReady.current) { replyIndex.current.rebuild(initial.replies, (reply) => reply.id); indexReady.current = true; }
  const editReplies = useCallback((update: (current: QuickReplyBody) => QuickReplyBody, touch?: EditorTouch<QuickReplyBody>): void => {
    const current = bodyRef.current;
    const next = update(current);
    editRawBody(() => next, touch);
    bodyRef.current = next;
    if (!touch && next !== current) replyIndex.current.rebuild(next.replies, (reply) => reply.id);
  }, [editRawBody]);
  const reseedReplies = useCallback((fresh: QuickReplyBody): void => {
    reseed(fresh);
    bodyRef.current = fresh;
    replyIndex.current.rebuild(fresh.replies, (reply) => reply.id);
  }, [reseed]);
  const restoreReplies = useCallback((restore: () => QuickReplyBody | undefined): void => {
    const fresh = restore();
    if (fresh) { bodyRef.current = fresh; replyIndex.current.rebuild(fresh.replies, (reply) => reply.id); }
  }, []);
  const undo = useCallback(() => restoreReplies(undoBody), [restoreReplies, undoBody]);
  const redo = useCallback(() => restoreReplies(redoBody), [restoreReplies, redoBody]);
  useEditorHistoryKeys(canUndo, canRedo, undo, redo, ctx.setStatus, "quick-reply");
  const baseEntity = useMemo(() => {
    const source = recOr(entity);
    return { ...source, schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "quickreply", id: piece.id, body: baseline } as ParsedCanonicalEntity;
  }, [entity, baseline, piece.id]);
  const saveState = useEditorSave({
    hasChanges: () => dirty,
    capture: () => {
      const patchState = capturePatchState();
      return { draft: body, baseline: baseEntity, revision: patchState.revision, patchState };
    },
    expectedRevision: () => revisionRef.current,
    read: async () => {
      const fresh = await ctx.api.getLightEditableEntity(`kind=quickreply&id=${encodeURIComponent(piece.id)}`);
      return { entity: fresh.entity as ParsedCanonicalEntity, revision: fresh.revision };
    },
    buildPatch: (base, submitted, _native, state) => {
      const next = { ...base, body: submitted } as ParsedCanonicalEntity;
      return state && !state.structural ? buildTouchedPatch(next, state.items) : buildPiecePatch(base, next);
    },
    itemNames: partNames,
    applyPatch: applyPiecePatch,
    patch: (expected, patch, intent) => ctx.api.patchEditedEntity("quickreply", piece.id, expected, patch, undefined, intent),
    commit: (submitted, atRev, savedRevision) => {
      revisionRef.current = savedRevision;
      commit(submitted, atRev);
    },
    commitPartial: (saved, atRev, savedRevision) => {
      revisionRef.current = savedRevision;
      commit(bodyFromEntity(saved), atRev);
    },
    takeTheirs: (fresh, freshRevision) => {
      revisionRef.current = freshRevision;
      reseedReplies(bodyFromEntity(fresh));
    },
    isConflict: (error) => apiStatusIs(error, 409),
    onSave: (submitted, mode) => ctx.setStatus(`${mode === "keepMine" ? "overwrote" : "saved"} quick replies · ${submitted.name}`),
    onError: (error, mode) => ctx.setStatus(toErrorMessage(error, mode === "takeTheirs" ? "could not reload the quick replies" : "could not save the quick replies")),
  });
  const { saving, conflict, save, keepMine, takeTheirs, invalidate } = saveState;

  useReseedOnReread(revision, dirty, () => {
    const fresh = bodyFromEntity(entity);
    invalidate();
    revisionRef.current = revision;
    reseedReplies(fresh);
  });

  const doSave = useCallback(async (intent: "manual" | "autosave" = "manual"): Promise<boolean> => {
    if (!dirty) return true;
    if (!body.name.trim()) {
      ctx.setStatus("a name is required before saving");
      return false;
    }
    return save(intent);
  }, [body.name, ctx, dirty, save]);

  useEditorGuards(ctx, piece, dirty, doSave, body.name.trim().length > 0, saveState.autosave);
  const list = (
    <QuickReplyList replies={body.replies} onAdd={() => editReplies(addReply)}
      onPatch={(id, patch) => editReplies((current) => patchReply(current, id, patch), replyTouch(id, replyIndex.current))}
      onRemove={(id) => editReplies((current) => removeReply(current, id))} />
  );
  return (
    <div className={s.root} style={accentVars(piece.accent) as CSSProperties | undefined}>
      <EditorEhead
        mark={(body.name.trim()[0] || "Q").toUpperCase()}
        name={body.name}
        onNameChange={(name) => editReplies((current) => ({ ...current, name }), {
          key: "name", read: (current) => current.name, write: (current, value) => ({ ...current, name: value as string }),
        })}
        namePlaceholder="Untitled quick replies"
        nameAriaLabel="Quick-reply set name"
        meta={`quick replies · ${body.replies.length} button${body.replies.length === 1 ? "" : "s"}`}
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        topRight={topRight}
      />
      {conflict && <EditorConflict what="quick-reply set" onTakeTheirs={takeTheirs} onKeepMine={() => void keepMine()} />}
      {framed ? (
        <div className={f.host}>
          <EditorLayout label="Quick-reply sections" sections={[{
            id: "buttons", title: "Buttons", filled: body.replies.length > 0,
            node: <div className={f.bounded}><div className={s.list}>{list}</div></div>,
          }]} />
        </div>
      ) : (
        <div className={s.body}>
          <div className={s.list}>{list}</div>
        </div>
      )}
    </div>
  );
}
