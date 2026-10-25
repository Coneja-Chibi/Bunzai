/**
 * Between the planner and the narrator: momentum fills in what the planner left out, and the player's inner life is never directed.
 */
import { describe, expect, test } from "bun:test";
import type { NarratorDirective } from "../../stage/contracts/director-types";
import { enrichFromMomentum, sanitizeForPlayerCharacter } from "./directive";
import { arcOf, seedOf, stateOf } from "./fixtures";
import { computeMomentum } from "./momentum";

const base: NarratorDirective = { mood: "tense", pacing: "slow" };
const report = () => computeMomentum(stateOf({ arcs: [arcOf({ lastProgressTurn: 0 })], seeds: [seedOf({ plantedAtTurn: 0, reinforcements: [{ turn: 1, description: "a" }, { turn: 2, description: "b" }] })] }), 40);

describe("enrichFromMomentum", () => {
  test("an overdue arc and a ripe seed the planner left out are added as a forceful arc direction and a callback", () => {
    const out = enrichFromMomentum(base, report());
    expect(out.arcDirections).toMatchObject([{ arcName: "The Locked Room", urgency: "forceful" }]);
    expect(out.arcDirections![0]!.instruction).toContain("OVERDUE");
    expect(out.callbacks).toMatchObject([{ reference: "A cracked bell" }]);
    expect(out.callbacks![0]!.instruction).toContain("RIPE SEED");
  });

  test("what the planner already wrote for them is left alone, even under a looser name", () => {
    const planned: NarratorDirective = { ...base, arcDirections: [{ arcName: "the locked room (again)", instruction: "mine", urgency: "subtle" }], callbacks: [{ reference: "a cracked bell on the pier", instruction: "mine" }] };
    const out = enrichFromMomentum(planned, report());
    expect(out.arcDirections).toEqual(planned.arcDirections!);
    expect(out.callbacks).toEqual(planned.callbacks!);
  });

  test("with no pressure, or no report, the directive is the very same object", () => {
    expect(enrichFromMomentum(base, undefined)).toBe(base);
    expect(enrichFromMomentum(base, computeMomentum(stateOf({ seeds: [seedOf({ plantedAtTurn: 1 })] }), 2))).toBe(base);
  });
});

describe("sanitizeForPlayerCharacter", () => {
  const d: NarratorDirective = {
    mood: "m", pacing: "slow",
    include: { characters: ["Merlin", "Zorya"], themes: ["debt"] },
    characterBeats: [{ character: "Merlin", beat: "Looks tired" }, { character: "Zorya", beat: "Fidgets" }, { character: "Valen", beat: "Merlin realizes the lie" }, { character: "Valen", beat: "Hides the note", motivation: "Show Merlin's methodical thinking" }],
    dialogueGuidance: [{ character: "merlin", tone: "dry" }, { character: "Zorya", tone: "warm" }],
    arcDirections: [{ arcName: "A", instruction: "Have Merlin notice the missing scroll", urgency: "subtle" }, { arcName: "B", instruction: "Have Merlin find Valen's note on the table", urgency: "subtle" }, { arcName: "C", instruction: "Let the weight of it sit in Merlin's mind", urgency: "subtle" }],
    callbacks: [{ reference: "r1", instruction: "Merlin remembers the bell" }, { reference: "r2", instruction: "An NPC mentions the bell to Merlin" }],
  };

  test("the player gets no beat, no line and no place in include.characters; entries that claim their thoughts, senses, memories or decisions are cut", () => {
    const out = sanitizeForPlayerCharacter(d, "Merlin");
    expect(out.include).toEqual({ characters: ["Zorya"], themes: ["debt"] });
    expect(out.characterBeats).toEqual([{ character: "Zorya", beat: "Fidgets" }]);
    expect(out.dialogueGuidance).toEqual([{ character: "Zorya", tone: "warm" }]);
    expect(out.arcDirections!.map((a) => a.arcName)).toEqual(["B"]);
    expect(out.callbacks!.map((c) => c.reference)).toEqual(["r2"]);
  });

  test("staging is kept: finding, placing, entering and an NPC's action toward the player", () => {
    const staged: NarratorDirective = { mood: "m", pacing: "slow", arcDirections: [{ arcName: "A", instruction: "Place Merlin at the third shelf; Merlin enters the archive and the candles flicker", urgency: "subtle" }] };
    expect(sanitizeForPlayerCharacter(staged, "Merlin")).toEqual(staged);
  });

  test("the include list loses its key when the player was the only name; with no player name nothing changes", () => {
    expect(sanitizeForPlayerCharacter({ mood: "m", pacing: "slow", include: { characters: ["Merlin"] } }, "Merlin").include).toEqual({});
    expect(sanitizeForPlayerCharacter(d, undefined)).toBe(d);
    expect(sanitizeForPlayerCharacter(d, "  ")).toBe(d);
  });

  test("a name with regular-expression characters cannot break the match or match everything", () => {
    const out = sanitizeForPlayerCharacter({ mood: "m", pacing: "slow", callbacks: [{ reference: "r", instruction: "Have X.Y(1) feel it" }, { reference: "s", instruction: "Have XaY feel it" }] }, "X.Y(1)");
    expect(out.callbacks!.map((c) => c.reference)).toEqual(["s"]);
  });
});
