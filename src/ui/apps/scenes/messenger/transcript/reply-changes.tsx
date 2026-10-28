/**
 * What is drawn under a reply (approved wireframe premiere/scene-pieces.html, section 3, option D, and 3f): the tracker changes in each tracker's own style (chips: one badge per changed line, a
 * click opens the tracker in the Trackers panel; card: a small card per tracker with the new value and the old one under it; toast: a marker that reopens the notice; hidden: nothing), and the
 * one line when a macro ran out of time while the prompt was built. What to draw is decided in reply-changes-core.ts; this only paints it. Colors come from the layout's tokens in reply-changes-style.ts.
 */
import type { CSSProperties, JSX } from "react";
import type { TrackerChanged } from "../../../../../studio/tracker-changes";
import { Ic } from "../../../../_shared/ic";
import { Button, Chip } from "../../../../components/button";
import { FieldIcon } from "../panels/trackers/library-draw";
import { cardRows, chipsOf, markerText, outOfTimeWords, splitByStyle, type ChipView } from "./reply-changes-core";

const Bar = ({ fill, was }: { fill: number; was?: number | undefined }): JSX.Element => (
  <span className="msn-rc-bar" aria-hidden="true" style={{ "--fill": `${fill * 100}%`, ...(was !== undefined ? { "--was": `${was * 100}%` } : {}) } as CSSProperties}><i />{was !== undefined && <s />}</span>
);

function ChipBadge({ chip, trackerId, onOpen }: { chip: ChipView; trackerId: string; onOpen(trackerId: string): void }): JSX.Element {
  return (
    <Chip data-part="scene.messenger.change.chip" data-tracker={trackerId} onClick={() => onOpen(trackerId)}>
      <FieldIcon icon={chip.icon} />
      <span>{chip.label}</span>
      {chip.fill !== undefined && <Bar fill={chip.fill} />}
      {chip.value !== undefined && <span className="msn-rc-v">{chip.value}</span>}
      {chip.delta && <span className="msn-rc-d" data-dir={chip.delta.dir}>{chip.delta.text}</span>}
    </Chip>
  );
}

function ChangeCard({ tracker, onOpen }: { tracker: TrackerChanged; onOpen(trackerId: string): void }): JSX.Element {
  return (
    <section className="msn-rc-card" data-part="scene.messenger.change.card" data-tracker={tracker.trackerId}>
      <header><FieldIcon icon={tracker.icon} /><Button variant="link" size="sm" onClick={() => onOpen(tracker.trackerId)}>{tracker.name}</Button><small>changed by this reply</small></header>
      {cardRows(tracker).map(/* bounded-ok: the lines of one reply's change to one tracker, drawn under that reply */ (row) => (
        <div key={row.key} className="msn-rc-row">
          <span className="msn-rc-k"><FieldIcon icon={row.icon} />{row.label}</span>
          {row.bar && <Bar fill={row.bar.fill} was={row.bar.was} />}
          <span className="msn-rc-v">{row.now}</span>
          {row.was !== undefined && <small className="msn-rc-was">was {row.was}</small>}
        </div>
      ))}
    </section>
  );
}

/** The trackers one reply changed, each in its own style. Nothing at all when none of them draws anything. */
export function ChangeBlock({ trackers, onOpen, onMarker }: { trackers: readonly TrackerChanged[]; onOpen(trackerId: string): void; onMarker(): void }): JSX.Element | null {
  const { chips, cards, toasts } = splitByStyle(trackers);
  if (chips.length + cards.length + toasts.length === 0) return null;
  return (
    <div className="msn-rc" data-part="scene.messenger.change">
      {cards.map(/* bounded-ok: the trackers one reply changed */ (t) => <ChangeCard key={t.trackerId} tracker={t} onOpen={onOpen} />)}
      {chips.length > 0 && (
        <div className="msn-rc-chips">
          {chips.flatMap(/* bounded-ok: the lines of one reply's changes, drawn under that reply */ (t) => chipsOf(t).map((c) => <ChipBadge key={c.key} chip={c} trackerId={t.trackerId} onOpen={onOpen} />))}
        </div>
      )}
      {toasts.length > 0 && <Chip data-part="scene.messenger.change.marker" onClick={onMarker}><Ic name="lucide:sparkles" size={13} />{markerText(toasts)}</Chip>}
    </div>
  );
}

/** "1 macro ran out of time building this prompt ({{tally}}). Prompt Inspector". */
export function OutOfTimeLine({ macros, onInspect }: { macros: readonly { macro: string }[]; onInspect(): void }): JSX.Element {
  return (
    <p className="msn-rc-late" data-part="scene.messenger.out-of-time"><Ic name="lucide:clock" size={13} />{outOfTimeWords(macros)} <Button variant="link" size="sm" onClick={onInspect}>Prompt Inspector</Button></p>
  );
}
