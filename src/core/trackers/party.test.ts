/** The Party tracker's rules (RoleCall stores/immersion/party.ts, PartyWingPanel.tsx, immersion-context.ts:132-141, generate-tracker-item/route.ts). */
import { describe, expect, test } from "bun:test";
import { parseItem } from "./generate";
import { DEFAULT_PARTY, PARTY_GEN, applyParty, liveMembers, parseParty, partyLines, readParty, type Member, type Party } from "./party";

const made = (over: Partial<Member> = {}) => ({ name: "Brann", combatRole: "tank" as const, formationPosition: "front" as const, hp: 80, maxHp: 100, mp: 10, maxMp: 20, level: 3, ...over });
const joined = (...names: string[]): Party => names.reduce((p, n, i) => applyParty(p, { kind: "add", member: made({ name: n }), id: `m${i}` }), DEFAULT_PARTY);

describe("add", () => {
  test("a member joins online, not leading, in the lane of their position, with an id of their own", () => {
    const p = applyParty(DEFAULT_PARTY, { kind: "add", member: made(), id: "m1" });
    expect(p.members).toEqual([{ ...made(), profileId: "m1", isOnline: true, isLeader: false }]);
    expect(p.formation.lanes).toEqual({ front: ["m1"], mid: [], back: [] });
  });
  test("a member added as 'mid' is placed in the middle lane, and the party name is RoleCall's default", () => {
    const p = applyParty(DEFAULT_PARTY, { kind: "add", member: made({ formationPosition: "mid" }), id: "m1" });
    expect(p.formation.lanes.mid).toEqual(["m1"]);
    expect(DEFAULT_PARTY.name).toBe("Adventuring Party");
  });
  test("a full party refuses another member", () => {
    const full = joined(...Array.from({ length: 50 }, (_, i) => `M${i}`));
    expect(applyParty(full, { kind: "add", member: made({ name: "Extra" }), id: "z" })).toBe(full);
  });
});

describe("leader, refresh, remove, restore", () => {
  test("making a member leader moves the crown", () => {
    let p = applyParty(joined("A", "B"), { kind: "leader", id: "m1" });
    expect([p.leaderId, p.members.map((m) => m.isLeader)]).toEqual(["m1", [false, true]]);
    p = applyParty(p, { kind: "leader", id: "m0" });
    expect([p.leaderId, p.members.map((m) => m.isLeader)]).toEqual(["m0", [true, false]]);
  });
  test("a refreshed member takes the new numbers and role and keeps their id, crown and place", () => {
    const p = applyParty(applyParty(joined("A"), { kind: "leader", id: "m0" }), { kind: "refresh", id: "m0", member: made({ name: "A", hp: 50, combatRole: "healer" }) });
    expect(p.members[0]).toMatchObject({ profileId: "m0", isLeader: true, hp: 50, combatRole: "healer", isOnline: true });
  });
  test("the leader cannot be removed (RoleCall hides Remove on the leader); anyone else is marked and leaves their lane, and Undo puts them back", () => {
    let p = applyParty(joined("A", "B"), { kind: "leader", id: "m0" });
    expect(applyParty(p, { kind: "remove", id: "m0", at: 5 })).toBe(p);
    p = applyParty(p, { kind: "remove", id: "m1", at: 5 });
    expect(liveMembers(p).map((m) => m.name)).toEqual(["A"]);
    expect(p.formation.lanes.front).toEqual(["m0"]);
    p = applyParty(p, { kind: "restore", id: "m1" });
    expect(liveMembers(p)).toHaveLength(2);
    expect(p.formation.lanes.front).toContain("m1");
  });
});

describe("the prompt line (immersion-context.ts:132-141)", () => {
  test("is the party name and the online members with role and HP; a removed or offline member is not named; no members adds nothing", () => {
    expect(partyLines(DEFAULT_PARTY)).toEqual([]);
    let p = joined("A", "B");
    p = { ...p, members: p.members.map((m, i) => (i === 1 ? { ...m, isOnline: false } : m)) };
    expect(partyLines(p)).toEqual(['**Party**: "Adventuring Party" | Members: A (tank, HP 80/100)']);
    expect(partyLines(applyParty(joined("A", "B"), { kind: "remove", id: "m1", at: 1 }))).toEqual(['**Party**: "Adventuring Party" | Members: A (tank, HP 80/100)']);
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; data that is not a state falls back to the empty party", () => {
    const p = joined("A", "B");
    expect(parseParty(p)).toEqual(p);
    expect(readParty(undefined)).toEqual(DEFAULT_PARTY);
    expect(readParty({ members: 3 })).toEqual(DEFAULT_PARTY);
  });
  test("HP above the maximum, a leader who is not a member and two members with one id are refused", () => {
    const p = joined("A");
    expect(parseParty({ ...p, members: [{ ...p.members[0]!, hp: 200 }] })).toBeNull();
    expect(parseParty({ ...p, leaderId: "nobody" })).toBeNull();
    expect(parseParty({ ...p, members: [p.members[0]!, p.members[0]!] })).toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("an answer becomes a member, with RoleCall's fallback numbers for anything left out and HP kept within the maximum", () => {
    expect(parseItem(PARTY_GEN)('{"name":"Brann","combatRole":"Healer","formationPosition":"back","hp":150,"maxHp":120,"level":"4"}')).toEqual({ ok: true, value: { name: "Brann", combatRole: "healer", formationPosition: "back", hp: 120, maxHp: 120, mp: 50, maxMp: 50, level: 4 } });
    expect(parseItem(PARTY_GEN)('{"role":"x"}')).toMatchObject({ ok: false });
  });
});
