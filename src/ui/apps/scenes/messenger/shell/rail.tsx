/**
 * The Messenger's far-left rail (approved wireframe messenger-discord/shell.html `rail()`): the Home tile (back to the Scenes page, which the header no longer carries), a divider, one tile per
 * recent character (the open character marked), a tile that starts a new scene with the open character, and the compass that opens the Library's character browser, which starts a scene with the pick (Discover). The
 * programs are not here; they open from the header switcher and the sidebar. A tile carries a red count badge for the messages its character's scenes gained since they were last read (shell/read-marks.ts); the Today/Earlier folders have no data yet and are not drawn.
 */
import type { JSX, ReactNode } from "react";
import type { AppContext } from "../../../../app-contract";
import { Tile } from "../../../../components/button";
import type { SceneSummary } from "../../../../../studio/scenes";
import { SceneAvatar } from "../messenger-parts";
import { unreadLabel } from "./read-marks";

export interface RailProps {
  ctx: AppContext;
  /** The open character: kept in the rail even when the recents have not loaded or do not list it. */
  current: { characterId: string; name: string; avatar: ReactNode };
  rows: readonly SceneSummary[];
  /** Unread messages per character id; absent means none. */
  unread: Readonly<Record<string, number>>;
  canStart: boolean;
  onHome(): void;
  onPick(scene: SceneSummary): void;
  onChat(): void;
  onNew(): void;
  onBrowse(): void;
}

export function Rail(p: RailProps): JSX.Element {
  const missing = !p.rows.some((s) => s.cast.character.id === p.current.characterId);
  return (
    <nav className="msn-rail" aria-label="Characters" data-part="scene.messenger.rail">
      <Tile kind="icon" data-part="scene.messenger.rail.home" label="Home: your scenes" icon="lucide:message-circle" onClick={p.onHome} />
      <span className="msn-rail-sep" aria-hidden="true" />
      <div className="msn-tabs">
        {missing && <Tile kind="thumb" data-part="scene.messenger.rail.current" label={`Current chat with ${p.current.name}`} aria-current="page" selected art={p.current.avatar} onClick={p.onChat} />}
        {p.rows.map((s) => {
          const active = s.cast.character.id === p.current.characterId;
          const n = active ? 0 : p.unread[s.cast.character.id] ?? 0;
          const label = s.title && s.title !== s.characterName ? `${s.characterName}: ${s.title}` : s.characterName;
          return <Tile key={s.cast.character.id} kind="thumb" data-part={`scene.messenger.rail.character.${s.cast.character.id}`} label={n > 0 ? `${label} (${n} unread)` : label}
            data-unread={n > 0 || undefined} badge={n > 0 ? unreadLabel(n) : undefined} selected={active} aria-current={active ? "page" : undefined} art={<SceneAvatar ctx={p.ctx} scene={s} />} onClick={() => p.onPick(s)} />;
        })}
        {p.canStart && <Tile kind="add" data-part="scene.messenger.rail.new" label="Start a new scene" onClick={p.onNew} />}
        <Tile kind="icon" data-part="scene.messenger.rail.browse" label="Discover characters" icon="lucide:compass" onClick={p.onBrowse} />
      </div>
    </nav>
  );
}
