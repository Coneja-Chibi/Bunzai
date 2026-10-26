/**
 * HtmlDocEditor - write a drawing on the left, watch it draw on the right.
 *
 * THE PREVIEW IS THE POINT. A wireframe is judged by looking at it, so an editor that only showed
 * markup would make every change a round trip through another surface. It draws live because the
 * source is right there; nothing is saved to see it.
 *
 * SAME SEAL AS EVERYWHERE ELSE. SealedHtmlPreview - srcdoc iframe, `sandbox=""`, CSP of
 * `script-src 'none'; connect-src 'none'; img-src data: blob:`, over DOMPurify-cleaned markup. This
 * content came from a model and stays untrusted no matter which surface shows it, so the editor's
 * pane is the same component as the transcript's inline preview and the full tab. Three sizes, one
 * boundary, nothing to drift.
 *
 * AUTOSAVE THROUGH useEditorGuards, like every other editor here, so a drawing behaves the way a
 * character or a persona does - including the conflict bar when the file changed underneath.
 *
 * THE SOURCE HALF GETS OUT OF THE WAY. Half the room spent on markup is the wrong default once a
 * drawing is being LOOKED at rather than written, so the divider drags and the source hides
 * outright. Both are remembered in settings, because that is a working habit, not a per-file one.
 */
import { Button } from "../../components/button";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { AppActivity } from "../../_shared/app-activity";
import { CANONICAL_SCHEMA_VERSION } from "../../../core/canonical";
import type { HtmlDocBody } from "../../../entities/htmldoc/schema";
import type { ParsedCanonicalEntity } from "../../../entities/runtime-schema";
import { HTMLDOC_CAP } from "../../../entities/htmldoc/runtime-schema";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { SealedHtmlPreview } from "../../components/sealed-html-preview";
import { exitFullscreen, fullscreenElement, requestFullscreen } from "../../_shared/fullscreen";
import { useEscapeKey } from "../../_shared/use-escape-key";
import { applyPiecePatch, buildPiecePatch, buildTouchedPatch, useEditorHistoryKeys, useEditorRevision, useEditorSave } from "../../_shared/editor-state";
import { partNames } from "../../../entities/piece-parts";
import { toErrorMessage } from "../../_shared/error-message";
import { useEditorGuards } from "./use-editor-guards";
import { useReseedOnReread } from "./use-reseed";
import { EditorConflict } from "./editor-conflict";
import { apiStatusIs } from "../../_shared/api-fetch";
import { useSurfaceVariant } from "../../_shared/surface-variant";
import { EditorField } from "./layout/editor-field";
import { EditorLayout } from "./layout/editor-layout";
import { readSplit, splitFromKey, splitFromPointer } from "./htmldoc-split";
import styles from "./htmldoc.module.css";
import { isRecord, str, strArray, recOr } from "../../../core/guards";

/** Remembered in settings, namespaced by app like every other pref. */
const SPLIT_KEY = "workbench.htmldoc.split";
const SOURCE_KEY = "workbench.htmldoc.source";

export interface HtmlDocEditorProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}



