/**
 * The Messenger's member list on the right (approved wireframe messenger-discord/shell.html `right()`): the scene's character with its portrait (click to enlarge, as the old portrait aside did),
 * the other participants, and the persona, read from the same roster the Participants tab draws (participants/scene-roster.ts, the stored participants held once per scene). It is read-only:
 * a row opens the Participants program, where Ping, Color, presence and Reconcile live. Presence dots, Mute, Add participant and the profile card have no data or writer yet and are not drawn.
 */
import { useEffect, useMemo, useRef, type JSX, type RefObject } from "react";
import type { AppContext } from "../../../../app-contract";
import { IconButton, ListRow, Scrim } from "../../../../components/button";
import type { RosterRow } from "../../../../../core/participants/roster";
import { useEscapeKey } from "../../../../_shared/use-escape-key";
import type { OpenScene } from "../../../../../studio/scenes";
import { holdParticipants, useHeldParticipants } from "../../participants/participants-store";
import { sceneRoster } from "../../participants/scene-roster";
import { ZoomArt } from "../../scene-portrait-zoom";
import { Avatar } from "../messenger-parts";

export interface MembersProps {
  ctx: AppContext;
  scene: OpenScene;
  name: string;
  canOpen: boolean;
  /** Under 1024px the list is a drawer over the chat: a scrim behind it, Escape closes it, focus moves in and returns. */
  drawer?: boolean;
  onOpen(): void;
  onClose(): void;
}

/** The stored participants of a scene: the held copy, or one guarded read when nothing holds it yet (a failed read leaves the roster as the card and persona alone). */
function useStoredParticipants(ctx: AppContext, chatId: string) {
  const stored = useHeldParticipants(chatId);
  useEffect(() => {
    if (stored !== undefined) return undefined;
    let live = true;
    Promise.resolve().then(() => ctx.api.getSceneParticipants(chatId)).then((r) => { if (live) holdParticipants(chatId, r.participants); }, () => undefined);
    return () => { live = false; };
  }, [ctx.api, chatId, stored]);
  return stored;
}

function Group({ title, rows, canOpen, onOpen, sub }: { title: string; rows: readonly RosterRow[]; canOpen: boolean; onOpen(): void; sub?: string }): JSX.Element | null {
  if (rows.length === 0) return null;
  return (
    <section aria-label={title}>
      <h3 className="msn-cap">{title}, {rows.length}</h3>
      {rows.map((r) => <ListRow key={r.id} data-part={`scene.messenger.members.row.${r.id}`} disabled={!canOpen} leading={<Avatar name={r.name} />} label={r.name} subtitle={r.presence === "absent" ? "Muted in this scene" : sub} onClick={onOpen} />)}
    </section>
  );
}

/** A drawer takes focus on its close button and gives it back to what had it (the header button) when it goes away. */
function useDrawerFocus(root: RefObject<HTMLElement | null>, on: boolean): void {
  useEffect(() => {
    if (!on) return undefined;
    const before = document.activeElement;
    root.current?.querySelector<HTMLElement>('[data-part="scene.messenger.members.close"]')?.focus();
    return () => { if (before instanceof HTMLElement && before.isConnected) before.focus(); };
  }, [root, on]);
}

export function Members({ ctx, scene, name, canOpen, drawer = false, onOpen, onClose }: MembersProps): JSX.Element {
  const root = useRef<HTMLElement>(null);
  useEscapeKey(onClose, drawer);
  useDrawerFocus(root, drawer);
  const stored = useStoredParticipants(ctx, scene.chat.id);
  const roster = useMemo(() => sceneRoster(scene, stored ?? undefined), [scene, stored]);
  const others = roster.cards.concat(roster.npcs);
  return (
    <>
    {drawer && <Scrim data-part="scene.messenger.members.scrim" label="Close member list" onClick={onClose} />}
    <aside ref={root} className="msn-mem" aria-label="Member list" data-part="scene.messenger.members">
      <div className="msn-mem-h"><strong>Members</strong><IconButton variant="quiet" size="sm" data-part="scene.messenger.members.close" label="Close member list" icon="lucide:x" onClick={onClose} /></div>
      <div className="msn-mem-b">
        {scene.hasPortrait && (
          <div className="msn-portrait" data-part="scene.messenger.members.portrait">
            <ZoomArt ctx={ctx} chatId={scene.chat.id} characterId={scene.chat.cast.character.id} snapshotVersion={scene.chat.snapshotVersion} hasArt name={name} />
          </div>
        )}
        <Group title="Characters" rows={[roster.main]} canOpen={canOpen} onOpen={onOpen} sub="Character" />
        <Group title="Participants" rows={others} canOpen={canOpen} onOpen={onOpen} />
        <Group title="Persona" rows={roster.player ? [roster.player] : []} canOpen={canOpen} onOpen={onOpen} sub="Persona" />
      </div>
    </aside>
    </>
  );
}
