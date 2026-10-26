/**
 * The Library's shelves, laid out as RoleCall's /library: one numbered section per deck, each a row
 * of RC cards that scrolls sideways (Carousel) or wraps (Grid), RC's LibrarySectionHeader and
 * HorizontalAssetRow ported.
 *
 * EVERY HOPLIGHT CONTROL ON THE PAGE. Each section header carries its own deck's view switch
 * (Cards, then every drop-in view the Library had: Tiles, Show, List, Shelf, and the regex and
 * persona shelves) and its New button; each deck keeps its own choice, so a lorebook Shelf and a
 * character Show sit on one page. Each row of cards ends in a New tile, as the old shelves did, and
 * the cards carry their deck's shelf tools themselves (rc-cards.tsx). The rail only narrows the
 * page to one deck; it gates nothing.
 *
 * A renderer. What is drawn, in what order, and what a tap does belong to the room (index.tsx) and
 * carousel-core.ts. A deck's own row of cards, and how it virtualizes, is card-row.tsx (split out
 * for the file-lines cap).
 */
import { useEffect, useMemo, useRef, type CSSProperties, type JSX, type RefObject } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { deckMeta } from "../../_shared/decks";
import { Slider } from "../../components/slider";
import { CardRow } from "./card-row";
import { cardFacts, CARDS_VIEW, sectionView, type CarouselSection, type ShelfLayout, type ShelfMeta } from "./carousel-core";
import { Icon } from "./icon";
import { NewInDeckButton } from "./new-in-deck-button";
import { createPeekQueue, type PeekQueue } from "./peek-queue";
import { isFilteredEmpty, type ParsedQuery } from "./search-core";
import { NoMatchNotice } from "./search-bar";
import { clampSize, SIZE_RANGE, type DeckViewContext } from "./view-contract";
import { deckViews } from "./views/registry";
import { icSvg } from "../../_shared/ic-svg";
import { Segmented } from "../../components/button";

const CARDS_ICON = icSvg("lucide:columns-2", 14);

export interface ShelvesProps {
  ctx: AppContext;
  /** the per-deck context: staging, menus, art, and that deck's shelf tools, over the given pieces */
  vctxFor(kind: string, pieces: StudioEntitySummary[]): DeckViewContext;
  /** every drawn section (all decks, or the one picked in the rail) */
  sections: readonly CarouselSection[];
  /** the deck picked in the rail, or null while every deck shows */
  single: string | null;
  /** the picked deck's studio total, matched or not */
  singleTotal: number;
  layout: ShelfLayout;
  /** the stored per-deck view choices (`library.views`) */
  views: unknown;
  setView(kind: string, view: string): void;
  meta: ShelfMeta;
  parsed: ParsedQuery;
  query: string;
  setQuery(next: string): void;
  perDeck: readonly { kind: string; count: number }[];
  onJump(kind: string): void;
  studioTotal: number;
  onCreated(summary: StudioEntitySummary): void;
}

export function Shelves(props: ShelvesProps): JSX.Element {
  const { vctxFor, sections, single } = props;
  // The peek function follows the latest context, while queue/cache ownership follows the store.
  const base = vctxFor("", []);
  const peekRef = useRef(base.peek);
  peekRef.current = base.peek;
  const peeks = useMemo(() => {
    const store = props.ctx.pieces;
    return createPeekQueue((e) => peekRef.current(e), (e, lifetime) => {
      const snapshot = store.snapshot(e.kind, e.id);
      return store.isCurrentLifetime(lifetime) && !!snapshot &&
        snapshot.writeId === (e.writeId ?? 0) && snapshot.version === (e.version ?? 0) &&
        snapshot.revision === (e.revision ?? "");
    });
  }, [props.ctx.pieces]);
  const lifetime = props.ctx.pieces.captureLifetime();
  // Reset during render so child card effects cannot read a cache from before a lock transition.
  // The store notifies synchronously when its lifetime changes, even before this room rerenders.
  peeks.reset(lifetime);
  useEffect(() => {
    const store = props.ctx.pieces;
    let observedLifetime = store.captureLifetime();
    peeks.reset(observedLifetime);
    const unsubscribe = store.subscribeList(() => {
      const next = store.captureLifetime();
      if (next !== observedLifetime) {
        observedLifetime = next;
        peeks.reset(next);
      }
    });
    return () => {
      unsubscribe();
      peeks.reset(null);
    };
  }, [peeks, props.ctx.pieces]);
  // "Imported 3 days ago" is read against one clock per studio read, not a new one per render.
  const clock = useRef<{ owner: AppContext["pieces"]; lifetime: number; now: number } | null>(null);
  if (clock.current?.owner !== props.ctx.pieces || clock.current.lifetime !== lifetime) {
    clock.current = { owner: props.ctx.pieces, lifetime, now: Date.now() };
  }
  const now = clock.current.now;

  if (single) {
    const deck = deckMeta(single);
    const section = sections[0] ?? { deck, numeral: "I", pieces: [], total: props.singleTotal };
    return (
      <div className="lcar">
        <Section {...props} section={section} total={props.singleTotal} peeks={peeks} now={now} solo />
      </div>
    );
  }

  if (sections.length === 0) {
    // Every piece is still in the studio; a search hid them all. Say so, with the count.
    return (
      <NoMatchNotice query={props.query} deckPlural="Pieces" deckTotal={props.studioTotal} elsewhere={[]}
        onJump={props.onJump} onClear={() => props.setQuery("")} />
    );
  }

  return (
    <div className="lcar">
      {sections.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (s) => (
        <Section key={s.deck.kind} {...props} section={s} total={s.total} peeks={peeks} now={now} solo={false} />
      ))}
    </div>
  );
}

