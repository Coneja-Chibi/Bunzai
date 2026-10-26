/**
 * The Messenger's channel sidebar (approved wireframe messenger-discord/shell.html `side()`): the character header with its menu (Character settings, Leave), the Scenes category with this
 * character's scenes (the open one marked, with its takes as thread rows and a Scene settings gear) and "New scene", the Active features category (live Prop panels and Regex) with a "+" to the
 * Props program, and the user panel (persona, AI connection, switch persona, Your settings). Loading, failure and the empty copy of the recents are RoleCall's. A scene with unread messages is bold with a count pip (shell/read-marks.ts).
 * The character menu carries Notification settings (this character's choice and the desktop notice) and Hide muted scenes; a scene row has a More button and a right-click menu (use-scene-manage.tsx), and a muted
 * scene wears a ban mark (unread still counts). Swap persona opens the Casting Call above the user panel. Invite participants needs data Bunraku does not have and is not drawn.
 */
import { useState, type JSX, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Button, IconButton, ListRow } from "../../../../components/button";
import { Ic, type IconName } from "../../../../_shared/ic";
import type { SceneSummary, TakeSummary } from "../../../../../studio/scenes";
import { Avatar } from "../messenger-parts";
import { ContextMenu, type MenuEntry } from "../frames/context-menu";
import type { Point } from "../frames/popout";
import { unreadLabel } from "./read-marks";
import type { NotifyChange, NotifyView } from "./use-notify-prefs";
import type { ManagedRow } from "./use-scene-manage";
import { RECENTS_ERROR, type Recents } from "../use-recent-characters";

export interface SidebarFeature { id: string; title: string; icon: IconName }

export interface SidebarProps {
  character: { id: string; name: string };
  recents: Recents;
  /** This character's scenes, newest first. */
  scenes: readonly SceneSummary[];
  /** Unread messages per scene id; absent means none. */
  unread: Readonly<Record<string, number>>;
  /** The open scene: kept in the list while the scenes load or when the list does not carry it yet. */
  open: { id: string; title: string; takes: readonly TakeSummary[]; activeTakeId: string } | null;
  features: readonly SidebarFeature[];
  canAddFeature: boolean;
  persona: { name: string; canOpen: boolean };
  ai: { connected: boolean; canOpen: boolean };
  canSwitchPersona: boolean;
  /** The Casting Call when it is open (shown above the user panel), else null. */
  swap: ReactNode;
  notify: NotifyView;
  /** Scene ids the person muted. */
  muted: readonly string[];
  /** The menu of one scene row (Rename, Move to folder, Mute, Move to Trash). */
  sceneMenu(row: ManagedRow): MenuEntry[];
  canSettings: boolean;
  /** No character has a scene yet, so the recents say so. */
  noRecents: boolean;
  onClose(): void;
  onRetry(): void;
  onPickScene(scene: SceneSummary): void;
  onNewScene(): void;
  onTake(takeId: string): void;
  onFeature(programId: string): void;
  onAddFeature(): void;
  onCharacterSettings(): void;
  onLeave(): void;
  onSceneSettings(): void;
  onPersona(): void;
  onAi(): void;
  onSwitchPersona(): void;
  onNotify(change: NotifyChange): void;
  onUserSettings(): void;
}

const sceneTitle = (title: string): string => title.trim() || "Untitled scene";
const takeLabel = (t: TakeSummary): string => (t.parentBranchId === null ? "Director's Cut" : t.name);

