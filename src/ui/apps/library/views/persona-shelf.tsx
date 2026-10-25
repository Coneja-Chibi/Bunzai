/**
 * Deck view: PERSONA SHELF (design/vs-persona-editor.html wire 2) - persona cards: portrait (or
 * monogram) cover with the gilt Default badge, name, the BRIEF as the card line (its one honest
 * home), and the pronouns · sections · lorebook fact line. Kind-scoped to the persona deck; taps
 * stage/note via ctx.onPiece like every deck view, and the shell entity menu does the sending.
 * The cover art is a lazy `<img>`, not a CSS background, fetched
 * through the shared art cache (M8) so a piece shown elsewhere on the page decrypts once.
 */
import { useCallback, useRef, type CSSProperties, type JSX, type KeyboardEvent } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { useArtSrc } from "../../../_shared/art-cache";
import { pieceKey, versionedArtUrl, type DeckView, type DeckViewContext } from "../view-contract";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, rowsOf, useFocusedRangeIndex, useGridColumns, useVirtualRows, type Range } from "../../../_shared/virtual-list";
import { icSvg } from "../../../_shared/ic-svg";

const CSS = `
.psh-scroll{flex:1;min-height:0;overflow-y:auto;padding:clamp(.5rem,1.8vw,1.1rem)}
.psh-space{position:relative;width:100%}
.psh-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(15rem,100%),1fr));gap:1.1rem;position:absolute;top:0;left:0;right:0}
.psh-card{position:relative;display:flex;flex-direction:column;text-align:left;font:inherit;color:inherit;cursor:pointer;padding:0;
  background:var(--stage-panel);border:2px solid var(--stage-black);box-shadow:5px 5px 0 0 var(--stage-black);transition:transform .12s ease-out,box-shadow .12s ease-out}
.psh-card:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 0 var(--stage-black)}
.psh-card.cast{border-color:var(--a);box-shadow:inset 4px 4px 0 0 var(--shadow-ink);transform:translate(2px,2px);opacity:.85}
.psh-card.pick{outline:3px solid var(--a);outline-offset:-3px}
.psh-cov{height:7.5rem;background:var(--stage-sunken);display:grid;place-items:center;
  color:var(--stage-kicker);font:900 1.6rem var(--font-big);border-bottom:2px solid var(--stage-black);position:relative}
.psh-cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;pointer-events:none}
.psh-def{position:absolute;top:.4rem;right:.4rem;font: 700 var(--text-meta) var(--font-mono);letter-spacing:.06em;text-transform:uppercase;
  background:var(--stage-warn-ink);color:var(--stage-warn);border:1px solid var(--stage-black);padding:.08rem .3rem}
.psh-body{padding:.5rem .6rem}
.psh-nm{display:block;font:800 var(--text-control) var(--font-big);letter-spacing:.03em;text-transform:uppercase;color:var(--stage-card);overflow-wrap:anywhere}
.psh-brief{font-style:italic;font-family:var(--font-body);color:var(--stage-mute);font-size:.78rem;overflow-wrap:anywhere}
.psh-line{font: 500 var(--text-meta) var(--font-mono);letter-spacing:.05em;text-transform:uppercase;color:var(--stage-text-dim);margin-top:.3rem}
.psh-new{display:grid;place-items:center;min-height:12rem;cursor:pointer;font: 700 var(--text-meta) var(--font-mono);letter-spacing:.09em;text-transform:uppercase;
  color:var(--stage-mute);background:none;border:2px dashed var(--stage-seam)}
`;

const ICON = icSvg("lucide:user", 14);

