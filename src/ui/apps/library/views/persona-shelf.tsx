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
import { pieceColor } from "../../../_shared/decks";
import { useArtSrc } from "../../../_shared/art-cache";
import { pieceKey, versionedArtUrl, type DeckView, type DeckViewContext } from "../view-contract";
import { bridgeTabAcrossVirtualBoundary, FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, rowsOf, useFocusedRangeIndex, useGridColumns, useVirtualRows, type Range } from "../../../_shared/virtual-list";
import { icSvg } from "../../../_shared/ic-svg";
import { Tile } from "../../../components/button";

const CSS = `
.psh-scroll{flex:1;min-height:0;overflow-y:auto;padding:.5rem .5rem 1.125rem}
.psh-space{position:relative;width:100%}
.psh-shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(16rem,100%),1fr));gap:1.375rem;position:absolute;top:0;left:0;right:0}
/* a profile: the chooser card, deck-colored top edge, lift on hover */
.psh-card{position:relative;display:flex;flex-direction:column;text-align:left;font:inherit;color:inherit;cursor:pointer;padding:0;
  background:var(--glass);border:3px solid var(--stage-black);border-top-color:var(--a);box-shadow:5px 5px 0 var(--stage-black);transition:transform .25s ease,box-shadow .25s ease}
.psh-card:hover{transform:translateY(-5px);box-shadow:5px 5px 0 var(--stage-black),var(--glow)}
.psh-card.cast{outline:1px solid var(--premiere-gold);outline-offset:3px}
.psh-card.pick{border-color:var(--a);box-shadow:5px 5px 0 var(--a)}
.psh-cov{height:7.5rem;background:color-mix(in srgb,var(--a) 22%,var(--stage-black));display:grid;place-items:center;color:color-mix(in srgb,var(--a) 40%,var(--text));font:700 1.75rem var(--font-fancy);position:relative}
.psh-cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;pointer-events:none}
.psh-def{position:absolute;top:.5rem;right:.5rem;font:600 var(--text-meta) var(--font-ui);background:var(--premiere-gold);color:var(--stage-ink);border:2px solid var(--stage-black);padding:.125rem .5rem}
.psh-body{padding:.625rem .875rem .75rem}
.psh-nm{display:block;font:700 1.0625rem/1.2 var(--font-fancy);color:var(--text);overflow-wrap:anywhere}
.psh-brief{font:italic .8125rem/1.45 var(--font-ui);color:var(--text-dim);overflow-wrap:anywhere}
.psh-line{font:var(--text-meta) var(--font-ui);color:var(--text-faint);margin-top:.375rem}
.psh-new{display:grid;place-items:center;min-height:12rem;cursor:pointer;font:700 var(--text-control) var(--font-ui);letter-spacing:.04em;color:color-mix(in srgb,var(--a) 60%,var(--text));
  background:color-mix(in srgb,var(--a) 5%,transparent);border:3px dashed color-mix(in srgb,var(--a) 55%,transparent)}
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
      style={{ "--a": pieceColor(e) } as CSSProperties}
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
                <Tile kind="add" data-part="library.persona.new" key="new" label="New persona" icon={<span>+ New persona</span>} onClick={() => ctx.personaShelf!.onNew()} />
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
