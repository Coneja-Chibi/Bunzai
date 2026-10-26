/**
 * The Browse tab's left pane, "The Catalogue" (RoleCall `sidebar/BrowseSidebar.tsx:150-228`, `ByTypeView`, `TreeFirstView`
 * compact, `SummariesView`): the header, the codex search, the By Type / TV Tree / Summaries strip and one virtual list that
 * draws whichever is chosen, so a 213-entry book mounts a screenful of rows. The search is one query for all three. A row has no
 * "..." menu yet (its write items arrive with A5). With a `tree` the rows answer a right-click with RoleCall's constraint menu (a
 * branch or an entry; an entry also Move to...), show their flags, and in the TV Tree an entry can be dragged onto a branch.
 */
import { useCallback, useMemo, useRef, useState, type CSSProperties, type JSX, type MouseEvent } from "react";
import type { CompendiumEntry, ConstraintKind, Flags, TreeNode } from "../../../../../core/compendium";
import { Ic } from "../../../../_shared/ic";
import { Disclosure, ListRow, Tabs } from "../../../../components/button";
import { FALLBACK_VIEWPORT, OVERSCAN, useVirtualRows } from "../../../../_shared/virtual-list";
import { GLYPH, typeRole, type BookModel } from "../compendium-core";
import { byTypeRows, summaryRows, treeRows, type Row } from "./browse-rows";
import { EntryPicker, TreeMenu, type MenuTarget } from "./tree-menu";

/** What the Catalogue needs to let the person shape the tree: the flags to show, and the four things they can do. */
export interface TreeUi {
  flagsOf(id: string): Flags;
  toggle(kind: ConstraintKind, id: string, label: string, on: boolean): void;
  pin(entryId: string, entryLabel: string, targetId: string, targetLabel: string): void;
  drop(entryId: string, nodeId: string, nodeLabel: string): void;
}

interface Hooks { ui: TreeUi; sub: SubTab; onMenu(e: MouseEvent, target: Omit<MenuTarget, "x" | "y">): void }

const Flagged = ({ flags }: { flags: Flags }): JSX.Element | null =>
  flags.locked || flags.forbidden || flags.reorganize || flags.pinned ? (
    <span className="cp-flags">
      {flags.locked && <Ic name="lucide:lock" size={12} />}{flags.forbidden && <span title="Forbidden"><Ic name="lucide:ban" size={12} /></span>}{flags.reorganize && <span title="Reorganize pending"><Ic name="lucide:rotate-ccw" size={12} /></span>}{flags.pinned && <span title="Pinned"><Ic name="lucide:pin" size={12} /></span>}
    </span>
  ) : null;

export type SubTab = "by-type" | "tv-tree" | "summaries";
const SUBS: readonly { id: SubTab; label: string }[] = [{ id: "by-type", label: "By Type" }, { id: "tv-tree", label: "TV Tree" }, { id: "summaries", label: "Summaries" }];
const HEIGHT = { head: 36, entry: 40, node: 40 } as const;
const EMPTY: Record<SubTab, [string, string]> = { "by-type": ["No typed entries yet.", "No entries match."], "tv-tree": ["No tree built yet.", "No entries match."], summaries: ["No recaps yet.", "No recaps match."] };

function RowView({ row, selectedId, onOpen, onToggle, tree }: { row: Row; selectedId: string | null; onOpen(id: string): void; onToggle(node: TreeNode): void; tree?: Hooks }): JSX.Element {
  if (row.kind === "head") return <div className="cp-sh" style={{ "--tc": typeRole(row.type) } as CSSProperties}><span>{row.label}</span><em>{row.count}</em></div>;
  if (row.kind === "node") {
    const has = row.node.children.length > 0 || row.node.entryIds.length > 0;
    const n = row.node;
    const real = tree && tree.sub === "tv-tree";
    const handlers = real ? { onContextMenu: (e: MouseEvent) => tree.onMenu(e, { id: n.id, label: n.label, mode: "node" }), onDragOver: (e: React.DragEvent) => e.preventDefault(), onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) tree.ui.drop(id, n.id, n.label); } } : {};
    const flags = real ? <Flagged flags={tree.ui.flagsOf(n.id)} /> : undefined;
    // A branch with nothing under it has nothing to open, so it is a plain tree row and carries no aria-expanded.
    return has
      ? <Disclosure data-node-id={n.id} depth={row.depth} open={row.open} label={n.label} summary={n.entryCount} trailing={flags} onClick={() => onToggle(n)} {...handlers} />
      : <ListRow variant="tree" data-node-id={n.id} depth={row.depth} leading={GLYPH.dot} label={n.label} meta={n.entryCount} trailing={flags} onClick={() => onToggle(n)} {...handlers} />;
  }
  const e = row.entry;
  return (
    <ListRow variant="tree" data-entry-id={e.id} data-off={e.enabled ? undefined : ""} depth={row.depth} selected={e.id === selectedId} onClick={() => onOpen(e.id)}
      leading={row.ordinal !== undefined ? <i>{String(row.ordinal).padStart(2, "0")}</i> : undefined} label={e.name} trailing={tree ? <Flagged flags={tree.ui.flagsOf(e.id)} /> : undefined}
      {...(tree ? { onContextMenu: (ev: MouseEvent) => tree.onMenu(ev, { id: e.id, label: e.name, mode: "entry" }), ...(tree.sub === "tv-tree" ? { draggable: true, onDragStart: (ev: React.DragEvent) => ev.dataTransfer.setData("text/plain", e.id) } : {}) } : {})} />
  );
}

