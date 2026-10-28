/**
 * A tracker's Identity & settings: what it tracks, how the AI should update it (this text goes into the update tool), its shape (one record or
 * a list of rows), an icon, how a reply shows its changes, and the optional prompt line written in macros. A blank prompt line is no
 * prompt line (the plain line is used), so clearing it removes it rather than saving an empty one.
 */
import type { JSX } from "react";
import { DEFAULT_CHANGE_STYLE, type TrackerBody, type TrackerChangeStyle, type TrackerLayout } from "../../../../entities/tracker/schema";
import { Segmented } from "../../../components/button";
import { IconPicker } from "../../../components/icon-picker";
import { Select, Textarea } from "../../../components/rc-controls";
import { MacroChips } from "./macro-chips";
import s from "./piece.module.css";

const SHAPES: readonly { value: TrackerLayout; label: string }[] = [{ value: "record", label: "One record" }, { value: "list", label: "A list of rows" }];
const CHANGES: readonly { value: TrackerChangeStyle; label: string }[] = [{ value: "chips", label: "Chips" }, { value: "card", label: "Card" }, { value: "toast", label: "Toast" }, { value: "hidden", label: "Hidden" }];

export function TrackerSettings({ body, edit, onTemplate }: { body: TrackerBody; edit(update: (body: TrackerBody) => TrackerBody): void; onTemplate(): void }): JSX.Element {
  const set = <K extends keyof TrackerBody>(key: K, value: TrackerBody[K]): void => edit((b) => ({ ...b, [key]: value }));
  const setTemplate = (text: string): void => { onTemplate(); edit((b) => {
    const { template: _was, ...rest } = b;
    return text === "" ? rest : { ...rest, template: text };
  }); };
  const setIcon = (icon: string | undefined): void => edit((b) => {
    const { icon: _was, ...rest } = b;
    return icon === undefined ? rest : { ...rest, icon };
  });
  const template = body.template ?? "";
  const fieldMacro = (field: string): string => `tracker::${body.name}::${body.layout === "list" ? "row::" : ""}${field}`;
  return (
    <div className={s.section} data-part="piece.tracker.settings">
      <div className={s.two}>
        <div>
          <div className={s.label}>What it tracks</div>
          <Textarea aria-label="What it tracks" rows={3} value={body.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <div className={s.label}>How the AI should update it</div>
          <Textarea aria-label="How the AI should update it" rows={3} value={body.note} onChange={(e) => set("note", e.target.value)} />
        </div>
      </div>
      <div className={s.block}>
        <div className={s.label}>Shape</div>
        <Segmented size="sm" label="Shape" value={body.layout} onChange={(layout) => set("layout", layout)} items={SHAPES} />
        <p className={s.hint}>A list keeps one row per name (an inventory, a cast), each row with these fields.</p>
      </div>
      <div className={s.block}>
        <div className={s.label}>Icon</div>
        <IconPicker value={body.icon} onChange={setIcon} label="Tracker icon" />
        <p className={s.hint}>For the tracker, or for each row of a list.</p>
      </div>
      <div className={s.block}>
        <div className={s.label}>Show changes on replies as</div>
        <Segmented size="sm" label="Show changes on replies as" value={body.changes ?? DEFAULT_CHANGE_STYLE} onChange={(changes) => set("changes", changes)} items={CHANGES} />
        <p className={s.hint}>How a reply shows what it changed in this tracker. A scene can turn change visuals off altogether.</p>
      </div>
      <div className={s.block}>
        <div className={s.label}>Prompt line <span className={s.hint}>(optional, leave blank for the plain line)</span></div>
        <Textarea aria-label="Prompt line" className={s.mono} rows={2} spellCheck={false} value={template} onChange={(e) => setTemplate(e.target.value)} />
        <MacroChips macros={[{ sig: `tracker::${body.name}`, desc: "The tracker's whole plain line" }]} onInsert={(snippet) => setTemplate(template + snippet)}>
          <Select aria-label="Insert a field" value="" onChange={(e) => { if (e.target.value) setTemplate(`${template}{{${fieldMacro(e.target.value)}}}`); }} className={s.pick}>
            <option value="">Insert a field...</option>
            {body.fields.map(/* bounded-ok: native select options, scrolled by the browser rather than drawn as rows */ (f, i) => <option key={i} value={f.name}>{f.name}</option>)}
          </Select>
        </MacroChips>
      </div>
    </div>
  );
}
