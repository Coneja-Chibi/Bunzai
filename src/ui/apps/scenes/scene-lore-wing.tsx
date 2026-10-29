/**
 * The World wing's Lorebook tab: RoleCall's LorebookPanel on Bunzai's library, drawn to its
 * layout (scene-lore-books.tsx, scene-lore-entries.tsx, scene-lore-entry.tsx). Switching a book
 * on/off, adding one, or removing one this scene added is this scene's own choice (ChatStore rule 20)
 * and saves at once through use-scene-lore.ts, the one writer the Control Booth shares, one write
 * after another so a fast second click is never overtaken by a slow first one.
 *
 * The open book is read with getLightEditableEntity (no escrow) and every entry edit lands in it at
 * once, then saves as a send-only-changed patch: the entry that changed, or the swapped pair for
 * Move, never the book. Typed edits wait two seconds after the last keystroke and flush when the
 * entry or the wing closes; the row menu's actions and "New entry" save straight away. They all share
 * one queue and the book's revision (one session per book, lore-book-sessions.ts, so books shown together never share either), so a fast second action is never lost and a 409 reloads the
 * book. A typed edit is saved as an autosave; a delete, move, toggle or add is a manual save, so the
 * library keeps a version to recover from. The server routes are D4's; this wing never writes to src/core.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { LorebookEntry } from "../../../entities/lorebook/schema";
import type { Chat } from "../../../stage/contracts/chat-store";
import { emptyLoreEntry } from "../../../core/lore";
import { createBlank } from "../../_shared/new-piece";
import { Ic } from "../../_shared/ic";
import { newUiId } from "../../_shared/new-id";
import { toErrorMessage } from "../../_shared/error-message";
import { useDebouncedSave } from "../../_shared/use-debounced-value";
import type { SceneLoreBook } from "../../app-contract-scenes";
import { entryTokens, groupNamesOf, moveEntry, nextSortOrder, statLine } from "./lore-core";
import { useSceneLore } from "./use-scene-lore";
import { createLoreBookSessions, type LoreBookSessions, type LoreBookState } from "./lore-book-sessions";
import { AddPopover, BookList, LibraryPicker, LoreHeader, PickHint } from "./scene-lore-books";
import { DeleteEntryDialog, DetailHint, EntriesPanel } from "./scene-lore-entries";
import { EntryEditor } from "./scene-lore-entry";
import { IconButton } from "../../components/button";

type Note = { kind: "saved" | "stale" | "failed"; text: string };
const ADV_KEY = "scenes.loreAdvanced";
type EntryPick = { id: string; bookId: string | null };
type DeleteTarget = { id: string; bookId: string };
const NOT_LOADED: LoreBookState = { state: "none" };

/** The Lorebook wing's whole behavior: the scene's books, each shown book's own session (load, accepted base, save queue), the entry writers. The Messenger's Lorebooks panel calls this same hook, so both layouts share one writer. */
export function useLoreWing(ctx: AppContext, chat: Chat, onLore: (books: SceneLoreBook[] | null) => void) {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [entrySel, setEntrySel] = useState<EntryPick | null>(null);
  const [states, setStates] = useState<Record<string, LoreBookState>>({});
  /** Books the Messenger list shows all at once; Full Chat leaves it empty and shows only the selected book. */
  const [retained, setRetained] = useState<string[]>([]);
  const [entryQuery, setEntryQuery] = useState("");
  const [entryNote, setEntryNote] = useState<Note | null>(null);
  const [picking, setPicking] = useState<"none" | "pane" | "popover">("none");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(() => ctx.prefs.get(ADV_KEY) === true);
  const [saving, setSaving] = useState(0);

  const api = useRef(ctx.api);
  api.current = ctx.api;
  const setStatus = useRef(ctx.setStatus);
  setStatus.current = ctx.setStatus;
  const onLoreRef = useRef(onLore);
  onLoreRef.current = onLore;
  const selectedRef = useRef(selectedBookId);
  selectedRef.current = selectedBookId;
  const multiRef = useRef(false);
  multiRef.current = retained.length > 0;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /** One session per shown book: no two books share a load, a revision, an accepted base or a save queue. */
  const sessionsRef = useRef<LoreBookSessions | null>(null);
  sessionsRef.current ??= createLoreBookSessions({
    api: () => api.current,
    alive: () => mounted.current,
    onState: (id, state) => setStates((prev) => ({ ...prev, [id]: state })),
    onSaving: (delta) => setSaving((n) => n + delta),
    onStale: () => setEntryNote({ kind: "stale", text: "This book changed somewhere else first, so the edit was not saved. The latest entry is loaded; edit it again to save." }),
    onError: (_id, message) => setStatus.current(`the change was not saved: ${message}`),
  });
  const sessions = sessionsRef.current;

  // -- loading the scene's lore -------------------------------------------------------------------

  const { lore, reload: loadLore, toggle, remove: removeFromScene, add } = useSceneLore(ctx, chat.id);
  useEffect(() => { onLoreRef.current(lore.state === "ready" ? lore.books : null); }, [lore]);

  // -- the shown books' entries ----------------------------------------------------------------------

  const retain = useCallback((ids: readonly string[]): void => {
    setRetained((prev) => (prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : [...ids]));
  }, []);
  const retainedKey = retained.join("\n");
  useEffect(() => {
    const keep = new Set(retained);
    if (selectedBookId) keep.add(selectedBookId);
    for (const id of keep) {
      const session = sessions.ensure(id);
      const at = session.state().state;
      if (at === "none" || at === "failed") void session.load();
    }
    const left = sessions.ids().filter((id) => !keep.has(id));
    if (left.length === 0) return;
    entrySaver.flush();
    for (const id of left) sessions.drop(id);
    void sessions.idle().then(() => {
      if (!mounted.current) return;
      const held = new Set(sessions.ids());
      setStates((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => held.has(id))));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `retained` is read through its key; sessions and entrySaver are stable
  }, [selectedBookId, retainedKey]);
  useEffect(() => {
    setEntrySel((s) => (s && s.bookId !== selectedBookId ? null : s));
    if (multiRef.current) return;
    setEntryQuery("");
    setEntryNote(null);
  }, [selectedBookId]);

  const bookLoaded: LoreBookState = (selectedBookId && states[selectedBookId]) || NOT_LOADED;
  const stateOf = useCallback((bookId: string | null): LoreBookState => (bookId && states[bookId]) || NOT_LOADED, [states]);
  const entriesOf = useCallback((bookId: string | null): LorebookEntry[] | null => {
    const s = stateOf(bookId);
    return s.state === "ready" ? s.entity.body.entries : null;
  }, [stateOf]);
  const selectedEntryId = entrySel && entrySel.bookId === selectedBookId ? entrySel.id : null;
  const setSelectedEntryId = useCallback((id: string | null): void => setEntrySel(id ? { id, bookId: selectedRef.current } : null), []);
  /** Opens one entry of one book (the list's rows): the book becomes the open one without reloading it. */
  const selectEntryIn = useCallback((bookId: string, id: string): void => {
    setSelectedBookId(bookId);
    setEntrySel({ id, bookId });
  }, []);

  /** Applies a change to a loaded book at once, then queues its own manual save (the dirty check is the patch itself: an unchanged entry sends nothing). */
  const applyEntries = useCallback((bookId: string | null, mutate: (entries: LorebookEntry[]) => LorebookEntry[]): void => {
    const session = bookId ? sessions.get(bookId) : undefined;
    if (session?.apply(mutate)) session.save(session.generation(), "manual");
  }, [sessions]);

  /** A typed edit is saved two seconds after the last keystroke, and when the wing closes with one still waiting. Every book edited since the last save goes in its own queue. */
  const dirty = useRef(new Map<string, number>());
  const entrySaver = useDebouncedSave<string>(() => {
    const todo = [...dirty.current];
    dirty.current.clear();
    for (const [bookId, gen] of todo) {
      const session = sessions.get(bookId);
      if (!session || gen !== session.generation()) continue;
      session.save(gen, "autosave", {
        onSaved: (entity) => setEntryNote({ kind: "saved", text: `Saved to ${entity.body.name}. Every scene reading this book uses the new text from its next turn.` }),
        onFailed: (message) => setEntryNote({ kind: "failed", text: `The edit was not saved: ${message}. It is still here to try again.` }),
      });
    }
  }, 2000);

  const editEntry = (id: string, patch: Partial<LorebookEntry>, bookId: string | null = selectedRef.current): void => {
    const session = bookId ? sessions.get(bookId) : undefined;
    if (!bookId || !session?.apply((entries) => entries.map((e) => (e.id === id ? { ...e, ...patch } : e)))) return;
    setEntryNote(null);
    dirty.current.set(bookId, session.generation());
    entrySaver.push(bookId);
  };

  // -- the row "..." menu and "New entry" -----------------------------------------------------------

  const addEntryTo = (bookId: string): void => {
    const cur = stateOf(bookId);
    if (cur.state !== "ready") return;
    const id = newUiId("entry_");
    // RoleCall's createEntry: "New Entry", selective, no keys, injected at depth 4.
    const fresh: LorebookEntry = { ...emptyLoreEntry(id), title: "New Entry", position: "depth", depth: 4, sortOrder: nextSortOrder(cur.entity.body.entries) };
    applyEntries(bookId, (entries) => [...entries, fresh]);
    setEntryQuery("");
    selectEntryIn(bookId, id);
  };
  const addEntry = (): void => { if (selectedRef.current) addEntryTo(selectedRef.current); };
  /** The row actions of one book's entries (null: the open book, read when the action runs). The objects are stable per book. */
  const openRef = useRef<(entryId?: string | null, bookId?: string | null) => void>(() => undefined);
  const actionCache = useRef(new Map<string | null, ReturnType<typeof makeActions>>());
  const makeActions = (bookId: string | null) => {
    const target = (): string | null => bookId ?? selectedRef.current;
    return {
      onSelect: (id: string): void => { const b = target(); if (b) selectEntryIn(b, id); },
      onToggleEnabled: (id: string): void => applyEntries(target(), (entries) => entries.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))),
      onMove: (id: string, direction: "up" | "down"): void => applyEntries(target(), (entries) => moveEntry(entries, id, direction)),
      onDeleteRequest: (id: string): void => { const b = target(); if (b) setDeleteTarget({ id, bookId: b }); },
      onOpenFull: (id: string): void => openRef.current(id, target()),
    };
  };
  const actionsFor = (bookId: string | null) => {
    let found = actionCache.current.get(bookId);
    if (!found) {
      found = makeActions(bookId);
      actionCache.current.set(bookId, found);
    }
    return found;
  };
  const actions = actionsFor(null);
  openRef.current = openInWorkbench;
  const setDeleteEntryId = (id: string | null): void => setDeleteTarget(id && selectedRef.current ? { id, bookId: selectedRef.current } : null);
  const deleteEntryId = deleteTarget?.id ?? null;
  const confirmDeleteEntry = (): void => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;
    applyEntries(target.bookId, (entries) => entries.filter((e) => e.id !== target.id));
    if (entrySel?.id === target.id && entrySel.bookId === target.bookId) setEntrySel(null);
  };

  /** Opens another book (or none): what is typed is saved first, so the next book's load cannot orphan it. */
  const openBook = async (id: string | null): Promise<void> => {
    entrySaver.flush();
    await sessions.idle();
    if (!mounted.current) return;
    setEntrySel(null);
    setSelectedBookId(id);
  };
  /** Back to the book list. */
  const leaveBook = (): Promise<void> => openBook(null);

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
      const summary = await createBlank(ctx, "lorebook", name);
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
  /** Opens a book in the Workbench, on `entryId` or else the entry open here; `bookId` defaults to the open book. */
  function openInWorkbench(entryId: string | null = selectedEntryId, bookId: string | null = selectedRef.current): void {
    const s = stateOf(bookId);
    if (s.state !== "ready") return;
    entrySaver.flush();
    ctx.workbench.open({ id: s.entity.id, kind: "lorebook", name: s.entity.body.name, ...(entryId ? { params: { focusEntry: entryId } } : {}) });
    ctx.openApp("workbench");
  }

  // -- render ------------------------------------------------------------------------------------

  const entries = bookLoaded.state === "ready" ? bookLoaded.entity.body.entries : null;
  const loadedTokens = useMemo(() => (entries ? entries.reduce((n, e) => n + entryTokens(e), 0) : 0), [entries]);
  const groups = useMemo(() => (entries ? groupNamesOf(entries) : []), [entries]);
  const candidates = useMemo(() => (entries ?? []).map((e) => ({ id: e.id, title: e.title })), [entries]);

  return {
    lore, loadLore, toggle, books, inScene, remove, pick, createBook, selectedBookId, setSelectedBookId, selectedEntryId, setSelectedEntryId, bookLoaded, entryQuery, setEntryQuery, entryNote, picking, setPicking,
    deleteEntryId, deleteBookId: deleteTarget?.bookId ?? null, setDeleteEntryId, library, advancedOpen, toggleAdvanced, saving, entries, loadedTokens, groups, candidates, actions, actionsFor, addEntry, addEntryTo,
    confirmDeleteEntry, openBook, leaveBook, openInWorkbench, entrySaver, editEntry, retain, stateOf, entriesOf, selectEntryIn,
  };
}

