/**
 * The Party tracker, RoleCall's `party` module (stores/immersion/party.ts, PartyWingPanel.tsx, the prompt line at immersion-context.ts:132-141): the adventuring
 * party's members with their role, lane and vitals, the formation, the tactics. Pure: the panel computes the next state with `applyParty` and the scene keeps it
 * (ChatStore rule 43). Members come from Generate and Refresh, which only propose (generate.ts).
 *
 * Differences from RoleCall, each deliberate: a member the model made joins ONLINE with an id of their own, where RoleCall files the answer
 * as it is, with no id and no online flag, so the member never reaches the prompt (its line names only online members) and "Make Leader" cannot find them; "Add
 * Member" is offered on an empty party, where RoleCall draws it only after the first member exists; Remove marks the member and leaves an Undo; the shared inventory
 * (a TODO in RoleCall, never filled or drawn) is not kept. Formation and tactics are shown as RoleCall shows them: nothing in its panel changes them, the Story
 * Director does (set_formation, set_tactics).
 */
import { arr, bool, num, obj, oneOf, opt, refine, str, type Of } from "./shape";
import { repairOf, stateSpec } from "./state";
import { hasUniqueIds } from "./list";
import type { GenSpec } from "./generate";
import { byName, entry, listOf, single, sync, type RefreshSpec } from "./refresh";

export const ROLES = ["tank", "dps", "healer", "support"] as const;
export const POSITIONS = ["front", "mid", "back"] as const;
export type CombatRole = (typeof ROLES)[number];
export type Position = (typeof POSITIONS)[number];

const MAX_MEMBERS = 50;
const text = (max: number, o: { min?: number } = {}) => str({ max, ...o });

const fields = {
  name: text(80, { min: 1 }),
  combatRole: oneOf(ROLES, "dps"),
  formationPosition: oneOf(POSITIONS, "mid"),
  hp: num({ lo: 0, hi: 1_000_000, def: 100 }),
  maxHp: num({ lo: 1, hi: 1_000_000, def: 100 }),
  mp: num({ lo: 0, hi: 1_000_000, def: 50 }),
  maxMp: num({ lo: 0, hi: 1_000_000, def: 50 }),
  level: num({ lo: 1, hi: 9999, def: 1 }),
};
type Vitals = { hp: number; maxHp: number; mp: number; maxMp: number };
const within = <T extends Vitals>(v: T): boolean => v.hp <= v.maxHp && v.mp <= v.maxMp;
const clamped = <T extends Vitals>(v: T): T => ({ ...v, hp: Math.min(v.hp, v.maxHp), mp: Math.min(v.mp, v.maxMp) });

const generated = refine(obj(fields), { fix: clamped, valid: within });
const memberShape = refine(obj({ ...fields, profileId: text(80, { min: 1 }), avatarUrl: opt(text(500)), isOnline: bool(), isLeader: bool(), removedAt: opt(num({ lo: 0, hi: 1e15 })) }), { fix: clamped, valid: within });
export type Member = Of<typeof memberShape>;
type Made = Of<typeof generated>;

export interface Party {
  name: string;
  /** Absent while nobody leads. */
  leaderId?: string;
  members: Member[];
  formation: { mode: "lanes" | "free"; lanes: { front: string[]; mid: string[]; back: string[] } };
  tactics: { preset: "aggressive" | "defensive" | "balanced" | "support" | "custom"; conserveMana: boolean; focus: "auto" | "damage" | "survival"; protectId?: string };
  sharedCurrency: number;
  currencySplit: "shared" | "even" | "leader";
}
export const DEFAULT_PARTY: Party = {
  name: "Adventuring Party", members: [],
  formation: { mode: "lanes", lanes: { front: [], mid: [], back: [] } },
  tactics: { preset: "balanced", conserveMana: false, focus: "auto" },
  sharedCurrency: 0, currencySplit: "shared",
};

const ids = arr(text(80, { min: 1 }), MAX_MEMBERS * 2);
/** The module's whole state, field by field: what a state passes, and what a slot holds one field or row of (state.ts). */
export const stateShape = obj({
  name: text(100, { min: 1 }),
  leaderId: opt(text(80, { min: 1 })),
  members: arr(memberShape, MAX_MEMBERS * 2),
  formation: obj({ mode: oneOf(["lanes", "free"] as const), lanes: obj({ front: ids, mid: ids, back: ids }) }),
  tactics: obj({ preset: oneOf(["aggressive", "defensive", "balanced", "support", "custom"] as const), conserveMana: bool(), focus: oneOf(["auto", "damage", "survival"] as const), protectId: opt(text(80, { min: 1 })) }),
  sharedCurrency: num({ lo: 0, hi: 1_000_000_000, int: true }),
  currencySplit: oneOf(["shared", "even", "leader"] as const),
});

