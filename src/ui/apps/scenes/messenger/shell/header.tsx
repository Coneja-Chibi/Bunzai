/**
 * The Messenger's conversation header (approved wireframe messenger-discord/shell.html `head()`): the drawer's menu button, `#` and the scene's title, the dim topic line, the page's own
 * controls (the takes pill and the Update available badge), the panel switcher (the pinned panels and All panels, frames/panel-switcher.tsx) and the member list toggle. The Scene Note and
 * Memory icons are the default pins. Under 1024px (`compact`) the header keeps the title, the takes pill and one three-dot menu (Search, Scene Note, Memory, Members); Search opens the
 * page's find panel (use-scene-find.tsx), the same one Ctrl+F opens.
 */
import { useRef, useState, type JSX, type ReactNode, type Ref } from "react";
import { IconButton } from "../../../../components/button";
import { ContextMenu, type MenuEntry } from "../frames/context-menu";
import { PanelSwitcher, type PanelSpec } from "../frames/panel-switcher";

export interface HeaderProps {
  title: string;
  topic: string;
  /** The takes pill and the Update available badge, built by the page. */
  actions: ReactNode;
  panels: PanelSpec[];
  openId: string | null;
  members: boolean;
  /** The scene is under 1024px wide: the switcher and the member toggle fold into one menu. */
  compact?: boolean;
  navOpen: boolean;
  menuRef: Ref<HTMLButtonElement>;
  inert: boolean;
  onMenu(): void;
  onOpen(programId: string): void;
  onClose(): void;
  onTogglePin(id: string): void;
  onMembers(): void;
  /** Opens the page's find panel; without it the narrow menu has no Search item. */
  onFind?(): void;
}

const NOTE_ID = "author-note";
const MEMORY_ID = "memory";

function MoreMenu(p: { panels: PanelSpec[]; members: boolean; onOpen(id: string): void; onMembers(): void; onFind?(): void }): JSX.Element {
  const button = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const has = (id: string): boolean => p.panels.some((x) => x.id === id);
  const items: MenuEntry[] = [
    ...(p.onFind ? [{ id: "search", label: "Search", icon: "lucide:search" as const, hint: "Ctrl+F", onSelect: p.onFind }] : []),
    ...(has(NOTE_ID) ? [{ id: "note", label: "Scene Note", icon: "lucide:sticky-note" as const, onSelect: () => p.onOpen(NOTE_ID) }] : []),
    ...(has(MEMORY_ID) ? [{ id: "memory", label: "Memory", icon: "lucide:history" as const, onSelect: () => p.onOpen(MEMORY_ID) }] : []),
    { id: "members", label: "Members", icon: "lucide:users-round", hint: p.members ? "Shown" : undefined, onSelect: p.onMembers },
  ];
  const close = (): void => { setAt(null); button.current?.focus(); };
  const toggle = (): void => {
    const box = button.current?.getBoundingClientRect();
    setAt(at ? null : { x: (box?.right ?? 0) - 220, y: (box?.bottom ?? 0) + 6 });
  };
  return (
    <>
      <span className="msn-hmore" onPointerDown={(e) => { if (at) e.nativeEvent.stopPropagation(); }}>
        <IconButton ref={button} data-part="scene.messenger.header.more" variant="quiet" label="More" icon="lucide:ellipsis-vertical" aria-haspopup="menu" aria-expanded={at !== null} onClick={toggle} />
      </span>
      {at && <ContextMenu items={items} at={at} label="Scene menu" onClose={close} />}
    </>
  );
}

export function Header(p: HeaderProps): JSX.Element {
  return (
    <header className="msn-head" data-part="scene.messenger.header" inert={p.inert}>
      <span className="msn-mmenu"><IconButton ref={p.menuRef} label="Show recent characters" icon="lucide:menu" aria-expanded={p.navOpen} onClick={p.onMenu} /></span>
      <span className="msn-hash" aria-hidden="true">#</span>
      <strong className="msn-title">{p.title}</strong>
      <small className="msn-topic">{p.topic}</small>
      <div className="msn-actions sh">{p.actions}</div>
      {p.compact === true && <MoreMenu panels={p.panels} members={p.members} onOpen={p.onOpen} onMembers={p.onMembers} onFind={p.onFind} />}
      {p.compact !== true && p.panels.length > 0 && <PanelSwitcher panels={p.panels} openId={p.openId} onOpen={p.onOpen} onClose={p.onClose} onTogglePin={p.onTogglePin} />}
      {p.compact !== true && <IconButton data-part="scene.messenger.header.members" variant="quiet" label="Member list" icon="lucide:users-round" aria-pressed={p.members} onClick={p.onMembers} />}
    </header>
  );
}
