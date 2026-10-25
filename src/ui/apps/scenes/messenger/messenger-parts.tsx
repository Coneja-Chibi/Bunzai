/**
 * The Messenger's left side (RoleCall DiscordChrome.tsx:43-46,313-336): the avatar, the feature rail (the Chat button, a divider, one button per program) and the sidebar (heading,
 * Browse Characters, RECENT CHARACTERS with RoleCall's loading, failure and empty copy, the active-feature pills, and the user bar with the persona and the gear).
 */
import type { JSX, ReactNode } from "react";
import type { AppContext } from "../../../app-contract";
import { Ic } from "../../../_shared/ic";
import { SceneArt } from "../scene-art";
import type { SceneSummary } from "../../../../studio/scenes";
import type { Program } from "./programs";
import { RECENTS_ERROR, type Recents } from "./use-recent-characters";

export const initials = (name: string): string => name.trim().slice(0, 2).toUpperCase() || "B";

/** A round avatar: the art when there is some, else the first two letters. */
export function Avatar({ name, art }: { name: string; art?: ReactNode }): JSX.Element {
  return <span className="msn-av" aria-hidden="true">{art ?? initials(name)}</span>;
}

export function SceneAvatar({ ctx, scene }: { ctx: AppContext; scene: Pick<SceneSummary, "id" | "snapshotVersion" | "hasPortrait" | "cast"> & { characterName: string } }): JSX.Element {
  return <Avatar name={scene.characterName} {...(scene.hasPortrait ? { art: <SceneArt ctx={ctx} chatId={scene.id} characterId={scene.cast.character.id} snapshotVersion={scene.snapshotVersion} hasArt name={scene.characterName} /> } : {})} />;
}

export function Rail({ programs, openId, onChat, onOpen }: { programs: readonly Program[]; openId: string | null; onChat(): void; onOpen(id: string): void }): JSX.Element {
  return (
    <nav className="msn-rail" aria-label="Feature tabs">
      <button type="button" className="msn-tab" aria-label="Chat" title="Chat" aria-pressed={openId === null} data-active={openId === null} onClick={onChat}><Ic name="lucide:message-circle" /></button>
      <span className="msn-divider" />
      <div className="msn-tabs">
        {programs.map((p) => (
          <button key={p.id} type="button" className="msn-tab" title={p.title} aria-label={p.title} aria-pressed={openId === p.id} data-active={openId === p.id} onClick={() => onOpen(p.id)}><Ic name={p.icon} /></button>
        ))}
      </div>
    </nav>
  );
}

export interface SidebarProps {
  ctx: AppContext;
  /** The open scene: its character, and the row that stays reachable while the recents load or fail. */
  current: { characterId: string; name: string; avatar: ReactNode };
  recents: Recents;
  hasCharacters: boolean;
  activities: readonly { id: string; title: string; programId: string }[];
  persona: { name: string; canOpen: boolean };
  canSettings: boolean;
  onClose(): void;
  onChat(): void;
  onBrowse(): void;
  onRetry(): void;
  onPick(scene: SceneSummary): void;
  onActivity(programId: string): void;
  onProfile(): void;
  onSettings(): void;
}

export function Sidebar(p: SidebarProps): JSX.Element {
  const rows = p.recents.state === "ready" ? p.recents.rows : [];
  const missing = !rows.some((s) => s.cast.character.id === p.current.characterId);
  return (
    <aside className="msn-side" aria-label="Character conversations">
      <div className="msn-side-h"><span>Bunraku</span><button type="button" className="msn-mclose" aria-label="Close character sidebar" onClick={p.onClose}><Ic name="lucide:chevron-left" /></button></div>
      {p.hasCharacters && <button type="button" className="msn-browse" onClick={p.onBrowse}><Ic name="lucide:message-circle" />Browse Characters</button>}
      <div className="msn-dms"><h2>RECENT CHARACTERS</h2>
        {p.recents.state === "loading" && <p role="status" className="msn-empty">Loading recent chats…</p>}
        {p.recents.state === "failed" && <div role="status" className="msn-empty"><p>{RECENTS_ERROR}</p><button type="button" onClick={p.onRetry}>Try again</button></div>}
        {missing && <button type="button" className="msn-dm" data-active="true" aria-current="page" aria-label={`Current chat with ${p.current.name}`} onClick={p.onChat}>{p.current.avatar}<span><strong>{p.current.name}</strong><small>Current conversation</small></span></button>}
        {rows.map((s) => {
          const active = s.cast.character.id === p.current.characterId;
          return (
            <button key={s.cast.character.id} type="button" className="msn-dm" data-active={active} aria-current={active ? "page" : undefined} onClick={() => p.onPick(s)}>
              <SceneAvatar ctx={p.ctx} scene={s} /><span><strong>{s.characterName}</strong>{s.title && s.title !== s.characterName && <> <small>{s.title}</small></>}</span>
            </button>
          );
        })}
        {p.recents.state === "ready" && rows.length === 0 && <p className="msn-empty">Your recent character chats will appear here.</p>}
      </div>
      {p.activities.length > 0 && <nav className="msn-acts" aria-label="Active features">{p.activities.map((a) => <button type="button" key={a.id} onClick={() => p.onActivity(a.programId)}>{a.title}</button>)}</nav>}
      <footer className="msn-ubar">
        <button type="button" className="msn-profile" aria-label="Profile settings" disabled={!p.persona.canOpen} onClick={p.onProfile}><Avatar name={p.persona.name} /><span><strong>{p.persona.name}</strong><small>Profile</small></span></button>
        <button type="button" className="msn-gear" aria-label="Open settings" title="Settings" disabled={!p.canSettings} onClick={p.onSettings}><Ic name="lucide:settings" /></button>
      </footer>
    </aside>
  );
}