function PersonaCard({ ctx, e, posinset, setsize }: { ctx: DeckViewContext; e: StudioEntitySummary; posinset: number; setsize: number }): JSX.Element {
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const ps = ctx.personaShelf;
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const url = ctx.portraitUrl(e);
  const { ref: artRef, src: artSrc } = useArtSrc(versionedArtUrl(ctx, e));
  const sectionCount = ps?.sectionCountOf(e);
  const facts = [
    ps?.pronounsOf(e),
    sectionCount ? `${sectionCount} section${sectionCount === 1 ? "" : "s"}` : undefined,
    ps?.hasLorebookOf(e) ? "lorebook linked" : undefined,
  ].filter(Boolean);

  return (
    <div
      ref={menuRef}
      role="button"
      tabIndex={0}
      className={`psh-card${isOpen ? " cast" : ""}${staged ? " pick" : ""}`}
      style={{ "--a": e.accent ?? deckMeta(e.kind).accent } as CSSProperties}
      title={isOpen ? `${e.name} is open on the Workbench` : `Stage ${e.name}`}
      data-pick={key}
      aria-setsize={setsize}
      aria-posinset={posinset}
      onClick={() => ctx.onPiece(e)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          ctx.onPiece(e);
        }
      }}
    >
      <div className="psh-cov">
        {url
          ? <img ref={artRef} src={artSrc} alt="" loading="lazy" decoding="async" />
          : <span>{e.name.charAt(0).toUpperCase()}</span>}
        {ps?.defaultId === e.id && <span className="psh-def">Default</span>}
      </div>
      <div className="psh-body">
        <b className="psh-nm">{e.name}</b>
        <i className="psh-brief">{ps?.briefOf(e) ?? "No blurb yet."}</i>
        {facts.length > 0 && <div className="psh-line">{facts.join(" · ")}</div>}
      </div>
    </div>
  );
}

/** A persona card, or the trailing New tile, as one cell of the virtualized grid below. */
type PCell = { readonly e: StudioEntitySummary } | { readonly e?: undefined };
const ROW_ESTIMATE_PX = 220;

/**
 * VIRTUALIZED, same row-of-N shape as `views/grid.tsx`: a studio can hold
 * thousands of personas. The New tile rides along as the cells' own trailing entry.
 */
function PersonaShelfView(ctx: DeckViewContext): JSX.Element {
  const personas = ctx.entities.filter((e) => e.kind === "persona");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { cols, gapPx, rowRef } = useGridColumns();
  const cells: PCell[] = ctx.personaShelf ? [...personas.map((e) => ({ e })), {}] : personas.map((e) => ({ e }));
  const rows = rowsOf(cells, cols);
  const flatIndexOfFocused = useCallback(
    (target: HTMLElement) => {
      const key = target.closest<HTMLElement>("[data-pick]")?.dataset["pick"];
      return key ? personas.findIndex((e) => pieceKey(e) === key) : -1;
    },
    [personas],
  );
  const toRowIndex = useCallback((flat: number) => Math.floor(flat / Math.max(1, cols)), [cols]);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatIndexOfFocused, toRowIndex);

  const virtualizer = useVirtualRows({
    mode: "grid",
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: OVERSCAN,
    gap: gapPx,
    rangeExtractor: useCallback((range: Range) => keepFocusedInRange(range, focusedIndex), [focusedIndex]), // C-1: a wheel/scrollbar
    // scroll must not drop the focused card off the DOM and focus to <body>.
    initialRect: FALLBACK_VIEWPORT,
  });
  const items = virtualizer.getVirtualItems();
  const firstRendered = items[0]?.index;

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>): void => {
    const flat = flatIndexOfFocused(document.activeElement as HTMLElement);
    if (flat < 0) return;
    bridgeTabAcrossVirtualBoundary(
      ev, { scrollToIndex: (i, opts) => virtualizer.scrollToIndex(Math.floor(i / Math.max(1, cols)), opts) },
      personas.length, flat, ev.currentTarget, (i) => pieceKey(personas[i]!),
    );
  };

  return (
    <div className="psh-scroll" ref={scrollRef} onKeyDown={onKeyDown} onFocus={onFocus}>
      <div className="psh-space" role="list" style={{ height: virtualizer.getTotalSize() }}>
        {items.map((row) => (
          <div
            key={row.index}
            ref={(el) => { virtualizer.measureElement(el); if (row.index === firstRendered) rowRef(el); }}
            data-index={row.index}
            className="psh-shelf"
            style={{ transform: `translateY(${String(row.start)}px)` }}
          >
            {(rows[row.index] ?? []).map((cell, i) => cell.e
              ? <PersonaCard key={pieceKey(cell.e)} ctx={ctx} e={cell.e} posinset={row.index * Math.max(1, cols) + i + 1} setsize={personas.length} />
              : (
                <button type="button" className="psh-new" key="new" onClick={() => ctx.personaShelf!.onNew()}>
                  + New persona
                </button>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const view: DeckView = {
  id: "persona-shelf",
  // Not "Shelf": the plain spine Shelf also runs on this deck, and two buttons with one name were
  // told apart only by an icon that never drew (it lacked the SVG namespace).
  label: "Profiles",
  iconSvg: ICON,
  order: 15,
  css: CSS,
  kinds: ["persona"],
  Component({ ctx }) {
    return <PersonaShelfView {...ctx} />;
  },
};

export default view;
