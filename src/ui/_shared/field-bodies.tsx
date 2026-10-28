/**
 * What follows a tracker field's type in the field editor: a number's From, To (a fixed number, another number field, or none) and Starts at;
 * a choice field's choices as chips and its starting choice; a yes-or-no field's starting value; a text field's starting text. A blank
 * start is "not set" (the type's own start applies). A tool field has none of these but its choices, so the tool editor shows only ChoiceBody.
 */
import { useRef, useState, type JSX } from "react";
import type { TrackerField } from "../../entities/tracker/schema";
import { Button, IconButton, Segmented } from "../components/button";
import { VirtualRows } from "./virtual-list";
import { NumberInput } from "../components/number-input";
import { Input, Select } from "../components/rc-controls";
import s from "./field-editor.module.css";

/** A field of either kind, as the bodies read and change it. */
export type BodyField = Pick<TrackerField, "name" | "type" | "choices" | "min" | "max" | "maxField" | "default">;
export type Update = (change: (field: BodyField) => BodyField) => void;

const without = <T extends object>(from: T, ...keys: (keyof T)[]): T => Object.fromEntries(Object.entries(from).filter(([key]) => !(keys as string[]).includes(key))) as T;

const CHOICE_ESTIMATE = 36;

type To = "number" | "field" | "none";

export function NumberBody({ field, tops, update }: { field: BodyField; tops: readonly string[]; update: Update }): JSX.Element {
  const to: To = field.maxField !== undefined ? "field" : field.max !== undefined ? "number" : "none";
  const pickTo = (next: To): void => update((f) => {
    const bare = without(f, "max", "maxField");
    if (next === "number") return { ...bare, max: Math.max(f.min ?? 0, typeof f.default === "number" ? f.default : 0) };
    return next === "field" ? { ...bare, maxField: tops[0]! } : bare;
  });
  return (
    <div className={s.three}>
      <div><div className={s.label}>From</div><NumberInput aria-label="From" value={field.min} onChange={(min) => update((f) => (min === undefined ? without(f, "min") : { ...f, min }))} /></div>
      <div>
        <div className={s.label}>To</div>
        <Segmented size="sm" label="Where the top comes from" value={to} onChange={pickTo}
          items={[{ value: "number", label: "A number" }, { value: "field", label: "Another field", disabled: tops.length === 0 && to !== "field", title: tops.length === 0 ? "Add another number field first" : undefined }, { value: "none", label: "None" }]} />
        {to === "number" && <NumberInput aria-label="Top" value={field.max} onChange={(max) => update((f) => (max === undefined ? without(f, "max") : { ...f, max }))} />}
        {to === "field" && (
          <Select aria-label="Top field" value={field.maxField} onChange={(e) => update((f) => ({ ...f, maxField: e.target.value }))}>
            {(tops.includes(field.maxField!) ? tops : [field.maxField!, ...tops]).map(/* bounded-ok: native select options, scrolled by the browser rather than drawn as rows */ (name) => <option key={name} value={name}>{name}</option>)}
          </Select>
        )}
      </div>
      <div><div className={s.label}>Starts at</div><NumberInput aria-label="Starts at" value={typeof field.default === "number" ? field.default : undefined} onChange={(value) => update((f) => (value === undefined ? without(f, "default") : { ...f, default: value }))} /></div>
    </div>
  );
}

export function ChoiceBody({ field, update, startsAt }: { field: BodyField; update: Update; startsAt: boolean }): JSX.Element {
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const choices = field.choices ?? [];
  const add = (): void => {
    const next = draft.trim();
    if (!next || choices.includes(next)) return;
    update((f) => ({ ...f, choices: [...(f.choices ?? []), next] }));
    setDraft("");
  };
  const remove = (gone: string): void => update((f) => { const next = { ...f, choices: (f.choices ?? []).filter((c) => c !== gone) }; return f.default === gone ? without(next, "default") : next; });
  return (
    <div>
      <div className={s.label}>Choices</div>
      <div ref={scroller} className={s.choices}>
        <VirtualRows scroll={scroller} items={choices} keyOf={(choice) => choice} estimate={CHOICE_ESTIMATE}
          render={(choice) => (
            <div className={s.choiceRow}>
              <span>{choice}</span>
              <IconButton label={`Remove ${choice}`} icon="lucide:x" size="sm" variant="quiet" onClick={() => remove(choice)} />
            </div>
          )} />
      </div>
      <div className={s.line}>
        <Input aria-label="New choice" placeholder="Add a choice..." value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className={s.inline} />
        <Button size="sm" disabled={!draft.trim() || choices.includes(draft.trim())} onClick={add}>Add</Button>
      </div>
      {startsAt && (
        <div className={s.after}>
          <div className={s.label}>Starts at</div>
          <Select aria-label="Starts at" value={typeof field.default === "string" ? field.default : ""} onChange={(e) => update((f) => (e.target.value === "" ? without(f, "default") : { ...f, default: e.target.value }))}>
            <option value="">The first choice</option>
            {choices.map(/* bounded-ok: native select options, scrolled by the browser rather than drawn as rows */ (choice) => <option key={choice} value={choice}>{choice}</option>)}
          </Select>
        </div>
      )}
    </div>
  );
}

export function YesNoBody({ field, update }: { field: BodyField; update: Update }): JSX.Element {
  return (
    <div>
      <div className={s.label}>Starts at</div>
      <Segmented size="sm" label="Starts at" value={field.default === true ? "yes" : "no"} onChange={(v) => update((f) => ({ ...f, default: v === "yes" }))} items={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} />
    </div>
  );
}

export function TextBody({ field, update }: { field: BodyField; update: Update }): JSX.Element {
  return (
    <div>
      <div className={s.label}>Starts at</div>
      <Input aria-label="Starts at" placeholder="blank" value={typeof field.default === "string" ? field.default : ""} onChange={(e) => update((f) => (e.target.value === "" ? without(f, "default") : { ...f, default: e.target.value }))} />
    </div>
  );
}
