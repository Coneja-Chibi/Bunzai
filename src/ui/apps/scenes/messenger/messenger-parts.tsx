/**
 * The Messenger's left side (RoleCall DiscordChrome.tsx:43-46,313-336): the avatar, the feature rail (the Chat button, a divider, one button per program) and the sidebar (heading,
 * Browse Characters, RECENT CHARACTERS with RoleCall's loading, failure and empty copy, the active-feature pills, and the user bar with the persona and the gear).
 */
import type { JSX, ReactNode } from "react";
import type { AppContext } from "../../../app-contract";
import { Button, Chip, IconButton, ListRow, Tabs } from "../../../components/button";
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

/** The Chat tab's value in the rail; a program id can never equal it (program ids are plain slugs). */
const CHAT_TAB = "__chat__";

export function Rail({ programs, openId, onChat, onOpen }: { programs: readonly Program[]; openId: string | null; onChat(): void; onOpen(id: string): void }): JSX.Element {
  return (
    <nav className="msn-rail" aria-label="Feature tabs">
      <div className="msn-tabs">
        <Tabs orientation="vertical" label="Feature tabs" value={openId ?? CHAT_TAB} onChange={(id) => (id === CHAT_TAB ? onChat() : onOpen(id))}
          items={[{ value: CHAT_TAB, title: "Chat", label: <Ic name="lucide:message-circle" /> }, ...programs.map((p) => ({ value: p.id, title: p.title, label: <Ic name={p.icon} /> }))]} />
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
      <div className="msn-side-h"><span>Bunraku</span><span className="msn-mclose"><IconButton label="Close character sidebar" icon="lucide:chevron-left" onClick={p.onClose} /></span></div>
      {p.hasCharacters && <div className="msn-browse"><Button variant="quiet" block icon="lucide:message-circle" onClick={p.onBrowse}>Browse Characters</Button></div>}
      <div className="msn-dms"><h2>RECENT CHARACTERS</h2>
        {p.recents.state === "loading" && <p role="status" className="msn-empty">Loading recent chats…</p>}
        {p.recents.state === "failed" && <div role="status" className="msn-empty"><p>{RECENTS_ERROR}</p><Button variant="quiet" size="sm" onClick={p.onRetry}>Try again</Button></div>}
        {missing && <ListRow selected aria-current="page" aria-label={`Current chat with ${p.current.name}`} onClick={p.onChat} leading={p.current.avatar} label={p.current.name} subtitle="Current conversation" />}
        {rows.map((s) => {
          const active = s.cast.character.id === p.current.characterId;
          return (
            <ListRow key={s.cast.character.id} selected={active} aria-current={active ? "page" : undefined} onClick={() => p.onPick(s)}
              leading={<SceneAvatar ctx={p.ctx} scene={s} />} label={s.characterName} subtitle={s.title && s.title !== s.characterName ? s.title : undefined} />
          );
        })}
        {p.recents.state === "ready" && rows.length === 0 && <p className="msn-empty">Your recent character chats will appear here.</p>}
      </div>
      {p.activities.length > 0 && <nav className="msn-acts" aria-label="Active features">{p.activities.map((a) => <Chip key={a.id} onClick={() => p.onActivity(a.programId)}>{a.title}</Chip>)}</nav>}
      <footer className="msn-ubar">
        <div className="msn-profile"><ListRow aria-label="Profile settings" disabled={!p.persona.canOpen} onClick={p.onProfile} leading={<Avatar name={p.persona.name} />} label={p.persona.name} subtitle="Profile" /></div>
        <IconButton label="Open settings" title="Settings" icon="lucide:settings" disabled={!p.canSettings} onClick={p.onSettings} />
      </footer>
    </aside>
  );
}