/** The Lorebook wing for Full Chat. */
export function LoreWing({ ctx, chat, characterName, onLore }: {
  ctx: AppContext;
  chat: Chat;
  /** The scene's cast character name, as the Cast wing reads it, for the "From <name>" line. */
  characterName: string;
  onLore(books: SceneLoreBook[] | null): void;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const {
    lore, loadLore, toggle, books, inScene, remove, pick, createBook, selectedBookId, setSelectedBookId, selectedEntryId, setSelectedEntryId, bookLoaded, entryQuery, setEntryQuery, entryNote, picking, setPicking,
    deleteEntryId, setDeleteEntryId, library, advancedOpen, toggleAdvanced, saving, entries, loadedTokens, groups, candidates, actions, addEntry, confirmDeleteEntry, leaveBook,
    openInWorkbench, entrySaver, editEntry,
  } = useLoreWing(ctx, chat, onLore);

  if (lore.state === "loading") return <div className="wbody pp"><div className="ed-empty">Loading the scene&apos;s lorebooks...</div></div>;
  if (lore.state === "failed") {
    return (
      <div className="wbody pp">
        <header className="hero bad"><span className="hi"><Ic name="mdi:alert-octagon-outline" size={20} /></span><div><div className="eb">World Error</div><h2>Could not <em>load</em></h2><p>{lore.why}</p></div>
          <div className="hero-tools"><IconButton variant="quiet" size="sm" icon="lucide:refresh-cw" label="Try again" onClick={() => void loadLore()} /></div>
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
          saving={saving > 0} host={root} actions={actions} onAddEntry={addEntry} onOpenBook={() => openInWorkbench()}>
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
