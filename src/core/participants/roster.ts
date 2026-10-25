/**
 * The roster the Cast wing's Participants tab shows, built from the scene's cast and its stored participants (ChatStore
 * rule 41): RoleCall's `loadChatParticipantProfiles` (`lib/chat-participants/profiles.ts:79-133`) without the inserts. Colour is the
 * participant's own, else the card's (a card), else a stable palette hash (an NPC or a card with none); the player shows none. Pure.
 */
import { CARD_ID, PLAYER_ID, type ChatParticipant, type ChatParticipants, type ParticipantKind, type ParticipantPresence } from "../../stage/contracts/chat-participant-types";
import { pickPaletteHex } from "./palette";

export interface RosterInput {
  chatId: string;
  /** The scene's character: its id, its name and its colours (a gradient's stops, else its one signature; none when it has none). */
  card: { id: string; name: string; colors: readonly string[] };
  /** The persona being played; absent plays as RoleCall's default "You". */
  persona: { name: string } | undefined;
  stored: ChatParticipants | undefined;
}

export interface RosterRow {
  id: string;
  kind: ParticipantKind;
  name: string;
  description: string | undefined;
  /** The colours the person set; empty when the participant uses its default. */
  colors: string[];
  /** The colours drawn: `colors`, else the default. */
  shown: string[];
  presence: ParticipantPresence;
  main: boolean;
  /** The main slot that follows the scene's character card, which Unset Main cannot move. */
  anchored: boolean;
  retired: boolean;
}

export interface Roster {
  main: RosterRow;
  /** The player, unless Set Main made it the main. */
  player: RosterRow | null;
  /** Card participants that are not the main: the scene's character after Set Main moved the slot. */
  cards: RosterRow[];
  npcs: RosterRow[];
  retired: RosterRow[];
  counts: { registered: number; npcs: number; onStage: number };
}

/** A speaker the message renderer colours quoted speech for. `color` is the first stop of the participant's colours. */
export interface Speaker { id: string; name: string; main: boolean; color: string }

export function buildRoster(input: RosterInput): Roster {
  const { chatId, card, persona, stored } = input;
  const by = new Map<string, ChatParticipant>((stored?.people ?? []).map((p) => [p.id, p]));
  const row = (id: string, kind: ParticipantKind, name: string, fallback: readonly string[], presence: ParticipantPresence, own: ChatParticipant | undefined): RosterRow => {
    const colors = own?.colors ?? [];
    return {
      id, kind, name: own?.name ?? name, description: own?.description, colors: [...colors], shown: colors.length ? [...colors] : [...fallback],
      presence: own?.presence ?? presence, main: false, anchored: false, retired: own?.retired === true,
    };
  };
  const cardRow = row(CARD_ID, "card", card.name, card.colors.length ? card.colors : [pickPaletteHex(`${chatId}|card|${card.id}`)], "present", by.get(CARD_ID));
  const playerRow = row(PLAYER_ID, "player", persona?.name ?? "You", [], "present", by.get(PLAYER_ID));
  const live = (stored?.people ?? []).filter((p) => p.kind === "npc" && !p.retired);
  const npcs = live
    .map((p) => row(p.id, "npc", p.name ?? "", [pickPaletteHex(`${chatId}|npc|${(p.name ?? "").trim()}`)], "background", p))
    .sort((a, b) => (by.get(b.id)!.at - by.get(a.id)!.at) || a.name.localeCompare(b.name));
  const retired = (stored?.people ?? []).filter((p) => p.kind === "npc" && p.retired).map((p) => row(p.id, "npc", p.name ?? "", [], "background", p));

  const wanted = stored?.main;
  const mainRow = wanted === PLAYER_ID ? playerRow : npcs.find((n) => n.id === wanted) ?? cardRow;
  mainRow.main = true;
  mainRow.anchored = mainRow === cardRow;
  const all = [cardRow, playerRow, ...npcs];
  return {
    main: mainRow,
    player: mainRow === playerRow ? null : playerRow,
    cards: mainRow === cardRow ? [] : [cardRow],
    npcs: npcs.filter((n) => n !== mainRow),
    retired,
    counts: { registered: all.length, npcs: npcs.length, onStage: all.filter((r) => r.presence === "present").length },
  };
}

/** Who can speak in a message: the card and the live NPCs (RoleCall `computeQuoteColorAssignments` drops the player), the main first. */
export function speakersOf(roster: Roster): Speaker[] {
  const people = [roster.main, ...roster.cards, ...roster.npcs].filter((r) => r.kind !== "player");
  return people.flatMap((r) => (r.shown[0] ? [{ id: r.id, name: r.name, main: r.main, color: r.shown[0] }] : []));
}
