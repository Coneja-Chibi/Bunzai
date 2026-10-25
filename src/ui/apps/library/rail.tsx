/**
 * The Library rail: RoleCall's collection sidebar, ported. The header with RC's Carousel / Grid
 * switch, one row per deck with its count, the person's collections, and the Add button.
 *
 * A DECK ROW FILTERS, as RC's does: clicking one shows that deck alone (with its view bar), and
 * clicking it again shows every deck.
 *
 * A renderer. What a count means while a search runs, which deck is picked, and what a collection
 * click does are all decided by the room (index.tsx); this file only draws them.
 *
 * A COLLECTION ROW IS A SEARCH, exactly as its chip in the collections bar is: clicking writes
 * `collection:<id>` into the search box, so the person can see why the shelf changed and undo it by
 * hand. The rail names no second way to filter.
 */
import type { CSSProperties, JSX } from "react";
import { deckMeta } from "../../_shared/decks";
import type { Collection } from "../../../studio/collections-shape";
import { collectionQuery } from "./collections-ops";
import type { ShelfLayout, ShelfOrder } from "./carousel-core";
import { Icon } from "./icon";
import { TRASH_GLYPH } from "./trash-panel";
import { icSvg } from "../../_shared/ic-svg";

export interface LibraryRailProps {
  layout: ShelfLayout;
  onLayout(next: ShelfLayout): void;
  /** every deck with its studio total, in rail order */
  decks: readonly { kind: string; count: number }[];
  /** per-deck match counts while a search runs; absent when none does */
  matched?: ReadonlyMap<string, number>;
  /** the deck shown alone, or null while every deck shows */
  selected: string | null;
  onDeck(kind: string): void;
  collections: readonly Collection[];
  query: string;
  setQuery(next: string): void;
  onAdd(): void;
  /** RoleCall's Trash row: how many deleted pieces wait, whether the Trash is showing, and its toggle */
  trash: { count: number; on: boolean; onToggle(): void };
}

export function LibraryRail(props: LibraryRailProps): JSX.Element {
  const { layout, decks, matched, selected, collections, query } = props;
  return (
    <aside className="lrail" data-part="library.decks" aria-label="Library decks">
      <div className="lrail-head">
        <div className="ey">Your collection</div>
        <div className="ttl">
          THE <em>LIBRARY</em>
        </div>
        <div className="lrail-toggle" role="group" aria-label="Layout" data-tour="layout">
          <button type="button" className={layout === "carousel" ? "on" : undefined} aria-pressed={layout === "carousel"}
            title="Each deck in one row that scrolls sideways" onClick={() => props.onLayout("carousel")}>
            Carousel
          </button>
          <button type="button" className={layout === "grid" ? "on" : undefined} aria-pressed={layout === "grid"}
            title="Each deck's cards wrapping onto as many rows as they need" onClick={() => props.onLayout("grid")}>
            Grid
          </button>
        </div>
      </div>
      <div className="lrail-scroll">
        <div className="lrail-div">Decks</div>
        <div className="lrail-rows" data-tour="decks">
          {decks.map(({ kind, count }) => {
            const meta = deckMeta(kind);
            // While a search runs the count is MATCHES; the title keeps the real total so no count
            // ever reads as a loss.
            const shown = matched ? (matched.get(kind) ?? 0) : count;
            const on = kind === selected;
            return (
              <button
                type="button"
                key={kind}
                className={`lrow${on ? " on" : ""}`}
                style={{ "--a": meta.accent } as CSSProperties}
                aria-pressed={on}
                title={on ? "Showing only this deck - click to show every deck" : matched ? `${String(shown)} of ${String(count)} match` : `${String(count)} in the studio`}
                onClick={() => props.onDeck(kind)}
              >
                <span className="tile"><Icon svg={meta.glyph} /></span>
                <span className="tx">
                  <span className="n">{meta.plural}</span>
                  <span className="d">{meta.blurb}</span>
                </span>
                <span className={`cnt${shown === 0 ? " zero" : ""}`}>{shown}</span>
              </button>
            );
          })}
          <button type="button" className={`lrow trash${props.trash.on ? " on" : ""}`} aria-pressed={props.trash.on}
            title="Deleted pieces, kept for 3 days" onClick={props.trash.onToggle}>
            <span className="tile"><Icon svg={TRASH_GLYPH} /></span>
            <span className="tx">
              <span className="n">Trash</span>
              <span className="d">Restore deleted pieces within 3 days</span>
            </span>
            <span className={`cnt${props.trash.count === 0 ? " zero" : ""}`}>{props.trash.count}</span>
          </button>
        </div>
        {collections.length > 0 && (
          <>
            <div className="lrail-div">Collections</div>
            <div className="lrail-rows">
              {collections.map((c) => {
                const term = collectionQuery(c.id);
                const on = query.trim() === term;
                return (
                  <button
                    type="button"
                    key={c.id}
                    className={`lrow${on ? " on" : ""}`}
                    aria-pressed={on}
                    title={on ? "Showing this collection - click to stop filtering" : `Show only what is in ${c.name}`}
                    onClick={() => props.setQuery(on ? "" : term)}
                  >
                    <span className="tile"><Icon svg={COLLECTION_GLYPH} /></span>
                    <span className="tx">
                      <span className="n">{c.name}</span>
                      <span className="d">{`${String(c.members.length)} ${c.members.length === 1 ? "piece" : "pieces"}`}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="lrail-add">
        <button type="button" onClick={props.onAdd} title="Import files into the studio">
          + Add to the library
        </button>
      </div>
    </aside>
  );
}

const COLLECTION_GLYPH = icSvg("lucide:folder", 18);

/** The top bar's All / Recent switch (RC's filter pair). Recent is the Workbench's own recency. */
export function OrderSwitch({ order, onOrder }: { order: ShelfOrder; onOrder(next: ShelfOrder): void }): JSX.Element {
  return (
    <div className="lfilter" role="group" aria-label="Order">
      <button type="button" className={order === "all" ? "on" : undefined} aria-pressed={order === "all"}
        title="Studio order, or best match first while searching" onClick={() => onOrder("all")}>
        All
      </button>
      <button type="button" className={order === "recent" ? "on" : undefined} aria-pressed={order === "recent"}
        title="Newest first: the later of when a piece arrived and when it was last opened" onClick={() => onOrder("recent")}>
        Recent
      </button>
    </div>
  );
}
