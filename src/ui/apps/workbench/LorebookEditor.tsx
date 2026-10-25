/** LorebookEditor owns lorebook editing, history, TOC search, and revision-checked saves. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode, type SetStateAction } from "react";
import { useEditorKeys } from "./editor-key-owner";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { useAccentVars } from "../../_shared/use-scoped-accents";
import { toErrorMessage } from "../../_shared/error-message";
import { isTypingTarget } from "../../_shared/typing-target";
import type { LorebookBody } from "../../../entities/lorebook/schema";
import { deepEqual, editorHistoryChanges, OccurrenceIndex, useEditorSave, type EditorTouch } from "../../_shared/editor-state";
import {
  estimateBookTokens,
  estimateEntryTokens,
  findingsFromHealNotes,
  healNotesFromOriginal,
  inspectBook,
  loreHealth,
  loreSummary,
  LORE_WRITE_FOR_LABELS,
  LORE_WRITE_FOR_PROFILES,
  parseWriteFor,
  type LoreWriteForProfile,
} from "../../../core/lore";
import {
  addEntry,
  deleteEntries,
  deleteEntry,
  duplicateEntry,
  edgeChanges,
  healthByEntry,
  loreStatusLine,
  stepEntry,
  focusedEntry,
  normalizeSession,
  reorderEntry,
  loreEntryTouch,
  loreFieldsTouch,
  applyLoreHistory,
  selectEntry,
  setEntriesEnabled,
  updateBook,
  updateEntry,
  type LoreSession,
} from "./lore/session";
import { LoreEntryPage } from "./lore/entry-page";
import { LoreEntryToc } from "./lore/entry-toc";
import { MarinaraFolderToc } from "./lore/folder-toc";
import { FolderInspector } from "./lore/folder-inspector";
import { useMarinaraFolders } from "./lore/use-marinara-folders";
import { lorebookSaveAdapter } from "./lore/save";
import { useLoreBodyDirty } from "./lore/use-lore-body-dirty";
import { bodyFromEntity, canonicalLorebook, readLoreLight } from "./lore/light-read";
import { readMarinaraEdges } from "./lore/folder-tree";
import { LoreBookSettings } from "./lore/book-settings";
import { CardsView } from "./lore/cards-view";
import { WebView } from "./lore/web-view";
import { BinderSide, type BinderSidePane } from "./lore/binder-side";
import { binderStyles as styles } from "./lore/binder-styles";
import { framed as f, useFramed, useRail } from "./framed";
import { EditorLayout } from "./layout/editor-layout";
import {
  LoreWorkshopDialog,
  type LoreWorkshopState,
} from "../library/lore-workshop-dialog";
import { BottomSheet } from "../../components/bottom-sheet";
import { InkDialog } from "../../components/ink-dialog";
import { EditorEhead } from "../../components/editor-ehead";
import { EditorConflict } from "./editor-conflict";
import { useEditorGuards } from "./use-editor-guards";
import { useReseedOnReread } from "./use-reseed";
import { isRecord } from "../../../core/guards";
export interface LorebookEditorProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const WRITE_FOR_PREF = "lorebook.writeFor";

export function LorebookEditor({ entity, revision, ctx, piece, topRight }: LorebookEditorProps): JSX.Element {
  const accentVars = useAccentVars();
  const framed = useFramed();
  // which section a theme frame has open: picking an entry or a folder goes to the page
  const [section, setSection] = useState("page");
  const revisionRef = useRef(revision);
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const bodyTracking = useLoreBodyDirty(initBody);
  const { baseline, dirty: bodyDirty, track: trackBody, accept: acceptBody, reseed: reseedBody } = bodyTracking;
  const [session, setSessionState] = useState<LoreSession>(() => normalizeSession(initBody, readMarinaraEdges(isRecord(entity) ? entity.original : undefined)));
  const entryPartIndex = useRef(new OccurrenceIndex<LorebookBody["entries"][number]>());
  const entryIndexReady = useRef(false);
  if (!entryIndexReady.current) { entryPartIndex.current.rebuild(initBody.entries, (entry) => entry.id); entryIndexReady.current = true; }
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const editRevision = useRef(0);
  const setSession = useCallback((update: SetStateAction<LoreSession>, touch?: EditorTouch<LorebookBody>, record = true): void => {
    const current = sessionRef.current;
    let next = typeof update === "function" ? update(current) : update;
    const bodyChanged = next.body !== current.body;
    const edgesChanged = next.edges !== current.edges;
    const bodySemantic = touch ? !deepEqual(touch.read(current.body), touch.read(next.body)) : !deepEqual(current.body, next.body);
    const edgeSemantic = edgesChanged && (current.edges.size !== next.edges.size || [...current.edges].some(([id, parent]) => next.edges.get(id) !== parent));
    if (record && (bodySemantic || edgeSemantic)) {
      const { before: beforeEdges, after: afterEdges } = edgeSemantic ? edgeChanges(current.edges, next.edges) : { before: [], after: [] };
      const [inverse, forward] = editorHistoryChanges(
        current.body, next.body, touch, "lorebook", piece.id,
        beforeEdges.length ? beforeEdges : undefined, afterEdges.length ? afterEdges : undefined,
      );
      bodyTracking.history.record(inverse, forward);
    }
    if (bodyChanged || edgesChanged) {
      editRevision.current++;
      if (bodyChanged) trackBody(next.body, touch, editRevision.current, !record);
      if (bodyChanged && !touch) entryPartIndex.current.rebuild(next.body.entries, (entry) => entry.id);
    }
    sessionRef.current = next;
    setSessionState(next);
  }, [bodyTracking.history, piece.id, trackBody]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [sidePane, setSidePane] = useState<BinderSidePane>(null);
  const [view, setView] = useState<"pages" | "cards" | "web">("pages");
  const [workshop, setWorkshop] = useState<LoreWorkshopState | null>(null);
  const [writeFor, setWriteForState] = useState<LoreWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );
  const [importBaseline] = useState(() => structuredClone(initBody));
  const folders = useMarinaraFolders({ session, setSession, writeFor, styles, entryIndex: entryPartIndex.current });

  useEffect(() => {
    const focus = piece.params?.focusEntry;
    if (!focus) return;
    setSession((s) => (s.body.entries.some((e) => e.id === focus) ? selectEntry(s, focus) : s));
  }, [piece.params?.focusEntry, piece.id, setSession]);

  const dirty = bodyDirty || folders.edgesDirty;
  const saveState = useEditorSave(lorebookSaveAdapter({
    ctx, id: piece.id, entity, baseline, dirty, revision: revisionRef,
    editRevision, session: sessionRef, folders,
    setBaseline: (body, atRevision) => acceptBody(body, sessionRef.current.body, atRevision),
    capturePatchState: (body, atRevision) => bodyTracking.capturePatchState(atRevision, body),
    reseed: reseedBody,
    setSession: (next) => { entryPartIndex.current.rebuild(next.body.entries, (entry) => entry.id); sessionRef.current = next; setSessionState(next); },
  }));
  const { saving, conflict, save, keepMine, takeTheirs } = saveState;
  useReseedOnReread(revision, dirty, () => {
    try { saveState.reseed(canonicalLorebook(entity, piece.id), revision); }
    catch { /* Keep the current draft when a reread is not a valid canonical lorebook. */ }
  });
  const entry = focusedEntry(session);
  const summary = loreSummary(session.body);
  const health = loreHealth(session.body);
  const bookEstimate = estimateBookTokens(session.body);
  const entryIndex = entry ? session.body.entries.findIndex((e) => e.id === entry.id) : -1;

  const healFindings = useMemo(() => {
    const original =
      isRecord(entity) && isRecord(entity.original) ? entity.original : undefined;
    return findingsFromHealNotes(healNotesFromOriginal(original));
  }, [entity]);

  const healthByEntryMap = useMemo(() => healthByEntry(session.body), [session.body]);

  const setWriteFor = (p: LoreWriteForProfile): void => {
    setWriteForState(p);
    ctx.prefs.set(WRITE_FOR_PREF, p);
  };

  const flip = (dir: -1 | 1): void => setSession((s) => stepEntry(s, dir));

  const doSave = useCallback(async (intent: "manual" | "autosave" = "manual"): Promise<boolean> => {
    if (!dirty) return true;
    const name = session.body.name.trim();
    if (!name) {
      ctx.setStatus("a name is required before saving");
      return false;
    }
    return save(intent);
  }, [dirty, session.body.name, ctx, save]);

  // Empty names cannot be saved; skip autosave to avoid a false failure status.
  useEditorGuards(ctx, piece, dirty, doSave, session.body.name.trim().length > 0, saveState.autosave);

  useEditorKeys((e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    if (isTypingTarget(e.target)) return;
    const redo = key === "y" || (key === "z" && e.shiftKey);
    if (redo ? !bodyTracking.history.canRedo : !bodyTracking.history.canUndo) return;
    e.preventDefault();
    const change = redo ? bodyTracking.history.redo() : bodyTracking.history.undo();
    if (!change) return;
    setSession(() => applyLoreHistory(sessionRef.current, change, piece.id), change.touch, false);
    ctx.setStatus(redo ? "redid last lorebook change" : "undid last lorebook change");
  });

  useEffect(() => {
    ctx.setStatus(loreStatusLine(summary, health.filter((h) => h.level === "warn").length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.entryCount, summary.enabledCount, summary.keyCount, health.length]);

  const monogram = (session.body.name.trim().charAt(0) || "?").toUpperCase();
  const tocProps = {
    bookId: piece.id,
    searchRevision: revisionRef.current,
    draftChanged: dirty,
    search: ctx.api.search,
    entries: session.body.entries,
    focusedId: session.focusedId,
    writeFor,
    styles,
    categories: session.body.categories ?? [],
    healthByEntry: healthByEntryMap,
    onSelect: (id: string) => setSession((s) => selectEntry(s, id)),
    onAdd: () => setSession((s) => addEntry(s)),
    onPatch: (id: string, patch: Parameters<typeof updateEntry>[2]) =>
      setSession((s) => updateEntry(s, id, patch), loreEntryTouch(id, entryPartIndex.current)),
    onDuplicate: (id: string) => setSession((s) => duplicateEntry(s, id)),
    onDelete: (id: string) => setSession((s) => deleteEntry(s, id)),
    onReorder: (id: string, toIndex: number) =>
      setSession((s) => reorderEntry(s, id, toIndex)),
    selectMode,
    onSelectMode: (on: boolean) => {
      setSelectMode(on);
      if (!on) setPicked(new Set());
    },
    picked,
    onTogglePick: (id: string) => setPicked((prev) => new Set(prev.has(id) ? [...prev].filter((x) => x !== id) : [...prev, id])),
    onBulkEnable: (on: boolean) => {
      const ids = [...picked];
      setSession((s) => setEntriesEnabled(s, ids, on));
    },
    onBulkDelete: () => {
      const ids = [...picked];
      setSession((s) => deleteEntries(s, ids));
      setPicked(new Set());
    },
    onClearPick: () => setPicked(new Set()),
    onBulkMove: () => {
      if (picked.size === 0) return;
      setWorkshop({
        mode: "split",
        source: piece,
        seedMovedIds: [...picked],
      });
    },
    onOpenBeside: (id: string) => {
      ctx.workbench.openBeside({
        ...piece,
        params: { focusEntry: id },
      });
    },
  };
  const tocNode = folders.folderLens ? <MarinaraFolderToc {...folders.folderProps} /> : <LoreEntryToc {...tocProps} />;
  /** the same contents under a theme frame: choosing an entry or folder moves to the page section */
  const toPage = <A extends unknown[]>(pick: (...args: A) => void) => (...args: A): void => { pick(...args); setSection("page"); };
  const framedToc = folders.folderLens
    ? <MarinaraFolderToc {...folders.folderProps} onSelectEntry={toPage(folders.folderProps.onSelectEntry)} onSelectFolder={toPage(folders.folderProps.onSelectFolder)} />
    : <LoreEntryToc {...tocProps} onSelect={toPage(tocProps.onSelect)} />;
  const pageNode = (
    <>
      {view === "cards" ? (
        <CardsView
          entries={session.body.entries}
          writeFor={writeFor}
          onSelect={(id) => {
            setSession((s) => selectEntry(s, id));
            setView("pages");
          }}
          onPatch={(id, patch) => setSession((s) => updateEntry(s, id, patch), loreEntryTouch(id, entryPartIndex.current))}
          onAdd={() => setSession((s) => addEntry(s))}
        />
      ) : view === "web" ? (
        <WebView
          body={session.body}
          onSelect={(id) => {
            setSession((s) => selectEntry(s, id));
            setView("pages");
          }}
          onFallbackCards={() => setView("cards")}
        />
      ) : folders.folderLens && folders.inspectorProps ? (
        <FolderInspector {...folders.inspectorProps} />
      ) : !entry ? (
        <div className={styles.empty}>The book is empty. Add an entry from the contents.</div>
      ) : (
        <LoreEntryPage
          entry={entry}
          writeFor={writeFor}
          styles={styles}
          index={entryIndex}
          count={session.body.entries.length}
          onPrev={() => flip(-1)}
          onNext={() => flip(1)}
          tokenEstimate={estimateEntryTokens(entry)}
          onPatch={(patch) => setSession((s) => updateEntry(s, entry.id, patch), loreEntryTouch(entry.id, entryPartIndex.current))}
          prefs={ctx.prefs}
        />
      )}
    </>
  );
  const binderSide = (
    <BinderSide
      sidePane={sidePane}
      setSidePane={setSidePane}
      body={session.body}
      baseline={importBaseline}
      entry={entry}
      notes={health.filter((h) => (entry ? h.entryId === entry.id : false))}
      styles={styles}
      setSession={setSession}
      extraFindings={healFindings}
    />
  );
  const tools = useRail(binderSide, "Tools");
  return (
    <div
      className={styles.root}
      style={accentVars(piece.accent) as CSSProperties | undefined}
    >
      <EditorEhead
        mark={monogram}
        name={session.body.name || "Untitled lorebook"}
        meta={
          <>
            {summary.entryCount} {summary.entryCount === 1 ? "entry" : "entries"} · ~{bookEstimate}
            {session.body.tokenBudget > 0 ? ` / ${session.body.tokenBudget}` : ""} tok ·{" "}
            <button type="button" className={styles.rulesLink} onClick={() => setRulesOpen(true)}>
              book rules
            </button>
          </>
        }
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        topRight={topRight}
      >
        <span className={styles.viewSwitch} role="group" aria-label="Binder view">
          {(
            [
              ["pages", "Pages"],
              ["cards", "Cards"],
              ["web", "Web"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={view === id ? `${styles.viewBtn} ${styles.viewBtnOn}` : styles.viewBtn}
              aria-pressed={view === id}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </span>
        <select
          className={styles.lensSel}
          value={writeFor}
          aria-label="Writing for one host"
          onChange={(ev) => setWriteFor(parseWriteFor(ev.target.value))}
        >
          {LORE_WRITE_FOR_PROFILES.map((p) => (
            <option key={p} value={p}>
              Writing for: {LORE_WRITE_FOR_LABELS[p]}
            </option>
          ))}
        </select>
      </EditorEhead>
      {conflict && <EditorConflict what="lorebook" onTakeTheirs={() => void takeTheirs()} onKeepMine={() => void keepMine()} />}

      {framed ? (
        <div className={f.host}>
          <EditorLayout label="Lorebook sections" rail={tools.rail} active={section} onActiveChange={setSection} sections={[
            { id: "contents", title: "Contents", filled: session.body.entries.length > 0, node: <div className={f.bounded}>{framedToc}</div> },
            { id: "page", title: view === "pages" ? "Entry" : view === "cards" ? "Cards" : "Web", filled: entry !== null, node: pageNode },
            ...tools.tail,
          ]} />
        </div>
      ) : (
        <>
        <div className={styles.mBar}>
          <button type="button" className={styles.mContents} onClick={() => setTocOpen(true)}>
            &#9776; Contents
          </button>
          <span className={styles.mPageNo}>
            {entry ? `${entryIndex + 1} / ${session.body.entries.length}` : "empty"}
          </span>
          <button type="button" className={styles.mPg} aria-label="Previous entry" disabled={!entry || entryIndex <= 0} onClick={() => flip(-1)}>
            &#8249;
          </button>
          <button type="button" className={styles.mPg} aria-label="Next entry" disabled={!entry || entryIndex >= session.body.entries.length - 1} onClick={() => flip(1)}>
            &#8250;
          </button>
        </div>

        <div className={styles.cols}>
          <div className={styles.tocCol}>
            {tocNode}
          </div>

          <main className={styles.pageCol}>
            {pageNode}
          </main>
          {binderSide}
        </div>
        </>
      )}

      {tocOpen && (
        <div className={styles.mGate}>
          <BottomSheet title="Contents" onDismiss={() => setTocOpen(false)}>
            {folders.folderLens ? (
              <MarinaraFolderToc
                {...folders.folderProps}
                onSelectEntry={(id) => {
                  folders.folderProps.onSelectEntry(id);
                  setTocOpen(false);
                }}
                onSelectFolder={(id) => {
                  folders.folderProps.onSelectFolder(id);
                  setTocOpen(false);
                }}
              />
            ) : (
              <LoreEntryToc
                {...tocProps}
                onSelect={(id) => {
                  tocProps.onSelect(id);
                  setTocOpen(false);
                }}
              />
            )}
          </BottomSheet>
        </div>
      )}

      {rulesOpen && (
        <InkDialog onDismiss={() => setRulesOpen(false)} ariaLabel="Book rules">
          <div className={styles.rulesSheet}>
            <div className={styles.rulesHead}>
              <b>Book rules</b>
              <i>name · description · matching defaults · budget</i>
              <button
                type="button"
                className={styles.pgBtn}
                aria-label="Close book rules"
                onClick={() => setRulesOpen(false)}
              >
                &times;
              </button>
            </div>
            <LoreBookSettings
              body={session.body}
              styles={styles}
              onBook={(patch) => {
                const keys = Object.keys(patch) as (keyof LorebookBody)[];
                setSession((s) => updateBook(s, patch), loreFieldsTouch(keys));
              }}
            />
          </div>
        </InkDialog>
      )}

      {workshop && (
        <LoreWorkshopDialog
          ctx={ctx}
          state={workshop}
          onDismiss={() => setWorkshop(null)}
          onDone={() => {
            setWorkshop(null);
            setPicked(new Set());
            setSelectMode(false);
            void (async () => {
              try {
                const loaded = await readLoreLight(ctx, piece.id);
                revisionRef.current = loaded.revision;
                saveState.reseed(canonicalLorebook(loaded.entity, piece.id), loaded.revision);
                ctx.setStatus("book updated after split");
              } catch (e) {
                ctx.setStatus(toErrorMessage(e, "reload failed"));
              }
            })();
          }}
        />
      )}
    </div>
  );
}
