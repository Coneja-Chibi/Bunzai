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
import { Button, Segmented, ListRow } from "../../components/button";
import { Panel } from "../../components/panel";
import { RoomHeader } from "../../components/room-header";

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
    <Panel as="aside" className="lrail" data-part="library.decks" aria-label="Library decks">
      <div className="lrail-head">
        <RoomHeader
          data-part="library.rail.head"
          kicker={<span className="ey">Your collection</span>}
          title={<span className="ttl">THE <em>LIBRARY</em></span>}
          lede="Cast, worlds and every piece you keep."
        />
        <div className="lrail-toggle" data-tour="layout">
          <Segmented
            label="Layout"
            size="sm"
            value={layout}
            onChange={props.onLayout}
            items={[
              { value: "carousel", label: "Carousel", title: "Each deck in one row that scrolls sideways" },
              { value: "grid", label: "Grid", title: "Each deck's cards wrapping onto as many rows as they need" },
            ]}
          />
        </div>
      </div>
      <div className="lrail-scroll">
        <div className="lrail-div">Decks</div>
        <div className="lrail-rows" data-tour="decks">
          {decks.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ ({ kind, count }) => {
            const meta = deckMeta(kind);
            // While a search runs the count is MATCHES; the title keeps the real total so no count
            // ever reads as a loss.
            const shown = matched ? (matched.get(kind) ?? 0) : count;
            const on = kind === selected;
            return (
              <ListRow
                key={kind}
                accent={meta.accent}
                selected={on}
                aria-pressed={on}
                title={on ? "Showing only this deck - click to show every deck" : matched ? `${String(shown)} of ${String(count)} match` : `${String(count)} in the studio`}
                onClick={() => props.onDeck(kind)}
                leading={<span className="tile"><Icon svg={meta.glyph} /></span>}
                label={<span className="n">{meta.plural}</span>}
                subtitle={<span className="d">{meta.blurb}</span>}
                meta={<span className={`cnt${shown === 0 ? " zero" : ""}`}>{shown}</span>}
              />
            );
          })}
          <ListRow
            data-part="library.trash"
            accent="var(--stage-danger-edge)"
            selected={props.trash.on}
            aria-pressed={props.trash.on}
            title="Deleted pieces, kept for 3 days"
            onClick={props.trash.onToggle}
            leading={<span className="tile"><Icon svg={TRASH_GLYPH} /></span>}
            label={<span className="n">Trash</span>}
            subtitle={<span className="d">Restore deleted pieces within 3 days</span>}
            meta={<span className={`cnt${props.trash.count === 0 ? " zero" : ""}`}>{props.trash.count}</span>}
          />
        </div>
        {collections.length > 0 && (
          <>
            <div className="lrail-div">Collections</div>
            <div className="lrail-rows">
              {collections.map((c) => {
                const term = collectionQuery(c.id);
                const on = query.trim() === term;
                return (
                  <ListRow
                    key={c.id}
                    selected={on}
                    aria-pressed={on}
                    title={on ? "Showing this collection - click to stop filtering" : `Show only what is in ${c.name}`}
                    onClick={() => props.setQuery(on ? "" : term)}
                    leading={<span className="tile"><Icon svg={COLLECTION_GLYPH} /></span>}
                    label={<span className="n">{c.name}</span>}
                    subtitle={<span className="d">{`${String(c.members.length)} ${c.members.length === 1 ? "piece" : "pieces"}`}</span>}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="lrail-add">
        <Button variant="primary" block onClick={props.onAdd} title="Import files into the studio">
          + Add to the library
        </Button>
      </div>
    </Panel>
  );
}

const COLLECTION_GLYPH = icSvg("lucide:folder", 18);

/** The top bar's All / Recent switch (RC's filter pair). Recent is the Workbench's own recency. */
export function OrderSwitch({ order, onOrder }: { order: ShelfOrder; onOrder(next: ShelfOrder): void }): JSX.Element {
  return (
    <div className="lfilter">
      <Segmented
        label="Order"
        size="sm"
        value={order}
        onChange={onOrder}
        items={[
          { value: "all", label: "All", title: "Studio order, or best match first while searching" },
          { value: "recent", label: "Recent", title: "Newest first: the later of when a piece arrived and when it was last opened" },
        ]}
      />
    </div>
  );
}
