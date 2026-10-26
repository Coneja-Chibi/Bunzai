/**
 * Deck view: SHOWCASE - one card at a time, properly. Hero art at full presence, the card's own
 * words beside it (tagline + description via peek), prev/next flipping, a thumb rail to jump, and
 * STAGE right there. A carousel's real job is looking closely at ONE card, so that is its job here
 * (not an aimless spinning shelf). Both the hero and the rail's mini thumbs are lazy `<img>`s, not
 * CSS backgrounds, fetched through the shared art cache (M8) so a
 * piece shown as both the hero and its own rail thumb decrypts once.
 */
import { useReducer } from "react";
import type { CSSProperties, JSX } from "react";
import type { StudioEntitySummary } from "../../../app-contract";
import { deckMeta } from "../../../_shared/decks";
import { QueuedPiecePreview } from "../piece-preview";
import { useArtSrc } from "../../../_shared/art-cache";
import { pieceKey, versionedArtUrl, type DeckView, type DeckViewContext } from "../view-contract";
import { icSvg } from "../../../_shared/ic-svg";
import { Button, IconButton, Tile } from "../../../components/button";

const CSS = `
.dv-show{flex:1;min-height:0;display:flex;flex-direction:column}
.dv-show .sc-empty{margin:auto;font-family:var(--font-body);font-style:italic;color:var(--stage-kicker)}
.dv-show .main{flex:1;min-height:0;display:flex;align-items:center;gap:clamp(.7rem,2vw,1.4rem);
  padding:clamp(.8rem,2vw,1.4rem)}
.dv-show .hero{flex:none;width:clamp(8rem,calc(var(--card-w) * 1.6),24rem);background:var(--stage-panel);border:3px solid var(--stage-black);
  box-shadow:0 24px 38px -14px var(--shadow-ink-deep)}
.dv-show .hero .cov{aspect-ratio:2/3;background:var(--a);border-bottom:3px solid var(--stage-black);position:relative;
  display:flex;align-items:flex-end;padding:.5rem}
.dv-show .hero .cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;pointer-events:none}
.dv-show .hero .cov b{font-family:var(--font-big);font-weight:900;font-size:3rem;line-height:.72;color:var(--stage-ink);opacity:.82}
.dv-show .hero .kd{position:absolute;top:0;left:0;background:var(--stage-ink);color:var(--a);font-family:var(--font-mono);
  font-size: var(--text-meta);font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:2px 5px;border-right:3px solid var(--stage-black);border-bottom:3px solid var(--stage-black)}
.dv-show .plate{flex:1;min-width:0;min-height:0;max-height:100%;overflow-y:auto;background:var(--stage-row);border:3px solid var(--stage-black);
  box-shadow:5px 6px 0 0 var(--shadow-ink);padding:clamp(.8rem,1.8vw,1.3rem);display:flex;flex-direction:column;gap:.6rem}
.dv-show .plate .nm{font-family:var(--font-big);font-weight:900;font-size:clamp(1.2rem,2.4vw,1.9rem);
  letter-spacing:-.01em;color:var(--stage-card);line-height:1;overflow-wrap:anywhere}
.dv-show .plate .meta{font-family:var(--font-mono);font-size: var(--text-meta);font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--stage-soft)}
.dv-show .plate .stage-btn{align-self:flex-start}
.dv-show .rail{flex:none;display:flex;gap:.4rem;padding:.5rem .8rem .8rem;overflow-x:auto}
.dv-show .mini{flex:none;width:2.2rem;aspect-ratio:2/3;border:2px solid var(--stage-black);background:var(--a);cursor:pointer;
  position:relative;opacity:.55;transition:opacity .1s ease-out,transform .1s ease-out}
.dv-show .mini img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;pointer-events:none}
.dv-show .mini:hover{opacity:1;transform:translateY(-2px)}
.dv-show .mini.now{opacity:1;border-color:var(--a);outline:2px solid var(--a)}
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
      <div className="rail">
        {ctx.entities.map((m, i) => (
          <Tile
            kind="thumb"
            key={pieceKey(m)}
            vars={{ "--a": m.accent ?? deckMeta(m.kind).accent }}
            selected={i === idx}
            aria-current={i === idx ? "true" : undefined}
            label={m.name}
            onClick={() => {
              focusByKind.set(ctx.deck.kind, i);
              bump();
            }}
            art={<MiniThumb ctx={ctx} e={m} />}
          />
        ))}
      </div>
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
