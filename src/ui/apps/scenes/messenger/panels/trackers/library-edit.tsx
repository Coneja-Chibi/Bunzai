/**
 * The controls that edit one field of a linked library tracker in the panel's open card (wireframe premiere/scene-pieces.html, 1a): drag a bar or type a number, pick a pip, switch yes or no,
 * type text. Each sends only the value the person chose; the server holds a number inside its range the way the narrator's tool does, so nothing is clamped differently here. A bar follows the hand while it is dragged (the pointer is captured) and writes once when the drag ends, whether it is released, cancelled or loses focus; a key step or a typed value writes when it is made. A bar over whole numbers is dragged; any other number is typed, which takes any value.
 */
import { useRef, useState, type JSX } from "react";
import type { TrackerRecord } from "../../../../../../core/tracker";
import type { TrackerField } from "../../../../../../entities/tracker/schema";
import { Chip, Toggle } from "../../../../../components/button";
import { NumberInput } from "../../../../../components/number-input";
import { Input } from "../../../../../components/rc-controls";
import { Slider } from "../../../../../components/slider";
import { FieldIcon } from "./library-draw";
import { draggable, topOf } from "./library-core";

/** Writes one field: its name and the value the person chose. */
export type SetField = (name: string, value: string | number | boolean) => Promise<unknown>;

/** A bar: it follows the hand while it is dragged (`live`), and writes once on release; a key step or a typed value arrives with no pointer down and writes at once. */
function Bar({ field, current, bottom, top, set }: { field: TrackerField; current: number; bottom: number; top: number; set: SetField }): JSX.Element {
  const [live, setLive] = useState<number | null>(null);
  const [writing, setWriting] = useState(false);
  const dragging = useRef(false);
  const commit = (value: number): void => { setLive(value); setWriting(true); void set(field.name, value).finally(() => { setWriting(false); setLive(null); }); };
  /** The drag ends however it ends (released, cancelled by a touch scroll, focus lost): the shown value is written, as a release writes it. The pointer is captured, so a release outside the bar still arrives here. */
  const finish = (): void => { dragging.current = false; if (live !== null && live !== current) commit(live); else setLive(null); };
  return (
    <Slider min={bottom} max={top} step={1} value={live ?? current} format={(v) => `${v}/${top}`} aria-label={field.name} disabled={writing}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); }}
      onPointerUp={finish} onPointerCancel={finish} onBlur={finish}
      onChange={(v) => { if (dragging.current) setLive(v); else if (v !== current) commit(v); }} />
  );
}

function NumberField({ field, record, set }: { field: TrackerField; record: TrackerRecord; set: SetField }): JSX.Element {
  const current = typeof record[field.name] === "number" ? record[field.name] as number : 0;
  const top = topOf(field, record);
  const bottom = field.min ?? 0;
  if (top !== undefined && top > bottom && draggable(bottom, top, current)) return <Bar field={field} current={current} bottom={bottom} top={top} set={set} />;
  return <TypedNumber key={current} field={field} start={current} onCommit={(v) => set(field.name, v)} />;
}

/** An open number: typed, and written when the box is left or Enter is pressed (a half-typed number is never written; an empty box writes nothing). */
function TypedNumber({ field, start, onCommit }: { field: TrackerField; start: number; onCommit(value: number): Promise<unknown> }): JSX.Element {
  const [typed, setTyped] = useState<number | undefined>(start);
  const commit = (): void => { if (typed !== undefined && typed !== start) void onCommit(typed); };
  return <NumberInput value={typed} onChange={setTyped} aria-label={field.name} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />;
}

function TextField({ field, current, set }: { field: TrackerField; current: string; set: SetField }): JSX.Element {
  const [typed, setTyped] = useState(current);
  const commit = (): void => { if (typed !== current) void set(field.name, typed); };
  return <Input value={typed} aria-label={field.name} onChange={(e) => setTyped(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />;
}

/** One field's editor, with its icon and name; `disabled` while there is nothing to attach a change to. */
export function FieldEdit({ field, record, set, disabled }: { field: TrackerField; record: TrackerRecord; set: SetField; disabled?: boolean }): JSX.Element {
  const value = record[field.name];
  const control = field.type === "number" ? <NumberField field={field} record={record} set={set} />
    : field.type === "boolean" ? <Toggle on={value === true} label={field.name} onChange={(on) => void set(field.name, on)} />
    : field.type === "choice" ? (
      <div className="msn-lib-pips" role="group" aria-label={field.name}>
        {(field.choices ?? []).map(/* bounded-ok: a choice field's own choices, the few the person wrote */ (c) => <Chip key={c} pressed={c === value} onClick={() => void set(field.name, c)}>{c}</Chip>)}
      </div>
    ) : <TextField key={String(value)} field={field} current={String(value ?? "")} set={set} />;
  return (
    <fieldset className="msn-lib-edit" disabled={disabled} data-part="scene.messenger.trackers.edit" data-field={field.name}>
      {field.type !== "boolean" && <span className="msn-lib-k"><FieldIcon icon={field.icon} />{field.name}</span>}
      {control}
    </fieldset>
  );
}