export function parseParty(data: unknown): Party | null {
  const s = stateShape.check(data);
  if (!s || !hasUniqueIds(s.members.map((m) => ({ id: m.profileId })))) return null;
  if (s.leaderId !== undefined && !s.members.some((m) => m.profileId === s.leaderId)) return null;
  return s as unknown as Party;
}
/** What party keeps in its slot (state.ts). */
export const PARTY_STATE = stateSpec(stateShape, { members: "profileId" });
/** The module's one repair step (state.ts `repairOf`): every reader goes through `readParty`, which uses it, so no read ever shows the defaults in place of a state it can mostly keep. Null: nothing is salvageable. */
export const repairParty = repairOf(PARTY_STATE, DEFAULT_PARTY, parseParty, (d) => {
  const { leaderId, ...rest } = d;
  return leaderId === undefined || (d["members"] as Member[]).some((m) => m.profileId === leaderId) ? d : rest;
});
export const readParty = (data: unknown): Party => (data === undefined ? DEFAULT_PARTY : repairParty(data) ?? DEFAULT_PARTY);
export const liveMembers = (p: Party): Member[] => p.members.filter((m) => m.removedAt === undefined);

export type PartyAction =
  | { kind: "add"; member: Made; id: string }
  | { kind: "refresh"; id: string; member: Made }
  | { kind: "leader"; id: string }
  | { kind: "remove"; id: string; at: number }
  | { kind: "restore"; id: string };

const without = (lanes: Party["formation"]["lanes"], id: string): Party["formation"]["lanes"] => ({ front: lanes.front.filter((x) => x !== id), mid: lanes.mid.filter((x) => x !== id), back: lanes.back.filter((x) => x !== id) });

/** One panel action, as RoleCall's store does it (party.ts:addMember, removeMember, updateMember, setLeader), returning the next state; the same state when nothing changes. */
export function applyParty(p: Party, a: PartyAction): Party {
  switch (a.kind) {
    case "add": {
      if (liveMembers(p).length >= MAX_MEMBERS || p.members.some((m) => m.profileId === a.id)) return p;
      const member: Member = { ...a.member, profileId: a.id, isOnline: true, isLeader: false };
      const lanes = { ...p.formation.lanes, [member.formationPosition]: [...p.formation.lanes[member.formationPosition], a.id] };
      return { ...p, members: [...p.members, member], formation: { ...p.formation, lanes } };
    }
    case "refresh": return { ...p, members: p.members.map((m) => (m.profileId === a.id && m.removedAt === undefined ? { ...m, ...a.member } : m)) };
    case "leader": return liveMembers(p).some((m) => m.profileId === a.id) ? { ...p, leaderId: a.id, members: p.members.map((m) => ({ ...m, isLeader: m.profileId === a.id })) } : p;
    case "remove": {
      if (a.id === p.leaderId || !liveMembers(p).some((m) => m.profileId === a.id)) return p;
      return { ...p, members: p.members.map((m) => (m.profileId === a.id ? { ...m, removedAt: a.at } : m)), formation: { ...p.formation, lanes: without(p.formation.lanes, a.id) } };
    }
    case "restore": {
      const gone = p.members.find((m) => m.profileId === a.id && m.removedAt !== undefined);
      if (!gone) return p;
      const { removedAt: _off, ...back } = gone;
      const lanes = without(p.formation.lanes, a.id);
      return { ...p, members: p.members.map((m) => (m === gone ? back : m)), formation: { ...p.formation, lanes: { ...lanes, [back.formationPosition]: [...lanes[back.formationPosition], a.id] } } };
    }
  }
}

/** The narrator's Party line (immersion-context.ts:132-141): the party's name and its members who are online, with role and HP. */
export function partyLines(p: Party): string[] {
  const live = liveMembers(p);
  if (live.length === 0) return [];
  const names = live.filter((m) => m.isOnline).map((m) => `${m.name} (${m.combatRole}, HP ${m.hp}/${m.maxHp})`);
  return [`**Party**: "${p.name}" | Members: ${names.join(", ")}`];
}

/** RoleCall's schema text for a `party` member (generate-tracker-item/route.ts, moduleSchemas.party). */
export const PARTY_GEN: GenSpec<Made> = {
  description: () => "Party member entry",
  schema: () => `{
  "name": string,
  "combatRole": "tank" | "dps" | "healer" | "support",
  "formationPosition": "front" | "mid" | "back",
  "hp": number,
  "maxHp": number,
  "mp": number,
  "maxMp": number,
  "level": number
}`,
  item: generated as GenSpec<Made>["item"],
};

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.party). The leader cannot be removed (applyParty), so a leader the answer leaves out stays. */
export const PARTY_REFRESH: RefreshSpec = {
  maxTokens: 4000,
  instruction: (subs) => `If there are companions traveling with the protagonist, list them.
Format: { "members": [${PARTY_GEN.schema(subs)}], "name": string }`,
  rows: (d) => {
    const p = readParty(d);
    return [...liveMembers(p).map((m) => entry("members", m.name, PARTY_GEN.item.coerce(m) ?? m)), single("name", "Party name", p.name)];
  },
  next(d, a, env) {
    const made = listOf(a, "members", PARTY_GEN.item, env);
    if (!made) return null;
    const p = readParty(d);
    const next = sync(p, liveMembers(p), made, byName, {
      refresh: (s, old, member) => applyParty(s, { kind: "refresh", id: old.profileId, member }),
      add: (s, member) => applyParty(s, { kind: "add", member, id: env.id() }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyParty(s, { kind: "remove", id: old.profileId, at: env.now }),
    });
    const name = typeof a["name"] === "string" ? a["name"].trim().slice(0, 100) : "";
    return name ? { ...next, name } : next;
  },
};
