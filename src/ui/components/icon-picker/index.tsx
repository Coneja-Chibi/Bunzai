/**
 * IconPicker - choose a glyph for a piece or a field from the app's own table (generated/ic-glyphs.json, drawn by Ic): a short row of
 * favourites, None, and "More..." which opens a searchable list of every glyph the build ships. It hands back a glyph id
 * (`lucide:heart`), or undefined for none. An id the build does not ship is shown as no choice rather than as a broken picture.
 */
import { useMemo, useRef, useState, type JSX } from "react";
import glyphs from "../../../generated/ic-glyphs.json";
import { Ic, knownIcon, type IconName } from "../../_shared/ic";
import { VirtualRows } from "../../_shared/virtual-list";
import { Button, Chip, ListRow } from "../button";
import { Input } from "../rc-controls";
import s from "./index.module.css";

/** The favourites shown without opening the list. */
export const QUICK_ICONS: readonly IconName[] = ["lucide:heart", "lucide:sword", "lucide:star", "lucide:shield", "lucide:flag"];

const ALL = Object.keys(glyphs) as IconName[];
const ROW_ESTIMATE = 36;

export function IconPicker({ value, onChange, label = "Icon" }: { value: string | undefined; onChange(next: string | undefined): void; label?: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => ALL.filter((id) => id.includes(query.trim().toLowerCase())), [query]);
  const chosen = knownIcon(value) ? value : undefined;
  const shortRow = chosen && !QUICK_ICONS.includes(chosen) ? [...QUICK_ICONS, chosen] : QUICK_ICONS;
  const pick = (id: IconName | undefined): void => { onChange(id); setOpen(false); };
  return (
    <div className={s.root} role="group" aria-label={label} data-part="icon-picker.root">
      <div className={s.row}>
        {shortRow.map(/* bounded-ok: the favourites plus the one chosen glyph */ (id) => (
          <Chip key={id} pressed={chosen === id} title={id} aria-label={id.slice(id.indexOf(":") + 1)} onClick={() => pick(id)}><Ic name={id} size={16} /></Chip>
        ))}
        <Button size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>More...</Button>
        <Chip pressed={value === undefined} onClick={() => pick(undefined)}>None</Chip>
      </div>
      {open && (
        <div className={s.list}>
          <Input type="search" aria-label="Search icons" placeholder="Search icons" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div ref={scroller} className={s.scroll}>
            <VirtualRows scroll={scroller} items={shown} keyOf={(id) => id} estimate={ROW_ESTIMATE}
              render={(id) => <ListRow label={id} leading={<Ic name={id} size={16} />} selected={chosen === id} aria-pressed={chosen === id} onClick={() => pick(id)} />} />
          </div>
        </div>
      )}
    </div>
  );
}
