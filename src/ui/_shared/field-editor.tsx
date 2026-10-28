/**
 * The field editor a tracker and a tool share: the fields listed on the left (add, reorder, delete), and one field's page beside it: name, what it
 * means, type, and what follows the type (field-bodies.tsx). A tracker's field also has an icon and a start; a tool's has "the AI must fill it".
 * It draws two grid cells (the list, the page) so its editor lays them out beside its own rail; the editor owns the list and judges
 * the result with the kind's decoder. A rename or a delete is reported with the change, so the owner can follow it (a tool's roll field).
 */
import { useRef, useState, type JSX, type ReactNode } from "react";
import { Ic, type IconName } from "./ic";
import { addField, moveItem, removeField, renameField, retypeField, topCandidates, type ListedField } from "./field-ops";
import { VirtualRows } from "./virtual-list";
import { Button, IconButton, ListRow, Segmented, Toggle } from "../components/button";
import { IconPicker } from "../components/icon-picker";
import { Input } from "../components/rc-controls";
import { ChoiceBody, NumberBody, TextBody, YesNoBody, type BodyField, type Update } from "./field-bodies";
import type { FieldType } from "../../entities/_shared/field-schema";
import s from "./field-editor.module.css";

/**
 * What a field list change was, when it was more than an edit of one field's own words. A rename is many keystrokes: `from` is the name the field had when
 * the rename began and `session` says which rename this is, so whoever follows the rename (a tool's roll, a prompt line) rewrites from what it held then,
 * never from a name passed through on the way.
 */
export type FieldChange = { renamed: { from: string; to: string; session: number } } | { removed: string };

type Field = ListedField & BodyField & { description: string; icon?: string; required?: boolean };

const TYPE_ICON: Record<FieldType, IconName> = { text: "lucide:type", number: "lucide:hash", boolean: "lucide:square-check-big", choice: "lucide:list" };
const TYPE_WORD: Record<FieldType, string> = { text: "text", number: "number", boolean: "yes or no", choice: "choice" };
const ROW_ESTIMATE = 52;

/** One line saying what a field is: its type, a number's range, a choice's choices, and what it starts at (a tool's: whether the AI must fill it). */
function fieldLine(f: Field, tool: boolean): string {
  if (tool) return `${TYPE_WORD[f.type]} · ${f.required ? "needed" : "optional"}`;
  const range = f.maxField !== undefined ? ` · up to ${f.maxField}` : f.min !== undefined && f.max !== undefined ? ` · ${String(f.min)} to ${String(f.max)}` : f.min !== undefined ? ` · ${String(f.min)} or more` : f.max !== undefined ? ` · up to ${String(f.max)}` : "";
  const choices = f.type === "choice" && f.choices?.length ? ` · ${f.choices.join(", ")}` : "";
  const start = f.default === undefined ? "" : ` · starts ${typeof f.default === "boolean" ? (f.default ? "yes" : "no") : String(f.default)}`;
  return `${TYPE_WORD[f.type]}${range}${choices}${start}`;
}

