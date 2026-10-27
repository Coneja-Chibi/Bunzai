/**
 * Deck view: SHELF - lorebook spine cards (vs-lore-shelf). Enable switch, drag-merge target,
 * kebab via context menu. Non-lore decks still render as monogram spines.
 */
import { useEffect, useState, type CSSProperties, type DragEvent, type JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { pieceColor } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";
import { searchAllPages } from "../search-runner";
import { plural } from "../../../../core/text";
import { icSvg } from "../../../_shared/ic-svg";
import { QueuedPiecePreview } from "../piece-preview";
import { Button, Toggle } from "../../../components/button";
import { VirtualShelf } from "../../../_shared/virtual-list";

const CSS = `
.dv-shelfscroll{flex:1;min-height:0;overflow-y:auto;padding:.375rem .5rem .75rem}
.dv-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(15rem,100%),1fr));gap:1.375rem;position:relative}
/* a book: hard frame, a striped deck-colored spine, lift on hover; staged takes the deck border and shadow */
.dv-book{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;min-height:8.5rem;
  background:var(--glass);border:3px solid var(--stage-black);box-shadow:5px 5px 0 var(--stage-black);transition:transform .25s ease,box-shadow .25s ease;--spine:var(--a)}
.dv-book:hover{transform:translateY(-5px);box-shadow:5px 5px 0 var(--stage-black),var(--glow)}
.dv-book .spine{position:absolute;left:0;top:0;bottom:0;width:1.125rem;border-right:3px solid var(--stage-black);
  background:repeating-linear-gradient(180deg,color-mix(in srgb,var(--spine) 70%,var(--stage-black)) 0 14px,color-mix(in srgb,var(--spine) 50%,var(--stage-black)) 14px 16px)}
.dv-book .body{flex:1;padding:.875rem .875rem .5rem 1.875rem;display:flex;flex-direction:column;gap:.375rem}
.dv-book .nm{display:block;width:100%;text-align:left}
.dv-book .nm:focus-visible{outline:2px solid var(--a);outline-offset:2px}
.dv-book .nm{font:700 1.0625rem/1.2 var(--font-fancy);color:var(--text);overflow-wrap:anywhere}
/* the name is the card's one control, a family link button: dressed as the book's Cinzel title, not a link */
.dv-book [data-part="library.shelf.name"]{display:block;width:100%;min-height:0;padding:0;border:0;background:none;box-shadow:none;text-align:left;text-decoration:none;font:700 1.0625rem/1.2 var(--font-fancy);letter-spacing:.01em;color:var(--text);overflow-wrap:anywhere}
.dv-book [data-part="library.shelf.name"]:hover{color:color-mix(in srgb,var(--a) 45%,var(--text))}
.dv-book .meta{font:var(--text-meta) var(--font-ui);color:var(--text-faint)}
.dv-book .foot{display:flex;align-items:center;gap:.5rem;padding:0 .875rem .75rem 1.875rem;font-size:.8125rem;color:var(--text-dim)}
.dv-book.cast{outline:1px solid var(--premiere-gold);outline-offset:3px}
.dv-book.pick{border-color:var(--a);box-shadow:5px 5px 0 var(--a)}
.dv-book.off .nm{text-decoration:line-through;color:var(--text-faint)}
.dv-book.off{filter:saturate(.55)}
.dv-book.drop{outline:3px dashed var(--a);outline-offset:2px}
.dv-book .tick{position:absolute;top:.5rem;right:.5rem;padding:.125rem .5rem;background:var(--premiere-gold);color:var(--stage-ink);font:600 var(--text-meta) var(--font-ui);border:2px solid var(--stage-black)}
.dv-book .dropTag{position:absolute;left:.5rem;right:.5rem;bottom:.4rem;font:600 var(--text-meta) var(--font-ui);color:var(--stage-ink);background:var(--a);border:2px solid var(--stage-black);padding:.2rem .3rem;text-align:center}
.dv-trash{position:sticky;bottom:.5rem;margin:0 auto;max-width:14rem;border:2px dashed var(--stage-danger-edge);color:var(--stage-danger-text);font:600 var(--text-meta) var(--font-ui);padding:.55rem;text-align:center;background:var(--stage-danger-bg);opacity:0;pointer-events:none}
.dv-trash.show{opacity:1;pointer-events:auto}
`;

const DRAG_MIME = "application/x-vaude-lore-id";

function BookCard({
  ctx,
  e,
  draggingId,
  setDraggingId,
}: {
  ctx: DeckViewContext;
  e: StudioEntitySummary;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}): JSX.Element {
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const lore = ctx.loreShelf;
  const enabled = lore ? lore.enabledOf(e) : true;
  const count = lore?.entryCountOf(e);
  const [over, setOver] = useState(false);
  const menuRef = ctx.menus.useContextMenu(() => ({
    type: "entity",
    label: e.name,
    data: e,
  }));
  const accent = pieceColor(e);
  const fmt = ctx.sourceLabel(e);

  const onDragStart = (ev: DragEvent): void => {
    if (e.kind !== "lorebook") return;
    ev.dataTransfer.setData(DRAG_MIME, e.id);
    ev.dataTransfer.effectAllowed = "copyMove";
    setDraggingId(e.id);
  };

  const onDragOver = (ev: DragEvent): void => {
    if (e.kind !== "lorebook" || !draggingId || draggingId === e.id) return;
    ev.preventDefault();
    setOver(true);
  };

  const onDrop = (ev: DragEvent): void => {
    ev.preventDefault();
    setOver(false);
    const fromId = ev.dataTransfer.getData(DRAG_MIME);
    if (!fromId || fromId === e.id || !lore) return;
    const from = ctx.entities.find((x) => x.id === fromId && x.kind === "lorebook");
    if (from) lore.onMerge(e, from);
    setDraggingId(null);
  };

  return (
    <div
      ref={menuRef}
      data-pick={pieceKey(e)}
      draggable={e.kind === "lorebook"}
      className={`dv-book${isOpen ? " cast" : ""}${staged ? " pick" : ""}${
        enabled ? "" : " off"
      }${over ? " drop" : ""}`}
      style={{ "--a": accent, "--spine": accent } as CSSProperties}
      title={isOpen ? `${e.name} is open on the Workbench` : `Stage ${e.name}`}
      onClick={() => ctx.onPiece(e)}
      onDragStart={onDragStart}
      onDragEnd={() => setDraggingId(null)}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <span className="spine" aria-hidden="true" />
      <div className="body">
        {/* The NAME is the card's one keyboard control, so the switch, Split, and Copy are never
            buttons nested inside another button; its click bubbles to the card's own handler. */}
        <Button variant="link" data-part="library.shelf.name" aria-pressed={staged}>{e.name || "(unnamed)"}</Button>
        <div className="meta">
          {typeof count === "number"
            ? plural(count, "entry", "entries")
            : e.kind}
        </div>
        {fmt && <span className="meta">{fmt}</span>}
        {ctx.peeks && <QueuedPiecePreview e={e} queue={ctx.peeks} ctx={ctx} />}
      </div>
      {lore && e.kind === "lorebook" && (
        <div className="foot" onClick={(ev) => ev.stopPropagation()}>
          <Toggle size="sm" on={enabled} aria-label={enabled ? "Book is on" : "Book is off"} title="Off books skip export and Rehearsal listing" onChange={() => lore.onToggleEnabled(e, !enabled)} />
          <span className="meta">{enabled ? "On" : "Off"}</span>
          <span style={{ marginLeft: "auto" }}>
            <Button size="sm" onClick={() => lore.onSplit(e)}>
              Split
            </Button>
          </span>
          <Button size="sm" onClick={() => lore.onDuplicate(e)}>
            Copy
          </Button>
        </div>
      )}
      {isOpen && <span className="tick">open</span>}
      {over && <span className="dropTag">Drop to merge into {e.name}</span>}
    </div>
  );
}

const view: DeckView = {
  id: "shelf",
  label: "Shelf",
  iconSvg: icSvg("lucide:library", 14),
  order: 15,
  css: CSS,
  Component({ ctx }) {
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [searchRetry, setSearchRetry] = useState(0);
    const [searchResult, setSearchResult] = useState<{ query: string; entities: readonly StudioEntitySummary[]; ids: Set<string>; unavailable: boolean; truncated: boolean }>({ query: "", entities: [], ids: new Set(), unavailable: false, truncated: false });

    const q = query.trim().toLowerCase();
    useEffect(() => {
      if (!q) { setSearchResult({ query: "", entities: ctx.entities, ids: new Set(), unavailable: false, truncated: false }); return; }
      let alive = true;
      const controller = new AbortController();
      const timer = setTimeout(() => {
        void searchAllPages(ctx.search, { query, scope: { kind: "lorebook-shelf" } }, controller.signal).then(
          (result) => { if (alive) setSearchResult({ query: q, entities: ctx.entities, ids: new Set(result.hits.map((hit) => `${hit.kind}\0${hit.id}`)), unavailable: false, truncated: result.truncated }); },
          () => { if (alive) setSearchResult({ query: q, entities: ctx.entities, ids: new Set(), unavailable: true, truncated: false }); },
        );
      }, 150);
      return () => { alive = false; clearTimeout(timer); controller.abort(); };
    }, [q, query, ctx.search, ctx.entities, searchRetry]);
    const currentSearch = searchResult.query === q && searchResult.entities === ctx.entities;
    const unavailable = q !== "" && currentSearch && searchResult.unavailable;
    const filtered = !q
      ? ctx.entities
      : !currentSearch || unavailable
        ? ctx.entities
        : searchResult.query === q
        ? ctx.entities.filter((e) => searchResult.ids.has(`${e.kind}\0${e.id}`))
        : [];
    const dragged = filtered.find((e) => e.id === draggingId && e.kind === "lorebook");
    return (
      <div className="dv-shelfscroll">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            border: "2px solid var(--stage-seam)",
            background: "var(--stage-sunken)",
            padding: "0.35rem 0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.68rem",
              color: "var(--stage-soft)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Find
          </span>
          <input
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Name, key, or tag…"
            aria-label="Search by name, key, or tag"
            style={{
              flex: 1,
              border: 0,
              background: "none",
              color: "var(--stage-soft)",
              fontFamily: "var(--font-body)",
              fontSize: "0.9rem",
            }}
          />
        </label>
        {q && (!currentSearch || unavailable || (currentSearch && searchResult.truncated)) && <p role="status">{unavailable ? <>Search unavailable; showing every book. <Button size="sm" variant="quiet" onClick={() => setSearchRetry((value) => value + 1)}>Retry</Button></> : currentSearch && searchResult.truncated ? "The result limit was reached; only the first matching books are shown." : "Searching books…"}</p>}
        <VirtualShelf items={filtered} keyOf={(e) => pieceKey(e)} rowClass="dv-shelf" pinKey={dragged ? pieceKey(dragged) : null}
          render={(e) => <BookCard ctx={ctx} e={e} draggingId={draggingId} setDraggingId={setDraggingId} />} />
        {filtered.length === 0 && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              color: "var(--stage-kicker)",
            }}
          >
            Nothing matches that search.
          </p>
        )}
        <div className={`dv-trash${draggingId ? " show" : ""}`}>
          Drag onto another book to merge
        </div>
      </div>
    );
  },
};

export default view;
