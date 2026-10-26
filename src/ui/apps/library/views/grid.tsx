/**
 * Deck view: GRID - the workhorse. Portrait 2:3 cards in a fluid auto-fill grid sized by the
 * user's art dial. Tapping a card STAGES it (accent ring + corner check); cards already open on
 * the Workbench wear a quiet "on the workbench" tick (a pure annotation). The naive-user default.
 * Art is an `<img loading="lazy" decoding="async">`, not a CSS background: an off-screen card's
 * multi-MB portrait is never fetched until it scrolls into view.
 * The fetch itself goes through the shared art cache (M8), so a piece shown elsewhere on the page
 * decrypts once - `useArtSrc` keeps the same visibility gate, watching the `<img>` it returns.
 */
import { useCallback, useRef, type CSSProperties, type JSX, type KeyboardEvent } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { useArtSrc } from "../../../_shared/art-cache";
import { pieceKey, versionedArtUrl, type DeckView, type DeckViewContext } from "../view-contract";
import { selectedText } from "../select-core";
import { useMarquee } from "../use-marquee";
import { Lasso } from "../lasso";
import { QueuedPiecePreview } from "../piece-preview";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, rowsOf, useFocusedRangeIndex, useGridColumns, useVirtualRows, type Range } from "../../../_shared/virtual-list";
import { icSvg } from "../../../_shared/ic-svg";
import { Card } from "../../../components/button";

const CSS = `
.dv-gridscroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
/* the dragged box: fixed, because it is measured in viewport coordinates like the cards it tests */
.dv-lasso{position:fixed;z-index:60;pointer-events:none;border:2px dashed var(--a,var(--stage-line));
  background:var(--stage-sunken);opacity:.35}
/* names are TEXT: an imported preset's id is often the only place its real name is written down */
.dv-gcard .nm{user-select:text;cursor:text}
/* the virtualizer's own positioning box: real height (getTotalSize), rows placed absolutely inside */
.dv-gridspace{position:relative;width:100%}
/* the 42vw guard keeps at least two columns on a phone even when the desktop size dial is huge */
.dv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(var(--card-w),42vw,100%),1fr));gap:clamp(.5rem,1.4vw,1rem);
  position:absolute;top:0;left:0;right:0}
/* overflow:hidden is the backstop: whatever a name does, it stays inside its own card */
.dv-gcard{display:flex;flex-direction:column;text-align:left;font:inherit;padding:0;cursor:pointer;position:relative;overflow:hidden;min-width:0;
  background:var(--stage-panel);border:3px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--a);transition:transform .12s ease-out,box-shadow .12s ease-out}
.dv-gcard:hover{transform:translate(-3px,-3px);box-shadow:9px 9px 0 0 var(--a)}
.dv-gcard .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid var(--stage-black);position:relative;
  display:flex;align-items:flex-end;padding:.4rem}
.dv-gcard .cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;pointer-events:none}
.dv-gcard .cov b{font-family:var(--font-big);font-weight:900;font-size:clamp(1.6rem,26cqi,2.6rem);line-height:.72;color:var(--stage-ink);opacity:.82}
.dv-gcard .kd{position:absolute;top:0;left:0;background:var(--stage-ink);color:var(--a);font-family:var(--font-mono);
  font-size: var(--text-meta);font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
/* min-width:0 lets the name shrink inside the grid track; without it a long word sets the width */
.dv-gcard .bd{padding:.4rem .5rem .5rem;min-width:0}
/* name + meta tag scale with the size dial (--card-w); name stays the larger of the two at every size */
.dv-gcard .nm{font-family:var(--font-big);font-weight:800;font-size:clamp(var(--text-control),calc(var(--card-w) * .094),1.6rem);color:var(--stage-card);line-height:1.1;
  /*
   * A NAME IS SOMEBODY ELSE'S STRING. Presets arrive called "3035a5467e03eaa245de3ac318018404" and
   * "HawThorne(2)" - one unbroken word far wider than any card. With nothing here it drew straight
   * out of the card and over the neighbours, so a shelf of imports was a wall of overlapping text.
   * Breaking anywhere is right for an id; three lines then hand the rest to the tooltip, which
   * already carries the whole name, so cards in a row stay the same height.
   */
  overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.dv-gcard .fmt{display:inline-block;font-family:var(--font-mono);font-size:var(--text-meta);letter-spacing:.06em;
  text-transform:uppercase;color:var(--stage-soft);border:2px solid var(--stage-line);font-weight:700;padding:.24em .5em;margin-top:.4em}
.dv-gcard.cast{border-color:var(--a);box-shadow:inset 5px 5px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.72}
.dv-gcard.cast:hover{transform:translate(2px,2px);box-shadow:inset 5px 5px 0 0 var(--shadow-ink)}
.dv-gcard .tick{position:absolute;top:0;right:0;z-index:1;background:var(--a);color:var(--stage-ink);font-family:var(--font-mono);
  font-size: var(--text-meta);font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-left:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
/* STAGED: outlined in accent, a filled corner check - distinct from the pressed-open "cast" state */
.dv-gcard.pick{outline:3px solid var(--a);outline-offset:-3px;box-shadow:9px 9px 0 0 var(--a);transform:translate(-3px,-3px)}
.dv-gcard .check{position:absolute;top:0;right:0;z-index:2;width:1.15rem;height:1.15rem;background:var(--a);
  border-left:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black);display:flex;align-items:center;justify-content:center}
.dv-gcard .check::after{content:"";width:.42rem;height:.72rem;border:solid var(--stage-ink);border-width:0 3px 3px 0;
  transform:translateY(-2px) rotate(45deg)}
`;

