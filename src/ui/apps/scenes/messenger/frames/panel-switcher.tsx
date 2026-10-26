/**
 * The Messenger header's panel switcher (panels.html section 1): one icon button for each pinned panel, the open one pressed, and an "All panels" menu listing every panel under its wing
 * with a find box, a Side/Wide/Layer tag on each row and a star that pins or unpins it. Clicking the open panel's button closes it, clicking another swaps. Presentational: which panel is
 * open and what a pin means belong to the shell; the star appears only when the shell hands over `onTogglePin`.
 */
import { useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from "react";
import { Ic, type IconName } from "../../../../_shared/ic";
import { IconButton, MenuItem } from "../../../../components/button";
import { isEscapeClose } from "../../../../_shared/use-escape-key";

export interface PanelSpec {
  id: string;
  label: string;
  icon: IconName;
  pinned?: boolean;
  /** shown in the All panels menu, e.g. Side, Wide or Layer */
  kind?: string;
  /** the wing it is listed under in the All panels menu; panels without one share an unheaded group */
  group?: string;
}

export interface PanelSwitcherProps {
  panels: PanelSpec[];
  openId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  /** pins or unpins a panel; without it the All panels menu draws no stars */
  onTogglePin?: (id: string) => void;
}

const FIND_SELECTOR = '[data-part="scene.messenger.panel.find"]';
const matches = (p: PanelSpec, q: string): boolean => q === "" || [p.label, p.group, p.kind].some((s) => s?.toLowerCase().includes(q));

/** The panels that match the query, grouped by wing in order of first appearance. */
export function groupPanels(panels: readonly PanelSpec[], query: string): { group: string; panels: PanelSpec[] }[] {
  const q = query.trim().toLowerCase();
  const out: { group: string; panels: PanelSpec[] }[] = [];
  for (const p of panels) {
    if (!matches(p, q)) continue;
    const name = p.group ?? "";
    const hit = out.find((g) => g.group === name);
    if (hit) hit.panels.push(p);
    else out.push({ group: name, panels: [p] });
  }
  return out;
}

interface AllPanelsProps { panels: PanelSpec[]; openId: string | null; onOpen(id: string): void; onTogglePin?(id: string): void; onDone(): void; onEscape(): void }

function AllPanels({ panels, openId, onOpen, onTogglePin, onDone, onEscape }: AllPanelsProps): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupPanels(panels, query), [panels, query]);
  useEffect(() => { wrap.current?.querySelector<HTMLElement>(FIND_SELECTOR)?.focus(); }, []);

  const rows = (): HTMLElement[] => [...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const find = (): HTMLElement | null => wrap.current?.querySelector<HTMLElement>(FIND_SELECTOR) ?? null;
  const onKeyDown = (e: KeyboardEvent<HTMLElement>): void => {
    const target = e.target as HTMLElement;
    if (isEscapeClose(e.nativeEvent)) { e.preventDefault(); e.stopPropagation(); onEscape(); return; }
    const isFind = target.dataset.part === "scene.messenger.panel.find";
    const isStar = target.dataset.part === "scene.messenger.panel.star";
    const list = rows();
    const at = list.indexOf(isStar ? (target.previousElementSibling as HTMLElement) : target);
    const go = (el: HTMLElement | null | undefined): void => { e.preventDefault(); el?.focus(); };
    switch (e.key) {
      case "ArrowDown": return go(isFind ? list[0] : list[Math.min(at + 1, list.length - 1)]);
      case "ArrowUp": return go(at <= 0 ? find() : list[at - 1]);
      case "Home": if (!isFind) go(list[0]); return;
      case "End": if (!isFind) go(list[list.length - 1]); return;
      case "ArrowRight": if (!isFind && !isStar) { const star = target.nextElementSibling; if (star instanceof HTMLElement) go(star); } return;
      case "ArrowLeft": if (isStar) go(target.previousElementSibling as HTMLElement); return;
      case "Enter": case " ": if (!isFind) { e.preventDefault(); target.click(); } return;
    }
  };

  return (
    <div ref={wrap} className="msn-sw-menu" data-part="scene.messenger.panel.all-menu" onKeyDown={onKeyDown}>
      <label className="msn-sw-search">
        <Ic name="lucide:search" size={14} />
        <input data-part="scene.messenger.panel.find" type="search" value={query} placeholder="Find a panel" aria-label="Find a panel" onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="msn-menu msn-sw-list" role="menu" aria-label="All panels" data-part="scene.messenger.menu.list">
        {/* bounded-ok: one row per program of the open scene, a few dozen at most */}
        {groups.map((g) => (
          <div key={g.group} role="group" aria-label={g.group || undefined}>
            {g.group && <div className="msn-sw-grp" role="presentation" data-part="scene.messenger.panel.group">{g.group}</div>}
            {/* bounded-ok: the programs of one wing */}
            {g.panels.map((p) => (
              <div key={p.id} className="msn-sw-row" role="none" data-open={openId === p.id ? "true" : undefined}>
                <MenuItem data-part={`scene.messenger.menu.item.${p.id}`} tabIndex={-1} icon={p.icon} hint={p.kind} onClick={() => { onOpen(p.id); onDone(); }}>{p.label}</MenuItem>
                {onTogglePin && (
                  <IconButton data-part="scene.messenger.panel.star" variant="quiet" size="sm" tabIndex={-1} role="menuitemcheckbox" aria-checked={p.pinned === true}
                    label={`${p.pinned ? "Unpin" : "Pin"} ${p.label}`} icon="lucide:star" onClick={() => onTogglePin(p.id)} />
                )}
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className="msn-sw-none" data-part="scene.messenger.panel.none">No panel matches "{query.trim()}".</p>}
      </div>
    </div>
  );
}

export function PanelSwitcher({ panels, openId, onOpen, onClose, onTogglePin }: PanelSwitcherProps): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent): void => { if (!root.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [menu]);

  const closeMenu = (): void => {
    setMenu(false);
    root.current?.querySelector<HTMLElement>('[data-part="scene.messenger.panel.all"]')?.focus();
  };

  return (
    <div ref={root} className="msn-sw" role="toolbar" aria-label="Panels" data-part="scene.messenger.panel.switcher">
      <div className="msn-sw-pins">
        {panels.filter((p) => p.pinned).map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (p) => (
          <IconButton key={p.id} data-part={`scene.messenger.panel.pin.${p.id}`} variant="quiet" icon={p.icon} label={p.label} aria-pressed={openId === p.id} onClick={() => (openId === p.id ? onClose() : onOpen(p.id))} />
        ))}
      </div>
      <span className="msn-sw-sep" aria-hidden="true" />
      <IconButton data-part="scene.messenger.panel.all" variant="quiet" icon="lucide:layout-grid" label="All panels" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} />
      {menu && <AllPanels panels={panels} openId={openId} onOpen={onOpen} onTogglePin={onTogglePin} onDone={() => setMenu(false)} onEscape={closeMenu} />}
    </div>
  );
}