/** One deck's section: its header (count, view switch, New) and whichever view it shows. */
function Section(props: ShelvesProps & { section: CarouselSection; total: number; peeks: PeekQueue; now: number; solo: boolean }): JSX.Element {
  const { ctx, section, total, parsed, layout } = props;
  const { deck, pieces } = section;
  const kind = deck.kind;
  const offered = deckViews(kind);
  const chosen = sectionView(props.views, kind, offered.map((v) => v.id));
  const vctx = { ...props.vctxFor(kind, pieces), peeks: props.peeks,
    cardFacts: (e: StudioEntitySummary) => cardFacts(e, props.meta) };
  const view = offered.find((v) => v.id === chosen);

  const body =
    pieces.length === 0 ? (
      // A SHELF FILTERED TO NOTHING IS NOT AN EMPTY SHELF, and the reverse holds too.
      isFilteredEmpty(parsed, total) ? (
        <NoMatchNotice query={props.query} deckPlural={deck.plural} deckTotal={total}
          elsewhere={props.perDeck.filter((m) => m.kind !== kind)} onJump={props.onJump} onClear={() => props.setQuery("")} />
      ) : (
        <div className="ghost-shelf">
          {`your first ${deck.singular.toLowerCase()} lands here · import or start fresh`}
          <NewInDeckButton kind={kind} ctx={ctx} onCreated={props.onCreated} />
        </div>
      )
    ) : !view ? (
      <CardRow pieces={pieces} layout={layout} vctx={vctx} peeks={props.peeks} meta={props.meta} now={props.now}
        newTile={<NewInDeckButton tile kind={kind} ctx={ctx} onCreated={props.onCreated} />} />
    ) : (
      // A drop-in view in a section: its own scroller, bounded so the page keeps flowing past it.
      <div className="lview libstage" style={{ "--a": deck.accent } as CSSProperties}>
        <view.Component ctx={vctx} />
      </div>
    );

  const cut = Math.ceil(deck.plural.length / 2);
  return (
    <section className={`lsec-wrap${props.solo ? " solo" : ""}`} data-kind={kind} data-part="library.section" style={{ "--a": deck.accent } as CSSProperties}>
      <div className="lsec" data-part="library.section.header">
        <div className="num" aria-hidden="true">{section.numeral}.</div>
        <div className="shead">
          {/* Two-tone like RC's: the second half of the name takes the accent. */}
          <h2 className="stitle">{deck.plural.slice(0, cut)}<em>{deck.plural.slice(cut)}</em></h2>
          <div className="ssub">{deck.blurb}</div>
        </div>
        <div className="sside">
          <div className="scount" title={parsed.active ? `${String(pieces.length)} of ${String(total)} match` : undefined}>
            <b>{parsed.active ? `${String(pieces.length)} of ${String(total)}` : total}</b>
            <em>{(total === 1 ? deck.singular : deck.plural).toLowerCase()}</em>
          </div>
          <div className="sviews">
            <div className="viewseg" data-tour="views">
              <Segmented
                label={`${deck.plural} view`}
                size="sm"
                value={view?.id ?? CARDS_VIEW}
                onChange={(id) => props.setView(kind, id)}
                items={[
                  { value: CARDS_VIEW, label: <><Icon svg={CARDS_ICON} />Cards</>, title: "Cards view" },
                  ...offered.map((v) => ({ value: v.id, label: <><Icon svg={v.iconSvg} />{v.label}</>, title: `${v.label} view` })),
                ]}
              />
            </div>
            {pieces.length > 0 && <NewInDeckButton compact kind={kind} ctx={ctx} onCreated={props.onCreated} />}
          </div>
        </div>
      </div>
      {body}
    </section>
  );
}

/**
 * The art dial, in the top bar: one size for the whole page. It sizes the cards (at its resting
 * setting they are RC's own 23.75rem) and the Tiles, Show, and List art, live while dragging.
 */
export function SizeDial({ ctx, sizeRem, setSizeRem, rootRef, prefKey }: {
  ctx: AppContext;
  sizeRem: number;
  setSizeRem(next: number): void;
  rootRef: RefObject<HTMLDivElement | null>;
  prefKey: string;
}): JSX.Element {
  return (
    <label className="sizedial" data-tour="size">
      <span className="sk">art</span>
      <Slider
        readout={false}
        min={SIZE_RANGE.min}
        max={SIZE_RANGE.max}
        step={0.5}
        defaultValue={sizeRem}
        title="Art size"
        aria-label="Art size"
        onInput={(ev) => {
          const val = clampSize(Number((ev.target as HTMLInputElement).value));
          rootRef.current?.style.setProperty("--card-w", `${val}rem`); // live, no re-render
        }}
        onChange={(n) => {
          const val = clampSize(n);
          setSizeRem(val);
          ctx.prefs.set(prefKey, val);
        }}
      />
    </label>
  );
}
