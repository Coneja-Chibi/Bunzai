/**
 * The World wing's Lorebook tab: RoleCall's LorebookPanel on Bunraku's library, drawn to its
 * layout (scene-lore-books.tsx, scene-lore-entries.tsx, scene-lore-entry.tsx). Switching a book
 * on/off, adding one, or removing one this scene added is this scene's own choice (ChatStore rule 20)
 * and saves at once through use-scene-lore.ts, the one writer the Control Booth shares, one write
 * after another so a fast second click is never overtaken by a slow first one.
 *
 * The open book is read with getLightEditableEntity (no escrow) and every entry edit lands in it at
 * once, then saves as a send-only-changed patch: the entry that changed, or the swapped pair for
 * Move, never the book. Typed edits wait two seconds after the last keystroke and flush when the
 * entry or the wing closes; the row menu's actions and "New entry" save straight away. They all share
 * one queue and the book's revision, so a fast second action is never lost and a 409 reloads the
 * book. A typed edit is saved as an autosave; a delete, move, toggle or add is a manual save, so the
 * library keeps a version to recover from. The server routes are D4's; this wing never writes to src/core.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { LorebookBody, LorebookEntry } from "../../../entities/lorebook/schema";
import type { ParsedCanonicalEntity } from "../../../entities/runtime-schema";
import type { Chat } from "../../../stage/contracts/chat-store";
import { emptyLoreEntry } from "../../../core/lore";
import { ApiHttpError } from "../../_shared/api-fetch";
import { createLorebook } from "../../_shared/create-lorebook";
import { buildPiecePatch } from "../../_shared/editor-patch";
import { Ic } from "../../_shared/ic";
import { newUiId } from "../../_shared/new-id";
import { toErrorMessage } from "../../_shared/error-message";
import { useDebouncedSave } from "../../_shared/use-debounced-value";
import type { AsyncState } from "../../_shared/async-state";
import type { SceneLoreBook } from "../../app-contract-scenes";
import { entryTokens, groupNamesOf, moveEntry, nextSortOrder, statLine } from "./lore-core";
import { useSceneLore } from "./use-scene-lore";
import { AddPopover, BookList, LibraryPicker, LoreHeader, PickHint } from "./scene-lore-books";
import { DeleteEntryDialog, DetailHint, EntriesPanel } from "./scene-lore-entries";
import { EntryEditor } from "./scene-lore-entry";

type Entity = { kind: string; id: string; body: LorebookBody };
type Ready = { entity: Entity; revision: string };
type BookState = AsyncState<Ready, { state: "none" } | { state: "gone" }>;
type Note = { kind: "saved" | "stale" | "failed"; text: string };
type Intent = "manual" | "autosave";
const ADV_KEY = "scenes.loreAdvanced";

export function LoreWing({ ctx, chat, characterName, onLore }: {
  ctx: AppContext;
  chat: Chat;
  /** The scene's cast character name, as the Cast wing reads it, for the "From <name>" line. */
  characterName: string;
  onLore(books: SceneLoreBook[] | null): void;
}): JSX.Element {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [bookLoaded, setBookLoaded] = useState<BookState>({ state: "none" });
  const [entryQuery, setEntryQuery] = useState("");
  const [entryNote, setEntryNote] = useState<Note | null>(null);
  const [picking, setPicking] = useState<"none" | "pane" | "popover">("none");
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(() => ctx.prefs.get(ADV_KEY) === true);
  const [saving, setSaving] = useState(0);

  const root = useRef<HTMLDivElement>(null);
  const api = useRef(ctx.api);
  api.current = ctx.api;
  const setStatus = useRef(ctx.setStatus);
  setStatus.current = ctx.setStatus;
  const onLoreRef = useRef(onLore);
  onLoreRef.current = onLore;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const bookGeneration = useRef(0);
  const current = useRef<Ready | null>(null);
  /** What the library last accepted: the base every save's patch is measured against, so only what changed travels. */
  const accepted = useRef<Entity | null>(null);
  const entrySaveQueue = useRef(Promise.resolve());

  // -- loading the scene's lore -------------------------------------------------------------------

  const { lore, reload: loadLore, toggle, remove: removeFromScene, add } = useSceneLore(ctx, chat.id);
  useEffect(() => { onLoreRef.current(lore.state === "ready" ? lore.books : null); }, [lore]);

  // -- the open book's entries ----------------------------------------------------------------------

  const loadBook = useCallback(async (id: string | null) => {
    const mine = ++bookGeneration.current;
    current.current = null;
    accepted.current = null;
    if (!id) return setBookLoaded({ state: "none" });
    setBookLoaded({ state: "loading" });
    try {
      const found = await api.current.getLightEditableEntity(`kind=lorebook&id=${encodeURIComponent(id)}`);
      if (mine !== bookGeneration.current) return;
      const entity = found.entity as Entity;
      if (entity?.kind !== "lorebook") return setBookLoaded({ state: "gone" });
      current.current = { entity, revision: found.revision };
      accepted.current = entity;
      setBookLoaded({ state: "ready", ...current.current });
    } catch (e) {
      if (mine !== bookGeneration.current) return;
      setBookLoaded(e instanceof ApiHttpError && e.status === 404 ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, "the book could not be read") });
    }
  }, []);
  useEffect(() => {
    void loadBook(selectedBookId);
    setSelectedEntryId(null);
    setEntryQuery("");
    setEntryNote(null);
  }, [selectedBookId, loadBook]);

  // The one save queue: a debounced typed edit and every immediate action go through it. Each save is
  // sent for whatever `current.current` holds at ITS OWN turn (read fresh right before the request), so a
  // second action queued while the first is in flight is never lost: it was already folded into
  // `current.current` before its own save was queued, and a save's response only advances the revision.
  const queueEntitySave = useCallback((gen: number, intent: Intent, onSaved?: (entity: Entity) => void, onFailed?: (message: string) => void) => {
    setSaving((n) => n + 1);
    entrySaveQueue.current = entrySaveQueue.current.then(async () => {
      try {
        // Typed or clicked against a load the wing has since replaced: saving it would overwrite what came in.
        if (gen !== bookGeneration.current) return;
        const cur = current.current;
        const base = accepted.current;
        if (!cur || !base) return;
        // Only what differs from the accepted copy travels: one entry, or the swapped pair, never the book.
        const patch = buildPiecePatch(base as unknown as ParsedCanonicalEntity, cur.entity as unknown as ParsedCanonicalEntity);
        if (!patch.items && !patch.order) return; // nothing differs (typed back to what it was): nothing to save
        const saved = await api.current.patchEditedEntity("lorebook", cur.entity.id, cur.revision, patch, undefined, intent);
        if (!mounted.current || gen !== bookGeneration.current) return;
        accepted.current = cur.entity;
        current.current = { entity: current.current!.entity, revision: saved.revision };
        setBookLoaded({ state: "ready", ...current.current });
        onSaved?.(cur.entity);
      } catch (e) {
        if (!mounted.current) return;
        if (e instanceof ApiHttpError && e.status === 409) {
          if (gen !== bookGeneration.current) return;
          await loadBook(selectedBookId);
          setEntryNote({ kind: "stale", text: "This book changed somewhere else first, so the edit was not saved. The latest entry is loaded; edit it again to save." });
        } else {
          const message = toErrorMessage(e, "the library refused it");
          if (onFailed) onFailed(message);
          else setStatus.current(`the change was not saved: ${message}`);
        }
      } finally {
        if (mounted.current) setSaving((n) => n - 1);
      }
    });
  }, [loadBook, selectedBookId]);

  /** Applies a change to the loaded book at once (the dirty check is the patch itself: an unchanged entry sends nothing). */
  const applyNow = useCallback((mutate: (entries: LorebookEntry[]) => LorebookEntry[]): boolean => {
    const cur = current.current;
    if (!cur) return false;
    const nextEntries = mutate(cur.entity.body.entries);
    if (nextEntries === cur.entity.body.entries) return false;
    current.current = { entity: { ...cur.entity, body: { ...cur.entity.body, entries: nextEntries } }, revision: cur.revision };
    setBookLoaded({ state: "ready", ...current.current });
    return true;
  }, []);
  const applyEntries = useCallback((mutate: (entries: LorebookEntry[]) => LorebookEntry[]): void => {
    if (applyNow(mutate)) queueEntitySave(bookGeneration.current, "manual");
  }, [applyNow, queueEntitySave]);

  /** A typed edit is saved two seconds after the last keystroke, and when the wing closes with one still waiting. */
  const entrySaver = useDebouncedSave<number>((gen) => {
    if (gen !== bookGeneration.current) return;
    queueEntitySave(gen, "autosave",
      (entity) => setEntryNote({ kind: "saved", text: `Saved to ${entity.body.name}. Every scene reading this book uses the new text from its next turn.` }),
      (message) => setEntryNote({ kind: "failed", text: `The edit was not saved: ${message}. It is still here to try again.` }));
  }, 2000);

  const editEntry = (id: string, patch: Partial<LorebookEntry>): void => {
    if (!applyNow((entries) => entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))) return;
    setEntryNote(null);
    entrySaver.push(bookGeneration.current);
  };

  // -- the row "..." menu and "New entry" -----------------------------------------------------------

  const addEntry = (): void => {
    const cur = current.current;
    if (!cur) return;
    const id = newUiId("entry_");
    // RoleCall's createEntry: "New Entry", selective, no keys, injected at depth 4.
    const fresh: LorebookEntry = { ...emptyLoreEntry(id), title: "New Entry", position: "depth", depth: 4, sortOrder: nextSortOrder(cur.entity.body.entries) };
    applyEntries((entries) => [...entries, fresh]);
    setEntryQuery("");
    setSelectedEntryId(id);
  };
  const actions = useMemo(() => ({
    onSelect: setSelectedEntryId,
    onToggleEnabled: (id: string) => applyEntries((entries) => entries.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))),
    onMove: (id: string, direction: "up" | "down") => applyEntries((entries) => moveEntry(entries, id, direction)),
    onDeleteRequest: setDeleteEntryId,
  }), [applyEntries]);
  const confirmDeleteEntry = (): void => {
    const id = deleteEntryId;
    setDeleteEntryId(null);
    if (!id) return;
    applyEntries((entries) => entries.filter((e) => e.id !== id));
    if (selectedEntryId === id) setSelectedEntryId(null);
  };

  /** Back to the book list: what is typed is saved first, so the next book's load cannot orphan it. */
  const leaveBook = async (): Promise<void> => {
    entrySaver.flush();
    await entrySaveQueue.current;
    if (!mounted.current) return;
    setSelectedEntryId(null);
    setSelectedBookId(null);
  };

  // -- the scene's own book choice -------------------------------------------------------------------

  const books = useMemo(() => (lore.state === "ready" ? lore.books : []), [lore]);
  const inScene = useMemo(() => new Set(books.filter((b) => !b.missing).map((b) => b.id)), [books]);
  const remove = (b: SceneLoreBook) => {
    removeFromScene(b);
    if (selectedBookId === b.id) setSelectedBookId(null);
  };
  const pick = (id: string) => {
    add(id);
    setPicking("none");
    setSelectedBookId(id);
  };
  /** "+ New Lorebook": the same empty-book factory and save call as the Library's own "New lorebook", then added and opened here. */
  const createBook = async (name: string): Promise<void> => {
    try {
      const summary = await createLorebook(ctx, name);
      add(summary.id);
      setPicking("none");
      setSelectedBookId(summary.id);
    } catch (e) {
      ctx.setStatus(`could not create the lorebook: ${toErrorMessage(e, "the library refused it")}`);
    }
  };
  useEffect(() => {
    if (picking === "none") return;
    let live = true;
    api.current.listEntities("lorebook").then((list) => live && setLibrary(list)).catch(() => live && setLibrary([]));
    return () => { live = false; };
  }, [picking]);

  const toggleAdvanced = (): void => {
    setAdvancedOpen((open) => {
      ctx.prefs.set(ADV_KEY, !open);
      return !open;
    });
  };
  const openInWorkbench = (): void => {
    if (bookLoaded.state !== "ready") return;
    entrySaver.flush();
    ctx.workbench.open({ id: bookLoaded.entity.id, kind: "lorebook", name: bookLoaded.entity.body.name, ...(selectedEntryId ? { params: { focusEntry: selectedEntryId } } : {}) });
    ctx.openApp("workbench");
  };

  // -- render ------------------------------------------------------------------------------------

  const entries = bookLoaded.state === "ready" ? bookLoaded.entity.body.entries : null;
  const loadedTokens = useMemo(() => (entries ? entries.reduce((n, e) => n + entryTokens(e), 0) : 0), [entries]);
  const groups = useMemo(() => (entries ? groupNamesOf(entries) : []), [entries]);
  const candidates = useMemo(() => (entries ?? []).map((e) => ({ id: e.id, title: e.title })), [entries]);

  if (lore.state === "loading") return <div className="wbody pp"><div className="ed-empty">Loading the scene&apos;s lorebooks...</div></div>;
  if (lore.state === "failed") {
    return (
      <div className="wbody pp">
        <header className="hero bad"><span className="hi"><Ic name="mdi:alert-octagon-outline" size={20} /></span><div><div className="eb">World Error</div><h2>Could not <em>load</em></h2><p>{lore.why}</p></div>
          <div className="hero-tools"><button type="button" className="tbtn" title="Try again" onClick={() => void loadLore()}><Ic name="lucide:refresh-cw" size={14} /></button></div>
        </header>
      </div>
    );
  }

  const selectedBook = books.find((b) => b.id === selectedBookId && !b.missing) ?? null;
  const selectedEntry = entries?.find((e) => e.id === selectedEntryId) ?? null;
  const pop = picking === "popover" && (
    <AddPopover library={library} inScene={inScene} onPick={pick} onCreate={createBook} onClose={() => setPicking("none")} />
  );

  let header: JSX.Element;
  let body: JSX.Element;
  if (picking === "pane") {
    header = <LoreHeader title="Add Lorebook" onBack={() => setPicking("none")} />;
    body = <div className="wl-body"><LibraryPicker library={library} inScene={inScene} onPick={pick} /></div>;
  } else if (selectedBook) {
    header = <LoreHeader title={selectedBook.name} stats={statLine(entries ? { entries: entries.length, tokens: loadedTokens } : { entries: selectedBook.entries, tokens: selectedBook.tokens })} onBack={() => void leaveBook()} />;
    body = bookLoaded.state === "ready" && entries ? (
      <div className="wl-body">
        <EntriesPanel entries={entries} selectedId={selectedEntry?.id ?? null} query={entryQuery} onQuery={setEntryQuery} bookId={selectedBook.id} lastTurn={lore.lastTurn}
          saving={saving > 0} host={root} actions={actions} onAddEntry={addEntry} onOpenBook={openInWorkbench}>
          {selectedEntry ? (
            <EntryEditor entry={selectedEntry} globalScanDepth={bookLoaded.entity.body.globalScanDepth} boostCandidates={candidates} groups={groups} advancedOpen={advancedOpen} onToggleAdvanced={toggleAdvanced}
              note={entryNote} onPatch={(patch) => editEntry(selectedEntry.id, patch)} onClose={() => { entrySaver.flush(); setSelectedEntryId(null); }} />
          ) : <DetailHint empty={entries.length === 0} onAdd={addEntry} />}
        </EntriesPanel>
      </div>
    ) : (
      <div className="wl-body"><div className="wl-hint"><div><b>
        {bookLoaded.state === "loading" ? "Loading the book..." : bookLoaded.state === "gone" ? "This book is no longer in your library." : bookLoaded.state === "failed" ? bookLoaded.why : "Choose a book"}
      </b></div></div></div>
    );
  } else {
    header = <LoreHeader title="World Info" stats={statLine({ books: books.length, entries: books.reduce((n, b) => n + b.entries, 0), tokens: books.reduce((n, b) => n + b.tokens, 0) })} onLibrary={() => setPicking("pane")} />;
    body = (
      <div className="wl-body">
        <BookList books={books} characterName={characterName} selectedId={selectedBookId} onSelect={(b) => setSelectedBookId(b.id)}
          onToggle={toggle} onRemove={remove} onAdd={() => setPicking(picking === "popover" ? "none" : "popover")} lastTurn={lore.lastTurn} />
        <PickHint hasBooks={books.length > 0} />
      </div>
    );
  }

  return (
    <div className="wbody pp">
      <div className="wl" data-panel="lorebook" ref={root} data-part="scene.world">
        {header}
        {body}
        {pop}
        {deleteEntryId && (
          <DeleteEntryDialog title={entries?.find((e) => e.id === deleteEntryId)?.title ?? ""} onCancel={() => setDeleteEntryId(null)} onConfirm={confirmDeleteEntry} />
        )}
      </div>
    </div>
  );
}
