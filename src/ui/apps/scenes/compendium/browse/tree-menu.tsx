/**
 * The TV Tree's right-click menu (RoleCall `NodeConstraintMenu.tsx`) and the entry picker behind "Move to..." (`EntryPickerModal.tsx`).
 * The menu is a card over the Catalogue with a toggle each for Lock, Forbid and Reorganize (an entry also gets Move to...), RoleCall's
 * words for each, and closes on a click outside or Escape. The picker is a searchable list of every other entry. Both only report the
 * choice; the saved lists and the layout are written by the callers. Colours are theme tokens (style in compendium-style-tree.ts).
 */
import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { useEscapeKey } from "../../../../_shared/use-escape-key";
import type { CompendiumEntry, Flags } from "../../../../../core/compendium";
import { ENTRY_TYPE_INFO } from "../../../../../core/compendium";
import { Ic, type IconName } from "../../../../_shared/ic";
import { Button, ListRow, MenuItem } from "../../../../components/button";
import { InkDialog } from "../../../../components/ink-dialog";

export interface MenuTarget {
  id: string;
  label: string;
  mode: "node" | "entry";
  /** Where the click landed, relative to the Catalogue. */
  x: number;
  y: number;
}

const MENU_W = 220;
const ITEMS: readonly { kind: "locked" | "forbidden" | "reorganize"; icon: IconName; node: [string, string]; entry: [string, string] }[] = [
  { kind: "locked", icon: "lucide:lock", node: ["Lock branch", "AI can never modify this branch on rebuild."], entry: ["Lock entry", "AI can never move this entry on rebuild."] },
  { kind: "forbidden", icon: "lucide:ban", node: ["Forbid branch", "AI must never create this branch. Existing entries get redistributed."], entry: ["Forbid entry", "AI never places this entry. It stays under Unsorted."] },
  { kind: "reorganize", icon: "lucide:rotate-ccw", node: ["Reorganize on next rebuild", "One-shot. Redistribute entries inside this node, then auto-clear."], entry: ["Reorganize on next rebuild", "One-shot. The AI may put this entry somewhere better, then the flag clears."] },
];

export function TreeMenu({ target, flags, bounds, onToggle, onMove, onClose }: {
  target: MenuTarget; flags: Flags; bounds: { width: number; height: number };
  onToggle(kind: "locked" | "forbidden" | "reorganize", on: boolean): void; onMove?(): void; onClose(): void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent): void => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [onClose]);
  useEscapeKey(onClose);
  const rows = ITEMS.length + (target.mode === "entry" && onMove ? 1 : 0);
  const left = Math.max(4, Math.min(target.x, bounds.width - MENU_W - 8));
  const top = Math.max(4, Math.min(target.y, bounds.height - (96 + rows * 52) - 8));
  return (
    <div ref={ref} className="cp-tmenu" role="menu" aria-label={target.mode === "entry" ? "Entry Constraints" : "Tree Constraints"} style={{ left, top }} data-part="compendium.tree-menu">
      <div className="hd"><small>{target.mode === "entry" ? "Entry Constraints" : "Tree Constraints"}</small><b title={target.label}>{target.label}</b></div>
      {ITEMS.map((item) => {
        const on = flags[item.kind];
        const [label, hint] = item[target.mode];
        return (
          <MenuItem key={item.kind} role="menuitemcheckbox" checked={on} description={hint} onClick={() => { onToggle(item.kind, !on); onClose(); }}>
            <b><Ic name={item.icon} size={14} />{label}</b>
          </MenuItem>
        );
      })}
      {target.mode === "entry" && onMove && (
        <MenuItem icon="lucide:folder-input" description="Pin this entry under another entry of your choice. Removes it from its default home (no dual placement)." onClick={() => { onMove(); onClose(); }}>
          <b>Move to...</b>
        </MenuItem>
      )}
      <div className="ft"><Button variant="quiet" size="sm" icon="lucide:x" onClick={onClose}>Close</Button></div>
    </div>
  );
}

const SHOWN = 200;

export function EntryPicker({ title, entries, exclude, onPick, onCancel }: { title: string; entries: readonly CompendiumEntry[]; exclude: string; onPick(entry: CompendiumEntry): void; onCancel(): void }): JSX.Element {
  const [query, setQuery] = useState("");
  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => e.id !== exclude && !e.retired && e.enabled && (!q || e.name.toLowerCase().includes(q) || e.title.toLowerCase().includes(q)));
  }, [entries, exclude, query]);
  return (
    <InkDialog ariaLabel={title} onDismiss={onCancel} sheetClassName="cp-pick">
      <header>
        <h3>{title}</h3>
        <p>Pick the entry this should be pinned under. The selected entry will become its parent in the tree.</p>
      </header>
      <label className="se"><Ic name="lucide:search" size={12} /><input type="search" autoFocus value={query} placeholder="Search by name..." aria-label="Search by name" onChange={(e) => setQuery(e.target.value)} /></label>
      <small className="ct">{pool.length} {pool.length === 1 ? "entry" : "entries"}</small>
      <div className="list">
        {pool.slice(0, SHOWN).map(/* bounded-ok: sliced to SHOWN above */ (e) => (
          <ListRow key={e.id} onClick={() => onPick(e)} leading={<i style={e.type ? { background: `var(${ENTRY_TYPE_INFO[e.type].token})` } : undefined} />} label={e.name} meta={e.type ? ENTRY_TYPE_INFO[e.type].label : "Classic"} />
        ))}
        {pool.length === 0 && <p className="none">No entries match.</p>}
        {pool.length > SHOWN && <p className="none">Showing the first {SHOWN}. Search to narrow the list.</p>}
      </div>
      <footer><Button variant="quiet" onClick={onCancel}>Cancel</Button></footer>
    </InkDialog>
  );
}
