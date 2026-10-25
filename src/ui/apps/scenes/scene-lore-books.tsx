/**
 * The World wing's header, Active lorebooks column, empty hints, and the two ways to add a book
 * (RoleCall's LorebookPanel: the compact header, LorebookListItem, the dashed Add Lorebook button's
 * 280px popover with its "+ New Lorebook" row, and the header's full-pane picker). The library list
 * is the Library's own (`listEntities`), already carrying each book's entry count on its summary, so
 * no row costs a book read; RoleCall's Plotlight search and Fork have nothing to talk to here.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import type { SceneLoreBook, SceneLoreFired } from "../../app-contract-scenes";
import { Ic } from "../../_shared/ic";
import { isEscapeClose, useEscapeKey } from "../../_shared/use-escape-key";
import { footerLine, sourceBadge } from "./lore-core";

export function LoreHeader({ title, stats, onBack, onLibrary }: {
  title: string;
  stats?: string;
  /** Present with a book open or in the picker. */
  onBack?(): void;
  /** Present only while browsing: the header's library button. */
  onLibrary?(): void;
}): JSX.Element {
  return (
    <header className="wl-hd">
      {onBack && <button type="button" className="wl-sq" title="Back to lorebooks" aria-label="Back to lorebooks" onClick={onBack}><Ic name="lucide:chevron-left" size={16} /></button>}
      <span className="wl-ic"><Ic name="lucide:book" size={16} /></span>
      <div className="wl-tt"><span className="wl-t">{title}</span>{stats && <span className="wl-st">{stats}</span>}</div>
      {onLibrary && <button type="button" className="wl-sq" title="Browse / add lorebooks" aria-label="Browse / add lorebooks" onClick={onLibrary}><Ic name="lucide:book" size={16} /></button>}
    </header>
  );
}

type LastTurn = { fired: SceneLoreFired[]; totalTokens: number } | null;

export function LastTurnFoot({ lastTurn }: { lastTurn: LastTurn }): JSX.Element | null {
  if (!lastTurn) return null;
  return (
    <div className="wl-foot"><span>Last turn</span><b>{footerLine(lastTurn)}</b>
      <span className="wl-q" title="From the last reply's trace: which entries went into the prompt and why.">?</span></div>
  );
}

export function BookList({ books, characterName, selectedId, onSelect, onToggle, onRemove, onAdd, lastTurn }: {
  books: readonly SceneLoreBook[];
  characterName: string;
  selectedId: string | null;
  onSelect(book: SceneLoreBook): void;
  onToggle(book: SceneLoreBook): void;
  onRemove(book: SceneLoreBook): void;
  onAdd(): void;
  lastTurn: LastTurn;
}): JSX.Element {
  return (
    <aside className="wl-books" data-part="scene.world.books">
      <div className="wl-bh"><span>Active lorebooks</span><span>{books.length}</span></div>
      <div className="wl-bl">
        {books.map((b) => {
          const sel = b.id === selectedId;
          return (
            <div key={b.id} className={`wl-bk${sel ? " sel" : ""}${b.enabled ? "" : " off"}${b.missing ? " missing" : ""}`} onClick={() => !b.missing && onSelect(b)}>
              <div className="wl-bk-r">
                <i className={`dot${b.enabled ? " on" : ""}`} />
                <span className="wl-bn">{b.name}</span>
                <span className="wl-bc">{b.entries}</span>
              </div>
              <div className="wl-by">{b.missing ? "Not in your library" : sourceBadge(b, characterName)}</div>
              <div className="wl-act">
                <button type="button" className={`wl-ab${b.enabled ? " on" : ""}`} title={b.enabled ? "Disable" : "Enable"} aria-label={`${b.enabled ? "Disable" : "Enable"} ${b.name}`}
                  onClick={(e) => { e.stopPropagation(); onToggle(b); }}><Ic name="lucide:power" size={12} /></button>
                {b.source === "scene" && (
                  <button type="button" className="wl-ab red" title="Remove from this scene" aria-label={`Remove ${b.name} from this scene`}
                    onClick={(e) => { e.stopPropagation(); onRemove(b); }}><Ic name="lucide:trash-2" size={12} /></button>
                )}
              </div>
            </div>
          );
        })}
        {books.length === 0 && (
          <div className="wl-none"><span className="box"><Ic name="lucide:book" size={24} /></span><b>No lorebooks</b><small>Add one to begin</small></div>
        )}
      </div>
      <LastTurnFoot lastTurn={lastTurn} />
      <div className="wl-addf"><button type="button" className="wl-add" title="Add Lorebook" onClick={onAdd}><Ic name="lucide:plus" size={14} />Add Lorebook</button></div>
    </aside>
  );
}

