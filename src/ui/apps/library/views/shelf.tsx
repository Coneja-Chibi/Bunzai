/**
 * Deck view: SHELF - lorebook spine cards (vs-lore-shelf). Enable switch, drag-merge target,
 * kebab via context menu. Non-lore decks still render as monogram spines.
 */
import { useEffect, useState, type CSSProperties, type DragEvent, type JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { pieceKey, type DeckView, type DeckViewContext } from "../view-contract";
import { searchAllPages } from "../search-runner";
import { plural } from "../../../../core/text";
import { ToggleSwitch } from "../../../components/toggle-switch";
import { icSvg } from "../../../_shared/ic-svg";
import { QueuedPiecePreview } from "../piece-preview";

const CSS = `
.dv-shelfscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.dv-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(12rem,100%),1fr));gap:.85rem;position:relative}
.dv-book{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out;
  --spine:var(--a)}
.dv-book:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--a)}
.dv-book .spine{position:absolute;left:0;top:0;bottom:0;width:.45rem;background:var(--spine);border-right:2px solid var(--stage-black)}
.dv-book .body{padding:.7rem .7rem .55rem 1.05rem;display:flex;flex-direction:column;gap:.3rem;min-height:6.2rem}
.dv-book button.nm{display:block;width:100%;background:none;border:0;padding:0;text-align:left;cursor:pointer}
.dv-book button.nm:focus-visible{outline:2px solid var(--a);outline-offset:2px}
.dv-book .nm{font-family:var(--font-big);font-weight:800;font-size:.95rem;color:var(--stage-card);line-height:1.1;
  overflow-wrap:anywhere}
.dv-book .meta{font-family:var(--font-mono);font-size: var(--text-meta);font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--stage-soft)}
.dv-book .foot{display:flex;align-items:center;gap:.4rem;padding:0 .55rem .55rem 1.05rem}
.dv-book.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.78}
.dv-book.pick{outline:3px solid var(--a);outline-offset:-3px}
.dv-book.off .nm{text-decoration:line-through;color:var(--stage-mute)}
.dv-book.off{opacity:.55}
.dv-book.drop{outline:3px dashed var(--a);outline-offset:2px}
.dv-book .tick{position:absolute;top:0;right:0;background:var(--a);color:var(--stage-ink);font-family:var(--font-mono);
  font-size: var(--text-meta);font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-left:2px solid var(--stage-black);border-bottom:2px solid var(--stage-black)}
.dv-book .dropTag{position:absolute;left:.5rem;right:.5rem;bottom:.4rem;font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-ink);background:var(--a);border:2px solid var(--stage-black);padding:.2rem .3rem;text-align:center}
.dv-trash{position:sticky;bottom:.5rem;margin:0 auto;max-width:14rem;border:2px dashed var(--stage-danger-edge);color:var(--stage-danger-text);font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.08em;text-transform:uppercase;padding:.55rem;text-align:center;background:var(--stage-danger-bg);opacity:0;pointer-events:none}
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
  const accent = e.accent ?? deckMeta(e.kind).accent;
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
        <button type="button" className="nm" aria-pressed={staged}>{e.name || "(unnamed)"}</button>
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
          <ToggleSwitch size="sm" on={enabled} aria-label={enabled ? "Book is on" : "Book is off"} title="Off books skip export and Rehearsal listing" onChange={() => lore.onToggleEnabled(e, !enabled)} />
          <span className="meta">{enabled ? "On" : "Off"}</span>
          <button
            type="button"
            className="meta"
            style={{
              marginLeft: "auto",
              fontSize: "max(14px, var(--text-control))",
              border: "1px solid var(--stage-seam)",
              background: "var(--stage-row)",
              padding: "0.12rem 0.3rem",
              cursor: "pointer",
              color: "var(--stage-soft)",
            }}
            onClick={() => lore.onSplit(e)}
          >
            Split
          </button>
          <button
            type="button"
            className="meta"
            style={{
              fontSize: "max(14px, var(--text-control))",
              border: "1px solid var(--stage-seam)",
              background: "var(--stage-row)",
              padding: "0.12rem 0.3rem",
              cursor: "pointer",
              color: "var(--stage-soft)",
            }}
            onClick={() => lore.onDuplicate(e)}
          >
            Copy
          </button>
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
        {q && (!currentSearch || unavailable || (currentSearch && searchResult.truncated)) && <p role="status">{unavailable ? <>Search unavailable; showing every book. <button type="button" onClick={() => setSearchRetry((value) => value + 1)}>Retry</button></> : currentSearch && searchResult.truncated ? "The result limit was reached; only the first matching books are shown." : "Searching books…"}</p>}
        <div className="dv-shelf">
          {filtered.map((e) => (
            <BookCard
              key={pieceKey(e)}
              ctx={ctx}
              e={e}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
            />
          ))}
        </div>
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