/** Read the stored body, tolerating a piece written by an older shape. */
function bodyFromEntity(entity: unknown): HtmlDocBody {
  const body = isRecord(entity) && isRecord(entity["body"]) ? entity["body"] : {};
  const tags = strArray(body["tags"]);
  return {
    name: str(body["name"]),
    html: str(body["html"]),
    ...(str(body["summary"]) ? { summary: str(body["summary"]) } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(str(body["notes"]) ? { notes: str(body["notes"]) } : {}),
  };
}

export function HtmlDocEditor({ entity, revision, ctx, piece, topRight }: HtmlDocEditorProps): JSX.Element {
  const revisionRef = useRef(revision);
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const { body, baseline, dirty, edit: editBody, capturePatchState, commit, reseed, canUndo, canRedo, undo, redo } =
    useEditorRevision(initBody, { kind: "htmldoc", id: piece.id });
  useEditorHistoryKeys(canUndo, canRedo, undo, redo, ctx.setStatus, "drawing");

  const frame = useSurfaceVariant("editor.frame");
  const splitRef = useRef<HTMLDivElement | null>(null);
  const [split, setSplit] = useState(() => readSplit(ctx.prefs.get(SPLIT_KEY)));
  // Shown unless somebody said otherwise: a drawing nobody can edit is the surprising default.
  const [sourceOpen, setSourceOpen] = useState(() => ctx.prefs.get(SOURCE_KEY) !== false);

  const moveSplit = useCallback((next: number): void => {
    setSplit(next);
    ctx.prefs.set(SPLIT_KEY, next);
  }, [ctx]);

  const dragTo = useCallback((clientX: number): void => {
    const room = splitRef.current?.getBoundingClientRect();
    if (!room) return;
    moveSplit(splitFromPointer(clientX, room.left, room.width, split));
  }, [moveSplit, split]);

  /**
   * Fullscreen. Real fullscreen where the engine gives it, an overlay over the app where it does
   * not - a button that does nothing when pressed is worse than one that does something smaller.
   */
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [big, setBig] = useState(false);

  const goBig = useCallback(async (): Promise<void> => {
    setBig(true);
    await requestFullscreen(frameRef.current);
  }, []);

  const comeBack = useCallback(async (): Promise<void> => {
    setBig(false);
    await exitFullscreen();
  }, []);

  // Escape leaves the overlay too, because Escape is what leaves real fullscreen and the two must
  // not need different keys. The listener only exists while it is up.
  const appActive = useContext(AppActivity);
  useEscapeKey(() => void comeBack(), big && appActive);
  useEffect(() => { if (!appActive && big) void comeBack(); }, [appActive, big, comeBack]);

  useEffect(() => {
    if (!big) return undefined;
    // And when the engine leaves fullscreen on its own (Escape, F11, a window change), the class
    // has to come off with it or the pane stays covered by an overlay nobody asked for.
    const onChange = (): void => { if (!fullscreenElement()) setBig(false); };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [big]);

  const overCap = body.html.length > HTMLDOC_CAP;
  const baseEntity = useMemo(() => {
    const source = recOr(entity);
    return { ...source, schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "htmldoc", id: piece.id, body: baseline } as ParsedCanonicalEntity;
  }, [entity, baseline, piece.id]);
  const saveState = useEditorSave({
    hasChanges: () => dirty,
    capture: () => {
      const patchState = capturePatchState();
      return { draft: body, baseline: baseEntity, revision: patchState.revision, patchState };
    },
    expectedRevision: () => revisionRef.current,
    read: async () => {
      const fresh = await ctx.api.getLightEditableEntity(`kind=htmldoc&id=${encodeURIComponent(piece.id)}`);
      return { entity: fresh.entity as ParsedCanonicalEntity, revision: fresh.revision };
    },
    buildPatch: (base, submitted, _native, state) => {
      const next = { ...base, body: submitted } as ParsedCanonicalEntity;
      return state && !state.structural ? buildTouchedPatch(next, state.items) : buildPiecePatch(base, next);
    },
    itemNames: partNames,
    applyPatch: applyPiecePatch,
    patch: (expected, patch, intent) => ctx.api.patchEditedEntity("htmldoc", piece.id, expected, patch, undefined, intent),
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
      reseed(bodyFromEntity(fresh));
    },
    isConflict: (error) => apiStatusIs(error, 409),
    onSave: (submitted, mode) => ctx.setStatus(`${mode === "keepMine" ? "overwrote" : "saved"} drawing · ${submitted.name}`),
    onError: (error, mode) => ctx.setStatus(toErrorMessage(error, mode === "takeTheirs" ? "could not reload the drawing" : "could not save the drawing")),
  });
  const { saving, conflict, save, keepMine, takeTheirs, invalidate } = saveState;
  useReseedOnReread(revision, dirty, () => {
    invalidate();
    revisionRef.current = revision;
    reseed(bodyFromEntity(entity));
  });

  const doSave = useCallback(async (intent: "manual" | "autosave" = "manual"): Promise<boolean> => {
    if (!dirty) return true;
    if (!body.name.trim()) {
      ctx.setStatus("a name is required before saving");
      return false;
    }
    if (body.html.length > HTMLDOC_CAP) {
      // Refused here rather than truncated: a drawing quietly cut to fit is one whose end nobody
      // knows is missing, and the decoder would reject it anyway.
      ctx.setStatus(`this drawing is longer than ${HTMLDOC_CAP} characters and cannot be saved`);
      return false;
    }
    return save(intent);
  }, [dirty, body.name, body.html.length, ctx, save]);

  // Savable only with a name and within the cap, so autosave never retries something that cannot
  // succeed and then reports it as a disk conflict.
  useEditorGuards(ctx, piece, dirty, doSave, body.name.trim().length > 0 && !overCap, saveState.autosave);

  const patch = (next: Partial<HtmlDocBody>): void => {
    const keys = Object.keys(next) as (keyof HtmlDocBody)[];
    editBody((current) => ({ ...current, ...next }), {
      key: keys.join(","),
      read: (current) => keys.map((key) => current[key]),
      write: (current, value) => ({ ...current, ...Object.fromEntries(keys.map((key, index) => [key, (value as unknown[])[index]])) }),
    });
  };

  const sourcePane = (
    <div className={styles.pane} hidden={!sourceOpen}>
      <div className={styles.paneHead}>
        <span className={styles.paneTitle}>Source</span>
        <span className={overCap ? styles.over : styles.count}>
          {`${body.html.length} / ${HTMLDOC_CAP}`}
        </span>
        <Button variant="quiet" size="sm" onClick={() => { setSourceOpen(false); ctx.prefs.set(SOURCE_KEY, false); }}>{"Hide"}</Button>
      </div>
      <textarea
        className={styles.source}
        value={body.html}
        spellCheck={false}
        aria-label="HTML source"
        onChange={(e) => patch({ html: e.target.value })}
      />
      {/*
        Said while it is still editable, not on a failed save. The cap is the sealed preview's
        own ceiling, so a longer drawing is one whose end could never be seen anyway.
      */}
      {overCap && (
        <p className={styles.over}>
          {`Too long to save by ${body.html.length - HTMLDOC_CAP} characters. `}
          {"The preview truncates past this point too, so the end would not draw either."}
        </p>
      )}
    </div>
  );
  const drawingPane = (
    <div className={styles.pane}>
      <div className={styles.paneHead}>
        <span className={styles.paneTitle}>Drawing</span>
        <span className={styles.count}>scripts and network off</span>
        <Button size="sm" onClick={() => { void goBig(); }} disabled={!body.html.trim()}>{"Fullscreen"}</Button>
      </div>
      {/*
        The element that goes fullscreen is this container, never the iframe: the seal inside it
        is unchanged by being large, and asking the sandboxed frame itself would need a
        permission it is deliberately not given.
      */}
      <div className={big ? `${styles.frame} ${styles.big}` : styles.frame} ref={frameRef}>
        {big && (
          <span className={styles.close}>
            <Button variant="quiet" size="sm" onClick={() => { void comeBack(); }}>{"Close (Esc)"}</Button>
          </span>
        )}
        {body.html.trim()
          ? <SealedHtmlPreview html={body.html} title="This drawing" fill />
          : <p className={styles.empty}>Write some HTML and it draws here as you type.</p>}
      </div>
    </div>
  );
  const summaryField = (
    <input
      className={styles.summary}
      value={body.summary ?? ""}
      placeholder="One line on what this draws (optional)"
      aria-label="Summary"
      onChange={(e) => patch({ summary: e.target.value })}
    />
  );
  // Hidden, not unmounted-and-forgotten: the source is still the piece being edited, so the way back
  // is a control in the same place the pane was, never a menu somewhere else.
  const revealButton = !sourceOpen && (
    <span className={styles.reveal}>
      <Button size="sm" onClick={() => { setSourceOpen(true); ctx.prefs.set(SOURCE_KEY, true); }}>{"Show source"}</Button>
    </span>
  );

  return (
    <div className={`${styles.room} scrollThin`}>
      <div className={styles.head}>
        <input
          className={styles.name}
          value={body.name}
          placeholder="Name this drawing"
          aria-label="Drawing name"
          onChange={(e) => patch({ name: e.target.value })}
        />
        {topRight}
      </div>
      {conflict && <EditorConflict what="drawing" onTakeTheirs={() => void takeTheirs()} onKeepMine={() => void keepMine()} />}

      {frame !== "core" ? (
        <EditorLayout label="Drawing sections" sections={[
          { id: "details", title: "Details", node: <EditorField label="Summary" wide>{summaryField}</EditorField> },
          { id: "source", title: "Source", node: <div className={styles.stackedPane}>{revealButton}{sourcePane}</div> },
          { id: "drawing", title: "Drawing", node: <div className={styles.stackedPane}>{drawingPane}</div> },
        ]} />
      ) : (
        <>
          {summaryField}

          <div
            className={styles.split}
            ref={splitRef}
            style={sourceOpen ? { gridTemplateColumns: `${split}% 0.45rem minmax(0, 1fr)` } : undefined}
          >
            {revealButton}
            {sourcePane}

            {/*
              A real separator, not a decorative bar: arrow keys move it and Home/End slam it to the
              bounds, so the split is reachable without a pointer at all.
            */}
            {sourceOpen && (
              <div
                className={styles.grip}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize the source pane"
                aria-valuenow={split}
                aria-valuemin={15}
                aria-valuemax={85}
                tabIndex={0}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dragTo(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId)) dragTo(e.clientX);
                }}
                onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
                onDoubleClick={() => moveSplit(50)}
                onKeyDown={(e) => {
                  const next = splitFromKey(e.key, split);
                  if (next === null) return;
                  e.preventDefault();
                  moveSplit(next);
                }}
              />
            )}

            {drawingPane}
          </div>
        </>
      )}
    </div>
  );
}