/** The right pane while no book is open. */
export function PickHint({ hasBooks }: { hasBooks: boolean }): JSX.Element {
  return (
    <div className="wl-hint"><div>
      <span className="box"><Ic name="lucide:book" size={24} /></span>
      <b>{hasBooks ? "Pick a lorebook" : "No lorebooks linked"}</b>
      <small>{hasBooks ? "Choose one on the left to edit its entries" : "Use the library icon to add one"}</small>
    </div></div>
  );
}

/** My Library, searchable. A book the scene already reads is listed but cannot be added twice. */
export function LibraryPicker({ library, inScene, onPick }: {
  library: StudioEntitySummary[] | null;
  inScene: ReadonlySet<string>;
  onPick(id: string): void;
}): JSX.Element {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = (library ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  return (
    <div className="wl-lib">
      <div className="wl-ls"><label><Ic name="lucide:search" size={14} /><input value={query} placeholder="Search my library..." aria-label="Search my library" onChange={(e) => setQuery(e.target.value)} /></label></div>
      <div className="scroll">
        <div className="wl-lh">My Library ({shown.length})</div>
        {library === null && <div className="wl-none"><small>Loading...</small></div>}
        {library !== null && shown.length === 0 && (
          <div className="wl-none"><span className="box"><Ic name="lucide:book" size={20} /></span><b>{q ? "No lorebooks match your search" : "No lorebooks found"}</b><small>{q ? "Try different keywords" : "Create one in your library"}</small></div>
        )}
        {shown.map((s) => {
          const already = inScene.has(s.id);
          const count = s.facts?.lore?.entryCount;
          const sub = [count === undefined ? null : `${count} ${count === 1 ? "entry" : "entries"}`, already ? "In this scene" : null].filter(Boolean).join(" · ");
          return (
            <button type="button" key={s.id} className="wl-lr" disabled={already} onClick={() => onPick(s.id)}>
              <span className="ico"><Ic name="lucide:book" size={16} /></span>
              <span className="tx"><b>{s.name}</b>{sub && <small>{sub}</small>}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The dashed button's popover: "+ New Lorebook" (name it first, then Create) over the library list. */
export function AddPopover({ library, inScene, onPick, onCreate, onClose }: {
  library: StudioEntitySummary[] | null;
  inScene: ReadonlySet<string>;
  onPick(id: string): void;
  onCreate(name: string): Promise<void>;
  onClose(): void;
}): JSX.Element {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(onClose, true);
  useEffect(() => {
    const press = (ev: PointerEvent): void => {
      const t = ev.target;
      if (t instanceof Element && !ref.current?.contains(t) && !t.closest(".wl-add")) onClose();
    };
    document.addEventListener("pointerdown", press);
    return () => document.removeEventListener("pointerdown", press);
  }, [onClose]);
  const create = (): void => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    void onCreate(trimmed).finally(() => setBusy(false));
  };
  const cancel = (): void => { setNaming(false); setName(""); };
  return (
    <div className="wl-pop" ref={ref}>
      <div className="wl-new">
        {naming ? (
          <div className="nm">
            <input autoFocus value={name} maxLength={255} disabled={busy} placeholder="Name your new lorebook..." aria-label="New lorebook name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); create(); } else if (isEscapeClose(e)) { e.preventDefault(); cancel(); } }} />
            <div className="row">
              <button type="button" disabled={busy || !name.trim()} onClick={create}><Ic name={busy ? "lucide:loader-circle" : "lucide:plus"} size={12} />{busy ? "Creating..." : "Create"}</button>
              <button type="button" disabled={busy} onClick={cancel}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => { setName(""); setNaming(true); }}><Ic name="lucide:plus" size={14} />+ New Lorebook</button>
        )}
      </div>
      <LibraryPicker library={library} inScene={inScene} onPick={onPick} />
    </div>
  );
}