export function FieldEditor<F extends Field>({ tool = false, fields, make, onChange, above }: {
  /** A tool's fields: the AI must fill them or not, and nothing more. Otherwise a tracker's: an icon, a range and a start. */
  tool?: boolean;
  fields: readonly F[];
  /** A new field with the name it is given. */
  make(name: string): F;
  onChange(fields: F[], change?: FieldChange): void;
  /** Whatever the editor puts above the field's page (a tool's action). */
  above?: ReactNode;
}): JSX.Element {
  const [picked, pick] = useState(0);
  /** The rename in progress: which field, the list when it began and the list last handed out (a change from elsewhere ends it). */
  const rename = useRef<{ id: number; index: number; start: readonly F[]; last: readonly F[] } | null>(null);
  const renames = useRef(0);
  const setPicked = (next: number): void => { rename.current = null; pick(next); };
  const scroller = useRef<HTMLDivElement>(null);
  const at = Math.min(picked, fields.length - 1);
  const field = fields[at];
  const emit = (next: F[], change?: FieldChange): void => { onChange(next, change); if (rename.current && !change) rename.current = null; };
  const edit = (change: (f: F) => F): void => emit(fields.map((f, i) => (i === at ? change(f) : f)));
  const update: Update = (change) => edit((f) => change(f) as F);
  const renameTo = (name: string): void => {
    if (rename.current?.index !== at || rename.current.last !== fields) rename.current = { id: ++renames.current, index: at, start: fields, last: fields };
    const session = rename.current;
    const next = renameField(fields, at, name, session.start);
    session.last = next;
    onChange(next, { renamed: { from: session.start[at]!.name, to: name, session: session.id } });
  };
  const remove = (): void => { setPicked(Math.max(0, at - 1)); onChange(removeField(fields, at), { removed: field!.name }); };
  const move = (by: -1 | 1): void => { setPicked(at + by); onChange(moveItem(fields, at, by)); };
  const add = (): void => { setPicked(fields.length); onChange(addField(fields, "field", make)); };
  const noIcon = (): F => Object.fromEntries(Object.entries(field!).filter(([key]) => key !== "icon")) as F;
  const tops = field ? topCandidates(fields, at) : [];
  return (
    <>
      <aside className={s.toc} aria-label="Fields" data-part="field-editor.list">
        <h3 className={s.title}>Fields</h3>
        <div ref={scroller} className={s.rows}>
          <VirtualRows scroll={scroller} items={fields} keyOf={(_, i) => String(i)} estimate={ROW_ESTIMATE}
            render={(f, i) => <ListRow label={f.name || "(no name)"} subtitle={fieldLine(f, tool)} leading={<Ic name={TYPE_ICON[f.type]} size={16} />} selected={i === at} aria-pressed={i === at} onClick={() => setPicked(i)} />} />
        </div>
        <div className={s.add}><Button size="sm" block icon="lucide:plus" onClick={add}>New field</Button></div>
      </aside>
      <div className={s.page} data-part="field-editor.page">
        {above}
        {field && (
          <>
            <div className={s.pager}>
              <h3 className={s.title}>Field</h3>
              <span className={s.grow} />
              <IconButton label="Move up" icon="lucide:chevron-up" size="sm" disabled={at === 0} onClick={() => move(-1)} />
              <IconButton label="Move down" icon="lucide:chevron-down" size="sm" disabled={at === fields.length - 1} onClick={() => move(1)} />
              <IconButton label="Delete field" icon="lucide:trash-2" size="sm" variant="quiet" onClick={remove} />
            </div>
            <div className={s.two}>
              <div>
                <div className={s.label}>Name</div>
                <Input aria-label="Field name" className={s.mono} value={field.name} onBlur={() => { rename.current = null; }} onChange={(e) => renameTo(e.target.value)} />
                <p className={s.hint}>Lowercase, digits and _ (what macros and the AI use).</p>
              </div>
              <div>
                <div className={s.label}>What it means</div>
                <Input aria-label="What it means" value={field.description} onChange={(e) => edit((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className={s.typeRow}>
              <div>
                <div className={s.label}>Type</div>
                <Segmented size="sm" label="Field type" value={field.type} onChange={(type) => { rename.current = null; onChange(retypeField(fields, at, type)); }}
                  items={(["text", "number", "boolean", "choice"] as const).map((value) => ({ value, label: value === "boolean" ? "Yes or no" : value[0]!.toUpperCase() + value.slice(1) }))} />
              </div>
              {tool ? (
                <Toggle on={field.required === true} label="The AI must fill it" onChange={(required) => edit((f) => ({ ...f, required }))} />
              ) : (
                <div>
                  <div className={s.label}>Icon</div>
                  <IconPicker value={field.icon} onChange={(icon) => edit((f) => (icon === undefined ? noIcon() : { ...f, icon }))} />
                </div>
              )}
            </div>
            {field.type === "choice" && <ChoiceBody field={field} update={update} startsAt={!tool} />}
            {!tool && field.type === "number" && <NumberBody field={field} tops={tops} update={update} />}
            {!tool && field.type === "boolean" && <YesNoBody field={field} update={update} />}
            {!tool && field.type === "text" && <TextBody field={field} update={update} />}
          </>
        )}
      </div>
    </>
  );
}
