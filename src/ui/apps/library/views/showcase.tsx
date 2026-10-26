/**
 * Deck view: SHOWCASE - one card at a time, properly. Hero art at full presence, the card's own
 * words beside it (tagline + description via peek), prev/next flipping, a thumb rail to jump, and
 * STAGE right there. A carousel's real job is looking closely at ONE card, so that is its job here
 * (not an aimless spinning shelf). Both the hero and the rail's mini thumbs are lazy `<img>`s, not
 * CSS backgrounds, fetched through the shared art cache (M8) so a
 * piece shown as both the hero and its own rail thumb decrypts once.
 */
import { useCallback, useReducer, useRef } from "react";
import type { CSSProperties, JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { QueuedPiecePreview } from "../piece-preview";
import { useArtSrc } from "../../../_shared/art-cache";
import { pieceKey, versionedArtUrl, type DeckView, type DeckViewContext } from "../view-contract";
import { FALLBACK_VIEWPORT, keepFocusedInRange, OVERSCAN, remToPx, useFocusedRangeIndex, useVirtualRows, type Range } from "../../../_shared/virtual-list";
import { icSvg } from "../../../_shared/ic-svg";
import { Button, IconButton, Tile } from "../../../components/button";

const CSS = `
.dv-show{flex:1;min-height:0;display:flex;flex-direction:column}
.dv-show .sc-empty{margin:auto;font:italic .9375rem var(--font-ui);color:var(--text-dim)}
.dv-show .main{flex:1;min-height:0;display:flex;align-items:center;gap:clamp(.7rem,2vw,1.25rem);padding:.375rem .5rem .875rem}
.dv-show .hero{flex:none;width:clamp(8rem,calc(var(--card-w) * 1.6),24rem);background:var(--glass);border:3px solid var(--stage-black);border-top-color:var(--a);box-shadow:6px 6px 0 var(--stage-black)}
.dv-show .hero .cov{aspect-ratio:3/4;background:color-mix(in srgb,var(--a) 22%,var(--stage-black));position:relative;display:grid;place-items:center}
.dv-show .hero .cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;pointer-events:none}
.dv-show .hero .cov b{font:700 clamp(3rem,10cqi,6.875rem)/1 var(--font-fancy);color:color-mix(in srgb,var(--a) 40%,var(--text))}
.dv-show .hero .kd{position:absolute;left:.625rem;bottom:.625rem;padding:.1875rem .625rem;font:var(--text-meta) var(--font-ui);background:var(--stage-black);
  border:1px solid var(--a);color:color-mix(in srgb,var(--a) 65%,var(--text))}
.dv-show .plate{flex:1;min-width:0;min-height:0;max-height:100%;overflow-y:auto;background:var(--glass);border:3px solid var(--stage-black);border-left:5px solid var(--a);
  box-shadow:5px 5px 0 var(--stage-black);padding:clamp(.8rem,1.8vw,1.375rem);display:flex;flex-direction:column;gap:.625rem}
.dv-show .plate .nm{font:700 clamp(1.2rem,2.4vw,1.75rem)/1.15 var(--font-fancy);color:var(--text);overflow-wrap:anywhere}
.dv-show .plate .meta{font:.8125rem var(--font-ui);color:var(--text-dim)}
.dv-show .plate .stage-btn{align-self:flex-start}
.dv-show .rail{flex:none;display:flex;gap:.4rem;padding:.5rem .8rem .8rem;overflow-x:auto}
/* phones: hero row on top (nav flanking), the words plate drops below full-width (fluid law) */
@container (max-width: 40rem){
  .dv-show .main{flex-wrap:wrap;overflow-y:auto;align-content:flex-start;gap:.6rem;padding:.6rem}
  .dv-show .hero{width:clamp(8rem,52vw,14rem)}
  .dv-show .plate{flex:1 1 100%;order:4;max-height:15rem}
}
`;

/** view-internal focus per deck kind; survives re-renders, resets on reload (ephemeral by design) */
const focusByKind = new Map<string, number>();

/**
 * Clamp LAST to 0, not first: `Math.min(Math.max(raw, 0), len - 1)` returns -1 on an empty deck,
 * which indexes to undefined and crashed the whole view. An empty deck has no valid index at all,
 * so callers must check length first - this only guarantees the result is never negative.
 */
export function clampIndex(raw: number, len: number): number {
  return Math.max(0, Math.min(raw, len - 1));
}

/** Its own component, not an inline `art &&` in the rail's `.map()`: a hook (`useArtSrc`) cannot be
 * called from inside a loop, and each thumb needs its own visibility gate and cache lookup. */
function MiniThumb({ ctx, e }: { ctx: DeckViewContext; e: StudioEntitySummary }): JSX.Element | null {
  const art = ctx.portraitUrl(e);
  const { ref, src } = useArtSrc(versionedArtUrl(ctx, e));
  return art ? <img ref={ref} src={src} alt="" loading="lazy" decoding="async" /> : null;
}

const THUMB_PX = 64;

/** The thumb rail, windowed sideways: a deck can hold thousands of thumbs, so only the ones near the viewport mount. */
function Rail({ ctx, idx, pick }: { ctx: DeckViewContext; idx: number; pick: (i: number) => void }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const gap = remToPx(0.4);
  const flatOf = useCallback((t: HTMLElement) => Number(t.closest<HTMLElement>("[data-index]")?.dataset["index"] ?? -1), []);
  const same = useCallback((i: number) => i, []);
  const { focusedIndex, onFocus } = useFocusedRangeIndex(flatOf, same);
  const virtual = useVirtualRows({
    mode: "list", horizontal: true, count: ctx.entities.length, getScrollElement: () => ref.current, getItemKey: (i) => pieceKey(ctx.entities[i]!), estimateSize: () => THUMB_PX, gap,
    overscan: OVERSCAN, initialRect: FALLBACK_VIEWPORT, rangeExtractor: useCallback((r: Range) => keepFocusedInRange(r, focusedIndex), [focusedIndex]),
  });
  return (
    <div className="rail" ref={ref} onFocus={onFocus}>
      <div style={{ position: "relative", flex: "none", width: virtual.getTotalSize(), height: THUMB_PX }}>
        {virtual.getVirtualItems().map((v) => {
          const m = ctx.entities[v.index]!;
          return (
            <div key={v.key} data-index={v.index} style={{ position: "absolute", top: 0, left: 0, transform: `translateX(${String(v.start)}px)` }}>
              <Tile kind="thumb" vars={{ "--a": m.accent ?? deckMeta(m.kind).accent }} selected={v.index === idx} aria-current={v.index === idx ? "true" : undefined} label={m.name} onClick={() => pick(v.index)} art={<MiniThumb ctx={ctx} e={m} />} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The deck can be empty while the studio is not: the Library's first-landing guard checks EVERY
 * entity, and each view is handed the ACTIVE deck's filter. One pack and the (default, persisted)
 * character deck = zero entities here. Both the view and the deck persist across reloads, so
 * without this branch the app white-screened on every launch until prefs were cleared.
 */
function Showcase({ ctx }: { ctx: DeckViewContext }): JSX.Element {
  if (ctx.entities.length === 0) {
    return (
      <div className="dv-show">
        <p className="sc-empty">Nothing in the {ctx.deck.plural.toLowerCase()} deck yet.</p>
      </div>
    );
  }
  return <ShowcaseFocus ctx={ctx} />;
}

/** Assumes a non-empty deck - Showcase guards that above, so the hooks below can index safely. */
function ShowcaseFocus({ ctx }: { ctx: DeckViewContext }): JSX.Element {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const idx = clampIndex(focusByKind.get(ctx.deck.kind) ?? 0, ctx.entities.length);
  const e = ctx.entities[idx]!;
  const accent = e.accent ?? deckMeta(e.kind).accent;
  const isOpen = ctx.open.has(pieceKey(e));
  const staged = ctx.selected.has(pieceKey(e));
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));

  const step = (delta: number): void => {
    const n = ctx.entities.length;
    focusByKind.set(ctx.deck.kind, (idx + delta + n) % n);
    bump();
  };

  const art = ctx.portraitUrl(e);
  const { ref: artRef, src: artSrc } = useArtSrc(versionedArtUrl(ctx, e));
  const fmt = ctx.sourceLabel(e);
  const stageLabel = isOpen ? "On the Workbench" : staged ? "Staged - tap to unstage" : "Stage for the Workbench";

  return (
    <div className="dv-show" style={{ "--a": accent } as CSSProperties}>
      <div className="main">
        <IconButton label="Previous" icon="lucide:chevron-left" onClick={() => step(-1)} />
        <div className="hero" ref={menuRef}>
          <div className="cov">
            {art
              ? <img ref={artRef} src={artSrc} alt="" loading="lazy" decoding="async" />
              : <b>{e.name.charAt(0).toUpperCase()}</b>}
            <span className="kd">{e.kind}</span>
          </div>
        </div>
        <div className="plate" data-pick={pieceKey(e)}>
          <div className="nm">{e.name}</div>
          {fmt && <div className="meta">{fmt}</div>}
          {e.provenance && <div className="meta">{e.provenance}</div>}
          {ctx.peeks && <QueuedPiecePreview key={pieceKey(e)} e={e} queue={ctx.peeks} ctx={ctx} expanded />}
          <div className="meta">
            {idx + 1} / {ctx.entities.length}
          </div>
          <div className="stage-btn">
            <Button variant={isOpen || staged ? "secondary" : "primary"} onClick={() => ctx.onPiece(e)}>
              {stageLabel}
            </Button>
          </div>
        </div>
        <IconButton label="Next" icon="lucide:chevron-right" onClick={() => step(1)} />
      </div>
      <Rail ctx={ctx} idx={idx} pick={(i) => { focusByKind.set(ctx.deck.kind, i); bump(); }} />
    </div>
  );
}

const view: DeckView = {
  id: "showcase",
  label: "Show",
  iconSvg: icSvg("lucide:rectangle-vertical", 14),
  order: 20,
  css: CSS,
  Component: Showcase,
};

export default view;