export function Sidebar(p: SidebarProps): JSX.Element {
  const [menuAt, setMenuAt] = useState<Point | null>(null);
  const [rowMenu, setRowMenu] = useState<{ row: ManagedRow; at: Point } | null>(null);
  const n = p.notify;
  const items: MenuEntry[] = [
    { id: "character-settings", label: "Character settings", icon: "lucide:settings", onSelect: p.onCharacterSettings },
    { id: "notify", label: "Notification settings", icon: "mdi:bell-outline", submenu: [
      { id: "notify-all", label: "All replies", hint: n.character === "all" ? "Selected" : undefined, onSelect: () => p.onNotify({ kind: "character", value: "all" }) },
      { id: "notify-muted", label: `Mute ${p.character.name}`, hint: n.character === "muted" ? "Selected" : undefined, onSelect: () => p.onNotify({ kind: "character", value: "muted" }) },
      ...(n.canDesktop ? [{ id: "notify-sep", separator: true as const }, { id: "notify-desktop", label: "Desktop notice", hint: n.desktop ? "On" : "Off", onSelect: () => p.onNotify({ kind: "desktop", on: !n.desktop }) }] : []),
    ] },
    { id: "hide-muted", label: "Hide muted scenes", icon: "lucide:eye-off", hint: n.hideMuted ? "On" : "Off", onSelect: () => p.onNotify({ kind: "hideMuted", on: !n.hideMuted }) },
    { id: "leave-sep", separator: true },
    { id: "leave", label: "Leave", icon: "lucide:x", danger: true, onSelect: p.onLeave },
  ];
  const openMenu = (e: ReactMouseEvent<HTMLElement>): void => {
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    setMenuAt(e.type === "contextmenu" ? { x: e.clientX, y: e.clientY } : { x: box.left + 8, y: box.bottom });
  };
  const openRowMenu = (row: ManagedRow, e: ReactMouseEvent<HTMLElement>): void => {
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    setRowMenu({ row, at: e.type === "contextmenu" ? { x: e.clientX, y: e.clientY } : { x: box.left, y: box.bottom } });
  };
  const inList = p.open !== null && p.scenes.some((s) => s.id === p.open!.id);
  const rows: { id: string; title: string; scene: SceneSummary | null }[] = [
    ...(p.open && !inList ? [{ id: p.open.id, title: p.open.title, scene: null }] : []),
    ...p.scenes.map((s) => ({ id: s.id, title: s.title, scene: s })),
  ];
  return (
    <aside className="msn-side" aria-label="Scenes" data-part="scene.messenger.sidebar">
      <div className="msn-side-h">
        <Button variant="quiet" menu block data-part="scene.messenger.sidebar.character" aria-label={`${p.character.name}: character menu`} aria-expanded={menuAt !== null} onClick={openMenu} onContextMenu={openMenu}>{p.character.name}</Button>
        <span className="msn-mclose"><IconButton label="Close character sidebar" icon="lucide:chevron-left" onClick={p.onClose} /></span>
      </div>
      {menuAt && <ContextMenu items={items} at={menuAt} label="Character menu" onClose={() => setMenuAt(null)} />}
      {rowMenu && <ContextMenu items={p.sceneMenu(rowMenu.row)} at={rowMenu.at} label="Scene menu" onClose={() => setRowMenu(null)} />}
      <div className="msn-dms">
        <div className="msn-cat"><h2>Scenes</h2>{p.canSettings && <IconButton variant="quiet" size="sm" data-part="scene.messenger.sidebar.new-scene" label={`New scene with ${p.character.name}`} icon="lucide:plus" onClick={p.onNewScene} />}</div>
        {p.recents.state === "loading" && <p role="status" className="msn-empty">Loading recent chats…</p>}
        {p.recents.state === "failed" && <div role="status" className="msn-empty"><p>{RECENTS_ERROR}</p><Button variant="quiet" size="sm" onClick={p.onRetry}>Try again</Button></div>}
        {rows.map((r) => {
          const current = p.open?.id === r.id;
          const unread = current ? 0 : p.unread[r.id] ?? 0;
          const muted = p.muted.includes(r.id);
          const row: ManagedRow = { id: r.id, title: r.title, scene: r.scene };
          return (
            <div key={r.id} className="msn-scn" data-part={`scene.messenger.sidebar.scene.${r.id}`} onContextMenu={(e) => openRowMenu(row, e)}>
              <ListRow selected={current} aria-current={current ? "page" : undefined} data-unread={unread > 0 || undefined} leading={<Ic name="lucide:hash" size={16} />} label={sceneTitle(r.title)}
                meta={unread > 0 ? <span className="msn-pip" data-part={`scene.messenger.sidebar.unread.${r.id}`} aria-label={`${unread} unread`}>{unreadLabel(unread)}</span> : muted ? <span data-part={`scene.messenger.sidebar.muted.${r.id}`} role="img" aria-label="Muted"><Ic name="lucide:ban" size={12} /></span> : undefined} onClick={() => (r.scene ? p.onPickScene(r.scene) : undefined)} />
              <span className="msn-more"><IconButton variant="quiet" size="sm" data-part={`scene.messenger.sidebar.more.${r.id}`} label={`More for ${sceneTitle(r.title)}`} icon="lucide:ellipsis" aria-haspopup="menu" onClick={(e) => openRowMenu(row, e)} /></span>
              {current && p.canSettings && <IconButton variant="quiet" size="sm" data-part="scene.messenger.sidebar.scene-settings" label="Scene settings" icon="lucide:settings" onClick={p.onSceneSettings} />}
              {current && p.open!.takes.length > 1 && (
                <div className="msn-threads" role="group" aria-label="Takes">
                  {p.open!.takes.map((t) => <ListRow key={t.id} depth={1} selected={t.id === p.open!.activeTakeId} aria-current={t.id === p.open!.activeTakeId ? "true" : undefined}
                    leading={<Ic name="lucide:git-branch" size={14} />} label={takeLabel(t)} onClick={() => p.onTake(t.id)} />)}
                </div>
              )}
            </div>
          );
        })}
        {p.recents.state === "ready" && p.noRecents && <p className="msn-empty">Your recent character chats will appear here.</p>}
        {p.features.length > 0 && (
          <nav aria-label="Active features">
            <div className="msn-cat"><h2>Active features</h2>{p.canAddFeature && <IconButton variant="quiet" size="sm" data-part="scene.messenger.sidebar.add-feature" label="Add or remove features" icon="lucide:plus" onClick={p.onAddFeature} />}</div>
            {p.features.map((f) => <ListRow key={f.id} data-part={`scene.messenger.sidebar.feature.${f.id}`} leading={<Ic name={f.icon} size={16} />} label={f.title} onClick={() => p.onFeature(f.id)} />)}
          </nav>
        )}
      </div>
      <footer className="msn-ubar" data-part="scene.messenger.user">
        {p.swap && <div className="msn-swap" data-part="scene.messenger.user.swap">{p.swap}</div>}
        <div className="msn-profile"><ListRow aria-label="Profile settings" disabled={!p.persona.canOpen} onClick={p.onPersona} leading={<Avatar name={p.persona.name} />} label={p.persona.name} subtitle="Persona" /></div>
        <IconButton variant="quiet" size="sm" data-part="scene.messenger.user.ai" label={p.ai.connected ? "AI connection: connected" : "AI connection: not connected"} icon="lucide:plug" disabled={!p.ai.canOpen} onClick={p.onAi} />
        <IconButton variant="quiet" size="sm" data-part="scene.messenger.user.persona" label="Switch persona" icon="lucide:user-round" disabled={!p.canSwitchPersona} onClick={p.onSwitchPersona} />
        <IconButton variant="quiet" size="sm" data-part="scene.messenger.user.settings" label="Your settings" icon="lucide:settings" disabled={!p.canSettings} onClick={p.onUserSettings} />
      </footer>
    </aside>
  );
}