export function Catalogue({ model, sub, onSub, query, onQuery, selectedId, onOpen, tree }: {
  model: BookModel; sub: SubTab; onSub(s: SubTab): void; query: string; onQuery(q: string): void; selectedId: string | null; onOpen(id: string): void; tree?: TreeUi;
}): JSX.Element {
  const cat = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [moving, setMoving] = useState<{ id: string; label: string } | null>(null);
  const hooks: Hooks | undefined = tree && { ui: tree, sub, onMenu: (e, target) => { e.preventDefault(); const r = cat.current!.getBoundingClientRect(); setMenu({ ...target, x: e.clientX - r.left, y: e.clientY - r.top }); } };
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const rows = useMemo(() => (sub === "by-type" ? byTypeRows(model.entries, query) : sub === "summaries" ? summaryRows(model.entries, query) : treeRows(model.tree.root, model.byId, opened, query)), [model, sub, query, opened]);
  const scroll = useRef<HTMLDivElement>(null);
  const virtual = useVirtualRows({ mode: "list", count: rows.length, getScrollElement: () => scroll.current, getItemKey: (i) => rows[i]!.key, estimateSize: (i) => HEIGHT[rows[i]!.kind], overscan: OVERSCAN, initialRect: FALLBACK_VIEWPORT });
  const toggle = useCallback((node: TreeNode) => setOpened((s) => { const n = new Set(s); if (n.has(node.id)) n.delete(node.id); else n.add(node.id); return n; }), []);
  return (
    <div className="cp-cat" ref={cat} data-part="compendium.catalogue">
      <div className="hd">The Catalogue</div>
      <label className="se"><Ic name="lucide:search" size={12} /><input type="search" value={query} placeholder="Search the codex..." aria-label="Search the codex" onChange={(e) => onQuery(e.target.value)} /></label>
      <Tabs label="Catalogue views" value={sub} onChange={onSub} items={SUBS.map((s) => ({ value: s.id, label: s.label }))} />
      {sub === "tv-tree" && <div className="st">{model.tree.stats.nodeCount} nodes {GLYPH.dot} depth {model.tree.stats.maxDepth}</div>}
      <div className="cp-vs" ref={scroll}>
        <div className="in" style={{ height: virtual.getTotalSize() }}>
          {virtual.getVirtualItems().map((v) => {
            const row = rows[v.index];
            return row ? <div key={row.key} data-index={v.index} className="vr" style={{ transform: `translateY(${String(v.start)}px)`, height: HEIGHT[row.kind] }}><RowView row={row} selectedId={selectedId} onOpen={onOpen} onToggle={toggle} {...(hooks ? { tree: hooks } : {})} /></div> : null;
          })}
        </div>
        {rows.length === 0 && <div className="cp-none2">{EMPTY[sub][query.trim() ? 1 : 0]}</div>}
      </div>
      {menu && tree && cat.current && (
        <TreeMenu target={menu} flags={tree.flagsOf(menu.id)} bounds={cat.current.getBoundingClientRect()} onClose={() => setMenu(null)}
          onToggle={(kind, on) => tree.toggle(kind, menu.id, menu.label, on)} {...(menu.mode === "entry" ? { onMove: () => setMoving({ id: menu.id, label: menu.label }) } : {})} />
      )}
      {moving && tree && (
        <EntryPicker title={`Move "${moving.label}" to...`} entries={model.entries as readonly CompendiumEntry[]} exclude={moving.id} onCancel={() => setMoving(null)}
          onPick={(target) => { tree.pin(moving.id, moving.label, target.id, target.name); setMoving(null); }} />
      )}
    </div>
  );
}
