/**
 * The Cast member list's grouping (approved wireframe messenger-discord/panels.html 2a), a pure view over the roster the Participants tab reads (core/participants/roster.ts).
 * Each live person is in exactly one group: On stage (presence is present), NPCs (an NPC that is not on stage), Registered (the card or the player while not on stage). Retired people
 * keep their own group with Restore. "Registered" here means in the scene's registry but not on stage; the roster has no other meaning for it.
 */
import type { Roster, RosterRow } from "../../../../../../core/participants/roster";

export interface MemberGroups {
  onStage: RosterRow[];
  npcs: RosterRow[];
  registered: RosterRow[];
  retired: RosterRow[];
}

export function groupMembers(roster: Roster): MemberGroups {
  const live = [roster.main, ...(roster.player ? [roster.player] : []), ...roster.cards, ...roster.npcs];
  const here = (r: RosterRow): boolean => r.presence === "present";
  return {
    onStage: live.filter(here),
    npcs: live.filter((r) => !here(r) && r.kind === "npc"),
    registered: live.filter((r) => !here(r) && r.kind !== "npc"),
    retired: roster.retired,
  };
}

/** The line under a name: what the person wrote about them, else where they stand when they are not on stage. */
export function statusLine(row: RosterRow): string | undefined {
  if (row.description?.trim()) return row.description.trim();
  return row.presence === "absent" ? "Absent" : row.presence === "background" ? "Background" : undefined;
}

/** A face fill from the colors a person has: one color, or a gradient across the stops. */
export function faceFill(colors: readonly string[]): string | undefined {
  return colors.length === 0 ? undefined : colors.length === 1 ? colors[0] : `linear-gradient(135deg, ${colors.join(", ")})`;
}

/** Whether a person matches the cast search: the typed text is in their name or their note, ignoring case. An empty search matches everyone. */
export function matchesQuery(row: RosterRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === "" || row.name.toLowerCase().includes(q) || (row.description ?? "").toLowerCase().includes(q);
}
