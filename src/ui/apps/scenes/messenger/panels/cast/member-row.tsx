/**
 * One person in the Cast member list (panels.html 2a): the face (a click opens the profile card), the name in the person's own color, a status line, the Main / Card / Player badges, the
 * presence dot, and a hover bar with Ping (puts `@Name` in the composer draft), Set Main and a More menu (profile, Ping, Set or Unset Main, and the presence moves). A retired person shows Restore instead.
 */
import { useState, type JSX } from "react";
import { protect } from "../../../../../_shared/protected-control";
import { useAccentText } from "../../../../../_shared/use-scoped-accents";
import { Button, IconButton } from "../../../../../components/button";
import type { RosterRow } from "../../../../../../core/participants/roster";
import type { ParticipantChange, ParticipantPresence } from "../../../../../../stage/contracts/chat-store";
import { usePing } from "../../../cast/participant-row";
import { ContextMenu, type MenuEntry } from "../../frames/context-menu";
import { MemberFace } from "./member-face";
import { statusLine } from "./members-model";

const KIND_BADGE: Readonly<Record<RosterRow["kind"], string | null>> = { card: "Card", player: "Player", npc: null };

const PRESENCE_MOVES: ReadonlyArray<{ id: ParticipantPresence; label: string }> = [{ id: "present", label: "Put on stage" }, { id: "background", label: "Move to background" }, { id: "absent", label: "Mark absent" }];

export interface MemberRowProps {
  chatId: string;
  row: RosterRow;
  onProfile(): void;
  onChange(c: ParticipantChange): void;
}

export function MemberRow({ chatId, row, onProfile, onChange }: MemberRowProps): JSX.Element {
  const readable = useAccentText();
  const { ping, notice } = usePing(chatId);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const items: MenuEntry[] = [
    { id: "profile", label: "Open profile", icon: "lucide:user-round", onSelect: onProfile },
    { id: "ping", label: `Ping ${row.name}`, icon: "lucide:message-circle", onSelect: () => ping(row.name) },
    { id: "main", label: row.main ? "Unset Main" : "Set Main", icon: "lucide:star", onSelect: () => onChange({ op: "main", id: row.main ? null : row.id }) },
    { id: "sep", separator: true },
    ...PRESENCE_MOVES.filter((m) => m.id !== row.presence).map((m): MenuEntry => ({ id: m.id, label: m.label, onSelect: () => onChange({ op: "edit", id: row.id, edit: { presence: m.id } }) })),
  ];
  const first = row.shown[0];
  const status = row.retired ? "Retired" : statusLine(row);
  const kind = KIND_BADGE[row.kind];
  return (
    <div className="msn-cm-row" data-dim={row.retired || row.presence === "absent" || undefined} data-part={`scene.messenger.cast.member.${row.id}`}>
      <IconButton variant="quiet" size="sm" data-part="scene.messenger.cast.member.face" label={`Open profile of ${row.name}`} icon={<MemberFace row={row} />} onClick={onProfile} />
      <div className="msn-cm-tx">
        <b style={first ? { color: readable(first) } : undefined}>{row.name}</b>
        {notice ? <small role="status" data-part="scene.messenger.cast.member.ping-notice">{notice}</small> : status && <small>{status}</small>}
      </div>
      <div className="msn-cm-mt">
        {row.main && <span className="msn-cm-badge" data-part="scene.messenger.cast.member.main">Main</span>}
        {kind && <span className="msn-cm-badge">{kind}</span>}
        {!row.retired && <span className="msn-cm-dot" data-on={row.presence === "present" || undefined} role="img" aria-label={row.presence === "present" ? "Present" : row.presence === "absent" ? "Absent" : "Background"} />}
        {row.retired && <span {...protect("participant-delete")}><Button variant="quiet" size="sm" data-part="scene.messenger.cast.member.restore" onClick={() => onChange({ op: "edit", id: row.id, edit: { retired: false } })}>Restore</Button></span>}
      </div>
      {!row.retired && (
        <div className="msn-cm-bar">
          <IconButton variant="quiet" size="sm" data-part="scene.messenger.cast.member.ping" label={`Ping ${row.name}`} icon="lucide:message-circle" onClick={() => ping(row.name)} />
          {!row.main && <IconButton variant="quiet" size="sm" data-part="scene.messenger.cast.member.set-main" label={`Set ${row.name} as main`} icon="lucide:star" onClick={() => onChange({ op: "main", id: row.id })} />}
          <IconButton variant="quiet" size="sm" data-part="scene.messenger.cast.member.more" label={`More for ${row.name}`} icon="lucide:ellipsis" aria-haspopup="menu" aria-expanded={menuAt !== null}
            onClick={(e) => { const box = e.currentTarget.getBoundingClientRect(); setMenuAt({ x: box.left, y: box.bottom }); }} />
        </div>
      )}
      {menuAt && <ContextMenu items={items} at={menuAt} label={`${row.name} menu`} onClose={() => setMenuAt(null)} />}
    </div>
  );
}
