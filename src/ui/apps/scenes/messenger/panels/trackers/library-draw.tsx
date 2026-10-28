/**
 * How a library tracker draws in the Messenger's Trackers panel (approved wireframe premiere/scene-pieces.html, 1a and 1b): a field by its type as game UI, a list as item tiles, and the card
 * that heads each linked tracker with its name, a Library tag and the reply that last changed it. What to draw is decided in library-core.ts; this only paints it. An icon id the build does
 * not ship draws no icon (knownIcon), never an error.
 */
import type { CSSProperties, JSX } from "react";
import type { TrackerRecord, TrackerValue } from "../../../../../../core/tracker";
import type { TrackerBody } from "../../../../../../entities/tracker/schema";
import type { SceneTracker } from "../../../../../../studio/scene-trackers";
import { Ic, knownIcon } from "../../../../../_shared/ic";
import { VirtualRows, VirtualShelf } from "../../../../../_shared/virtual-list";
import { ListRow } from "../../../../../components/button";
import { cardFields, fieldView, itemTiles, type FieldView, type ItemTile } from "./library-core";

const FIELD_ROW_PX = 28;
const TILE_ROW_PX = 44;

/** A field's icon, or nothing when the id is not one the build draws. */
export const FieldIcon = ({ icon }: { icon?: string | undefined }): JSX.Element | null => (knownIcon(icon) ? <Ic name={icon} size={14} /> : null);

/** One field as the card draws it: a bar with "7/20", the number, pips with the current one lit, one pip, or the quoted text. */
export function FieldRead({ view }: { view: FieldView }): JSX.Element {
  const label = <span className="msn-lib-k"><FieldIcon icon={view.icon} />{view.name}</span>;
  switch (view.kind) {
    case "bar":
      return (
        <div className="msn-lib-stat" data-part="scene.messenger.trackers.field" data-field={view.name}>
          {label}
          <span className="msn-lib-bar" role="meter" aria-label={view.name} aria-valuenow={view.value} aria-valuemin={0} aria-valuemax={view.top} style={{ "--fill": `${view.fill * 100}%` } as CSSProperties}><i /></span>
          <span className="msn-lib-v">{view.value}/{view.top}</span>
        </div>
      );
    case "number":
      return <div className="msn-lib-stat" data-part="scene.messenger.trackers.field" data-field={view.name}>{label}<span className="msn-lib-v">{view.value}</span></div>;
    case "pips":
      return (
        <div className="msn-lib-pips" data-part="scene.messenger.trackers.field" data-field={view.name}>
          {view.choices.map(/* bounded-ok: a choice field's own choices, the few the person wrote */ (c) => <span key={c} className="msn-lib-pip" data-on={c === view.current || undefined}>{c === view.current && <FieldIcon icon={view.icon} />}{c}</span>)}
        </div>
      );
    case "flag":
      return <div className="msn-lib-pips" data-part="scene.messenger.trackers.field" data-field={view.name}><span className="msn-lib-pip" data-on={view.on || undefined}><FieldIcon icon={view.icon} />{view.name}</span></div>;
    case "text":
      return <div className="msn-lib-stat" data-part="scene.messenger.trackers.field" data-field={view.name}>{label}<span className="msn-lib-text">&ldquo;{view.text}&rdquo;</span></div>;
  }
}

/** The tiles of a list tracker's rows: a windowed grid in its own scroll box, so a list of any length stays light. Every tile is a button: it picks the row. */
export function ItemTiles({ tiles, onPick, tail }: { tiles: readonly ItemTile[]; onPick(name: string): void; tail?: JSX.Element }): JSX.Element {
  return (
    <div className="msn-lib-scroll" data-part="scene.messenger.trackers.items">
      <VirtualShelf items={tiles} keyOf={(t) => t.name} rowClass="msn-lib-items" estimate={TILE_ROW_PX} {...(tail ? { tail } : {})}
        render={(t) => (
          <ListRow key={t.name} data-part="scene.messenger.trackers.item" data-item={t.name} label={t.name} leading={<FieldIcon icon={t.icon} />} {...(t.count !== undefined ? { meta: <span className="msn-lib-n">{t.count}</span> } : {})} onClick={() => onPick(t.name)} />
        )} />
    </div>
  );
}

/** A record's fields (the card leaves out a number that is another field's top: its bar shows it) or a list's rows as tiles. */
export function TrackerFace({ body, value, onPick }: { body: TrackerBody; value: TrackerValue; onPick(row: string): void }): JSX.Element {
  if (Array.isArray(value)) return value.length === 0 ? <p className="msn-lib-none">No items yet.</p> : <ItemTiles tiles={itemTiles(body, value)} onPick={onPick} />;
  const record: TrackerRecord = value;
  return <div className="msn-lib-scroll"><VirtualRows items={cardFields(body, record)} keyOf={(f) => f.name} estimate={FIELD_ROW_PX} render={(f) => <FieldRead view={fieldView(f, record)} />} /></div>;
}

/** The card of one linked tracker: its name, the Library tag, the reply that last changed it, and its fields or items. Clicking the head opens it. */
export function LibraryCard({ tracker, onOpen }: { tracker: SceneTracker; onOpen(): void }): JSX.Element {
  const { body, last } = tracker;
  return (
    <div className="msn-trk-card msn-lib-card" data-part={`scene.messenger.trackers.library.${tracker.id}`} data-library="">
      <ListRow data-part={`scene.messenger.trackers.library.open.${tracker.id}`} variant="picker" label={body.name} leading={<FieldIcon icon={body.icon} />} {...(last ? { subtitle: `reply ${last.number}` } : {})} meta={<span className="msn-lib-tag">Library</span>} onClick={onOpen} />
      <div className="msn-lib-face"><TrackerFace body={body} value={tracker.value} onPick={onOpen} /></div>
    </div>
  );
}
