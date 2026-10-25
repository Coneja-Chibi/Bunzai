/** The roster the Participants tab shows (RoleCall ParticipantRegistryPanel.tsx and lib/chat-participants/profiles.ts), from the cast and the stored participants. */
import { describe, expect, test } from "bun:test";
import type { ChatParticipant } from "../../stage/contracts/chat-participant-types";
import { DIALOGUE_PALETTE, pickPaletteHex } from "./palette";
import { buildRoster, speakersOf, type RosterInput } from "./roster";

const npc = (id: string, name: string, more: Partial<ChatParticipant> = {}): ChatParticipant => ({ id, kind: "npc", name, at: 1, ...more });
const input = (people: ChatParticipant[] = [], more: Partial<RosterInput> = {}): RosterInput => ({
  chatId: "c1", card: { id: "vera", name: "Vera", colors: [] }, persona: undefined, stored: people.length ? { people } : undefined, ...more,
});

describe("the palette", () => {
  test("a key always picks the same colour, and every pick is one of the fourteen", () => {
    expect(DIALOGUE_PALETTE).toHaveLength(14);
    const picks = new Set(["a", "b", "Atlas Guard", "c1|npc|Mira"].map(pickPaletteHex));
    for (const hex of picks) expect(DIALOGUE_PALETTE.map((p) => p.hex)).toContain(hex);
    expect(pickPaletteHex("Atlas Guard")).toBe(pickPaletteHex("Atlas Guard"));
    expect(new Set(Array.from({ length: 200 }, (_, i) => pickPaletteHex(`npc-${i}`))).size).toBeGreaterThan(10);
  });
});

describe("buildRoster", () => {
  test("with nothing stored: the card is the main and anchored, the player is You, nobody else, and the counters read the cast", () => {
    const r = buildRoster(input());
    expect(r.main).toMatchObject({ id: "card", kind: "card", name: "Vera", main: true, anchored: true, presence: "present", colors: [] });
    expect(r.player).toMatchObject({ id: "player", kind: "player", name: "You", presence: "present", shown: [] });
    expect([r.cards, r.npcs, r.retired]).toEqual([[], [], []]);
    expect(r.counts).toEqual({ registered: 2, npcs: 0, onStage: 2 });
  });

  test("the persona's name is the player's, and a stored name overrides either", () => {
    expect(buildRoster(input([], { persona: { name: "Boo" } })).player!.name).toBe("Boo");
    const r = buildRoster(input([{ id: "player", kind: "player", name: "Me", at: 1 }, { id: "card", kind: "card", name: "V.", at: 1 }], { persona: { name: "Boo" } }));
    expect([r.player!.name, r.main.name]).toEqual(["Me", "V."]);
  });

  test("colours: the participant's own, else the card's, else a stable hash; the player has none to show", () => {
    expect(buildRoster(input()).main.shown).toEqual([pickPaletteHex("c1|card|vera")]);
    expect(buildRoster(input([], { card: { id: "vera", name: "Vera", colors: ["#111111", "#222222"] } })).main.shown).toEqual(["#111111", "#222222"]);
    const r = buildRoster(input([npc("n1", "Atlas Guard"), npc("n2", "Mira", { colors: ["#abcdef"] })]));
    expect(r.npcs.map((n) => n.shown).sort()).toEqual([[pickPaletteHex("c1|npc|Atlas Guard")], ["#abcdef"]].sort());
    expect(r.npcs.map((n) => n.colors).sort()).toEqual([[], ["#abcdef"]].sort());
  });

  test("NPCs default to background, a stored presence wins, retired ones are listed apart and not counted", () => {
    const r = buildRoster(input([npc("n1", "Atlas Guard"), npc("n2", "Mira", { presence: "present" }), npc("n3", "Old", { retired: true, presence: "present" })]));
    expect(r.npcs.map((n) => [n.name, n.presence])).toEqual([["Atlas Guard", "background"], ["Mira", "present"]]);
    expect(r.retired.map((n) => n.name)).toEqual(["Old"]);
    expect(r.counts).toEqual({ registered: 4, npcs: 2, onStage: 3 });
  });

  test("Set Main moves the main slot: the card drops to Cards and loses its anchor, the promoted one is not anchored", () => {
    const people = [npc("n1", "Atlas Guard")];
    const r = buildRoster(input(people, { stored: { people, main: "n1" } }));
    expect(r.main).toMatchObject({ id: "n1", main: true, anchored: false });
    expect(r.cards.map((c) => [c.id, c.main, c.anchored])).toEqual([["card", false, false]]);
    expect(r.npcs).toEqual([]);
    expect(r.counts.registered).toBe(3);
    const p = buildRoster(input([], { stored: { people: [], main: "player" } }));
    expect(p.main.id).toBe("player");
    expect(p.player).toBeNull();
  });

  test("a main that is gone or retired falls back to the card", () => {
    const people = [npc("n1", "A", { retired: true })];
    expect(buildRoster(input(people, { stored: { people, main: "n1" } })).main.id).toBe("card");
    expect(buildRoster(input([], { stored: { people: [], main: "ghost" } })).main.id).toBe("card");
  });

  test("NPCs are listed newest first and then by name, as RoleCall reads the roster (most recent first, then A to Z)", () => {
    const r = buildRoster(input([npc("n1", "Zed", { at: 1 }), npc("n2", "Amy", { at: 1 }), npc("n3", "Bob", { at: 5 })]));
    expect(r.npcs.map((n) => n.name)).toEqual(["Bob", "Amy", "Zed"]);
  });
});

describe("speakersOf", () => {
  test("the card and the NPCs speak, the player never does, and a retired NPC is gone", () => {
    const s = speakersOf(buildRoster(input([npc("n1", "Atlas Guard"), npc("n2", "Old", { retired: true }), npc("n3", "Mira", { colors: ["#abcdef", "#123456"] })])));
    expect(s.map((x) => [x.id, x.name, x.color]).sort()).toEqual([["card", "Vera", pickPaletteHex("c1|card|vera")], ["n1", "Atlas Guard", pickPaletteHex("c1|npc|Atlas Guard")], ["n3", "Mira", "#abcdef"]].sort());
    expect(s[0]!.main).toBe(true);
  });
});