function GridCard({ ctx, e, posinset, setsize }: { ctx: DeckViewContext; e: StudioEntitySummary; posinset: number; setsize: number }): JSX.Element {
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
    <Card
      kind="art"
      vars={{ "--a": e.accent ?? deckMeta(e.kind).accent }}
      ref={menuRef}
      data-part="library.gcard"
      selected={staged}
      title={title}
      data-pick={key}
      // C-2: "item N of M" survives virtualization - a screen reader has no other way to know
      // this card is #posinset of setsize once most of the deck is unmounted off-screen.
      aria-setsize={setsize}
      aria-posinset={posinset}
      onClick={(ev) => {
        /**
         * A HIGHLIGHT IS NOT A TAP. Names are selectable now, and a card is a button - so dragging
         * across `3035a5467e03eaa245de3ac318018404` to copy it both highlights the text AND fires
         * this click. Without the guard, copying an id stages the piece as a silent side effect.
         */
        if (selectedText(window.getSelection())) return;
        ctx.onPiece(e, { shift: ev.shiftKey, meta: ev.ctrlKey || ev.metaKey });
      }}
      art={
        <div className="cov">
          {art
            ? <img ref={artRef} src={artSrc} alt="" loading="lazy" decoding="async" />
            : <b>{e.name.charAt(0).toUpperCase()}</b>}
          <span className="kd">{e.kind}</span>
        </div>
      }
      heading={e.name}
    >
      {ctx.peeks && <QueuedPiecePreview e={e} queue={ctx.peeks} ctx={ctx} />}
      {fmt && <span className="fmt">{fmt}</span>}
      {isOpen && <span className="tick">on the workbench</span>}
      {staged && <span className="check" />}
    </Card>
  );
}

/** Row height before the first real paint measures it (`measureElement` corrects every row after
 * that); only ever visible for the first frame of the first mount. */
const ROW_ESTIMATE_PX = 260;

/**
 * Its own component so the marquee can hold hook state. A DeckView's `Component` is called as a
 * plain function from the registry, which is not a place hooks may live.
 *
 * VIRTUALIZED BY ROW: thousands of cards used to all sit in the DOM at
 * once (97 ms to lay out 5,000 in the measured case; react-question.md). Each row is its own
 * single-row grid carrying the SAME `.dv-grid` CSS as the old continuous one, absolutely positioned
 * by the virtualizer (`useGridColumns` reads the live column count and row gap straight off that
 * CSS, never recomputed from `--card-w` in JS), so the rendered slice looks pixel-identical to the
 * old unbroken grid. Only the rows within one screen of the viewport (plus OVERSCAN) ever mount.
 */
function Grid({ ctx }: { ctx: DeckViewContext }): JSX.Element {
  const marquee = useMarquee((cards, box, additive) => { ctx.onSweep?.(cards, box, additive); });
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cols, gapPx, rowRef } = useGridColumns();
  const rows = rowsOf(ctx.entities, cols);
  const flatIndexOfFocused = useCallback(
    (target: HTMLElement) => {
      const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
      return key ? ctx.entities.findIndex((e) => pieceKey(e) === key) : -1;
    },
    [ctx.entities],
  );
  const toRowIndex = useCallback((flat: number) => Math.floor(flat / Math.max(1, cols)), [cols]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, toRowIndex);

  const virtualizer = useVirtualRows({
    mode: "grid",
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: OVERSCAN,
    gap: gapPx, // `.dv-grid`'s own row-gap (read live off it, useGridColumns): baked into each
    // row's own start below, so consecutive rows land the correct distance apart.
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), // C-1: a wheel/scrollbar
    // scroll must not drop the focused card off the DOM and focus to <body>.
    initialRect: FALLBACK_VIEWPORT,
  });
  const items = virtualizer.getVirtualItems();
  const firstRendered = items[0]?.index;

  /** Tab/Shift+Tab off the rendered edge reaches the next/previous CARD, not the next row - scroll
   * moves by ROW, so the card index is converted to a row index at the boundary. */
  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const flat = flatIndexOfFocused(document.activeElement as HTMLElement);
    if (flat < 0) return;
    bridgeTabAcrossVirtualBoundary(
      ev,
      { scrollToIndex: (i, opts) => virtualizer.scrollToIndex(Math.floor(i / Math.max(1, cols)), opts) },
      ctx.entities.length,
      flat,
      ev.currentTarget,
      (i) => pieceKey(ctx.entities[i]!),
    );
  };

  return (
    <div className="dv-gridscroll" ref={scrollRef} onPointerDown={marquee.onPointerDown} onKeyDown={onKeyDown} onFocus={onFocus}>
      <div className="dv-gridspace" role="list" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((row) => (
          <div
            key={row.index}
            ref={(el) => { virtualizer.measureElement(el); if (row.index === firstRendered) rowRef(el); }}
            data-index={row.index}
            className="dv-grid"
            style={{ transform: `translateY(${String(row.start)}px)` }}
          >
            {(rows[row.index] ?? []).map((e, i) => (
              <GridCard key={pieceKey(e)} ctx={ctx} e={e} posinset={row.index * Math.max(1, cols) + i + 1} setsize={ctx.entities.length} />
            ))}
          </div>
        ))}
      </div>
      <Lasso box={marquee.box} />
    </div>
  );
}

const view: DeckView = {
  id: "grid",
  // "Tiles", not "Grid": the rail's Carousel / Grid switch is RC's row layout, a different thing.
  label: "Tiles",
  iconSvg: icSvg("lucide:layout-grid", 14),
  order: 10,
  css: CSS,
  Component({ ctx }) {
    return <Grid ctx={ctx} />;
  },
};

export default view;
