/**
 * Deck view: LIST - dense rows for big collections: small art thumb, name, kind tag, workbench state.
 * The size pick scales the thumb. Art is a lazy `<img>`, not a CSS background, fetched through the shared art cache (M8) so a piece shown elsewhere decrypts once.
 */
import { useCallback, useRef, type CSSProperties, type JSX, type KeyboardEvent } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { useArtSrc } from "../../../_shared/art-cache";
import { QueuedPiecePreview } from "../piece-preview";
import { pieceKey, versionedArtUrl, type DeckView, type DeckViewContext } from "../view-contract";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, remToPx, useFocusedRangeIndex, useVirtualRows, type Range } from "../../../_shared/virtual-list";
import { icSvg } from "../../../_shared/ic-svg";

const CSS = `
.dv-listscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.6rem,1.4vw,.9rem)}
.dv-list{position:relative;width:100%}
.dv-listrow{position:absolute;top:0;left:0;right:0}
.dv-row{display:flex;align-items:center;gap:.7rem;width:100%;text-align:left;font:inherit;cursor:pointer;
  background:var(--stage-row);border:3px solid var(--stage-black);padding:.35rem .55rem;transition:transform .1s ease-out}
.dv-row:hover{transform:translate(-1px,-1px);border-color:var(--a)}
.dv-row .thumb{width:calc(var(--card-w) * .28);aspect-ratio:2/3;flex:none;background:var(--a);border:2px solid var(--stage-black);
  position:relative;display:flex;align-items:center;justify-content:center;
  font-family:var(--font-big);font-weight:900;color:var(--stage-ink)}
.dv-row .thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;pointer-events:none}
/* an imported preset may be named as one 32-character word; it wraps rather than pushing the row */
.dv-row .nm{font-family:var(--font-big);font-weight:800;font-size: var(--text-body);color:var(--stage-card);
  overflow-wrap:anywhere;min-width:0}
.dv-row .words{flex:1;min-width:0}
.dv-row .kd{font-family:var(--font-mono);font-size: var(--text-meta);font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--stage-text-dim)}
.dv-row .bench{margin-left:auto;font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.08em;
  text-transform:uppercase;color:var(--a);border:2px solid var(--a);padding:2px 6px}
.dv-row.cast{border-color:var(--a);background:var(--stage-sunken);opacity:.72}
.dv-row.pick{border-color:var(--a);background:var(--stage-sunken);box-shadow:inset 4px 0 0 0 var(--a)}
.dv-row .stag{margin-left:auto;font-family:var(--font-mono);font-size: var(--text-meta);letter-spacing:.08em;
  text-transform:uppercase;color:var(--stage-ink);background:var(--a);padding:2px 7px;font-weight:700}
`;

function ListRow({ ctx, e, posinset, setsize }: { ctx: DeckViewContext; e: StudioEntitySummary; posinset: number; setsize: number }): JSX.Element {
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const art = ctx.portraitUrl(e);
  const { ref: artRef, src: artSrc } = useArtSrc(versionedArtUrl(ctx, e));
  const fmt = ctx.sourceLabel(e);
  const title = isOpen
    ? `${e.name} is open on the Workbench`
    : staged
      ? `${e.name} is staged - tap to unstage`
      : `Stage ${e.name} for the Workbench`;

  return (
    <button
      ref={menuRef}
      className={`dv-row${isOpen ? " cast" : ""}${staged ? " pick" : ""}`}
      style={{ "--a": e.accent ?? deckMeta(e.kind).accent } as CSSProperties}
      title={title}
      data-pick={key}
      aria-setsize={setsize}
      aria-posinset={posinset}
      onClick={() => ctx.onPiece(e)}
    >
      <span className="thumb">
        {art ? <img ref={artRef} src={artSrc} alt="" loading="lazy" decoding="async" /> : e.name.charAt(0).toUpperCase()}
      </span>
      <span className="words">
        <span className="nm">{e.name}</span>
        {ctx.peeks && <QueuedPiecePreview e={e} queue={ctx.peeks} ctx={ctx} />}
        <span className="kd">{e.kind}{fmt ? ` · ${fmt}` : ""}</span>
      </span>
      {isOpen && <span className="bench">on the workbench</span>}
      {!isOpen && staged && <span className="stag">staged</span>}
    </button>
  );
}

/** Row height before the first real paint measures it (`measureElement` corrects every row after);
 * only ever visible for the first frame of the first mount. Close to the row's real ~2.6rem height
 * so a fast scroll's very first frame is not noticeably off. */
const ROW_ESTIMATE_PX = 44;
const ROW_GAP_REM = 0.35;

/**
 * VIRTUALIZED: one row per entity, absolutely positioned by
 * `useVirtualizer` instead of a `.map()` over the whole deck - the List view is exactly the "big
 * collection" case its own docblock names. Only rows within one screen of the viewport (plus
 * OVERSCAN) ever mount; `measureElement` corrects `ROW_ESTIMATE_PX` against each row's real height
 * once it paints (a long id can wrap the name onto a second line).
 */
function List({ ctx }: { ctx: DeckViewContext }): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const entities = ctx.entities;
  const flatIndexOfFocused = useCallback(
    (target: HTMLElement) => {
      const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
      return key ? entities.findIndex((e) => pieceKey(e) === key) : -1;
    },
    [entities],
  );
  const identity = useCallback((flat: number) => flat, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, identity);

  const virtualizer = useVirtualRows({
    mode: "list",
    count: entities.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: OVERSCAN,
    gap: remToPx(ROW_GAP_REM), // `.dv-list`'s own row gap: baked into each row's own start below.
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), // C-1: keep a focused row
    // mounted through a wheel/scrollbar scroll, not only reachable via Tab.
    initialRect: FALLBACK_VIEWPORT,
  });

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const flat = flatIndexOfFocused(document.activeElement as HTMLElement);
    if (flat < 0) return;
    bridgeTabAcrossVirtualBoundary(ev, virtualizer, entities.length, flat, ev.currentTarget, (i) => pieceKey(entities[i]!));
  };

  return (
    <div className="dv-listscroll" ref={scrollRef} onKeyDown={onKeyDown} onFocus={onFocus}>
      <div className="dv-list" role="list" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const e = entities[row.index];
          if (!e) return null;
          return (
            <div
              key={row.index}
              ref={virtualizer.measureElement}
              data-index={row.index}
              className="dv-listrow"
              style={{ transform: `translateY(${String(row.start)}px)` }}
            >
              <ListRow ctx={ctx} e={e} posinset={row.index + 1} setsize={entities.length} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const view: DeckView = {
  id: "list",
  label: "List",
  iconSvg: icSvg("lucide:list", 14),
  order: 30,
  css: CSS,
  Component({ ctx }) {
    return <List ctx={ctx} />;
  },
};

export default view;
