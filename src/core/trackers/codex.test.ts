/** The Creature Codex tracker's rules (RoleCall stores/immersion/creature-codex.ts, immersion-context.ts:456-510, generate-tracker-item/route.ts). */
import { describe, expect, test } from "bun:test";
import { itemMessages, parseItem } from "./generate";
import { CREATURE_GEN, DEFAULT_CODEX, SPECIES_GEN, applyCodex, codexLines, creaturesOf, liveCreatures, liveSpecies, parseCodex, readCodex, type Codex, type CreatureMade, type SpeciesMade } from "./codex";

const sp = (over: Partial<SpeciesMade> = {}): SpeciesMade => ({ name: "Gloomwing Moth", classification: "Beast", rarity: "rare", disposition: "cautious", habitat: "Caves", description: "A pale moth.", appearance: "Grey wings.", baseTraits: ["nocturnal"], baseBehaviors: ["flutters"], ...over });
const cr = (over: Partial<CreatureMade> = {}): CreatureMade => ({ speciesName: "Gloomwing Moth", nickname: "Dusty", location: "Cave mouth", condition: "healthy", mood: "curious", status: "alive", encounters: [], ...over });
const seeded = (): Codex => applyCodex(applyCodex(DEFAULT_CODEX, { kind: "addSpecies", species: sp(), id: "s1" }), { kind: "addCreature", creature: cr(), id: "c1" });

describe("species and creatures", () => {
  test("a species is kept with an id; a full list refuses another", () => {
    expect(applyCodex(DEFAULT_CODEX, { kind: "addSpecies", species: sp(), id: "s1" }).species).toEqual([{ ...sp(), id: "s1" }]);
    let full = DEFAULT_CODEX;
    for (let i = 0; i < 200; i++) full = applyCodex(full, { kind: "addSpecies", species: sp({ name: `S${i}` }), id: `s${i}` });
    expect(applyCodex(full, { kind: "addSpecies", species: sp(), id: "z" })).toBe(full);
  });
  test("a creature is attached to the species it names (case aside); one naming no species is not kept, and the state is the same one", () => {
    const c = seeded();
    expect(c.creatures[0]).toMatchObject({ id: "c1", speciesId: "s1", nickname: "Dusty" });
    expect(c.creatures[0]).not.toHaveProperty("speciesName");
    expect(applyCodex(c, { kind: "addCreature", creature: cr({ speciesName: "gloomwing moth", nickname: "Wisp" }), id: "c2" }).creatures).toHaveLength(2);
    expect(applyCodex(c, { kind: "addCreature", creature: cr({ speciesName: "Unknown Beast" }), id: "c3" })).toBe(c);
  });
  test("a refreshed species or creature takes the new fields and keeps its id and its species", () => {
    let c = applyCodex(seeded(), { kind: "refreshSpecies", id: "s1", species: sp({ description: "Paler." }) });
    c = applyCodex(c, { kind: "refreshCreature", id: "c1", creature: cr({ mood: "calm", speciesName: "Somewhere Else" }) });
    expect(c.species[0]).toMatchObject({ id: "s1", description: "Paler." });
    expect(c.creatures[0]).toMatchObject({ id: "c1", speciesId: "s1", mood: "calm" });
  });
});

describe("delete and Undo", () => {
  test("deleting a species takes its creatures with it in one mark, and restoring it brings the same creatures back", () => {
    let c = applyCodex(seeded(), { kind: "addCreature", creature: cr({ nickname: "Gone first" }), id: "c2" });
    c = applyCodex(c, { kind: "removeCreature", id: "c2", at: 5 });
    c = applyCodex(c, { kind: "removeSpecies", id: "s1", at: 9 });
    expect([liveSpecies(c).length, liveCreatures(c).length]).toEqual([0, 0]);
    c = applyCodex(c, { kind: "restoreSpecies", id: "s1" });
    expect(liveSpecies(c)).toHaveLength(1);
    expect(liveCreatures(c).map((x) => x.id)).toEqual(["c1"]);
  });
  test("a creature restores only while its species is there", () => {
    let c = applyCodex(seeded(), { kind: "removeCreature", id: "c1", at: 5 });
    expect(applyCodex(c, { kind: "restoreCreature", id: "c1" }).creatures[0]!.removedAt).toBeUndefined();
    c = applyCodex(applyCodex(seeded(), { kind: "removeCreature", id: "c1", at: 5 }), { kind: "removeSpecies", id: "s1", at: 9 });
    expect(applyCodex(c, { kind: "restoreCreature", id: "c1" })).toBe(c);
    expect(creaturesOf(seeded(), "s1")).toHaveLength(1);
  });
});

describe("the prompt block (immersion-context.ts:456-510)", () => {
  test("lists up to five species with their creatures and what the sub-features hold; nothing without a species", () => {
    expect(codexLines(DEFAULT_CODEX)).toEqual([]);
    expect(codexLines(seeded())).toEqual(["**Creature Codex**: 1 species known | 1 individuals encountered\n- Gloomwing Moth (rare, Beast, cautious) \u2014 habitat: Caves\n    Encounters: 1 \u2014 Dusty (alive, healthy, curious)"]);
    const rich = applyCodex(DEFAULT_CODEX, { kind: "addSpecies", id: "s1", species: sp({ combatProfile: { threatLevel: 6, abilities: ["Dust"], weaknesses: ["Light"] }, taming: { tameable: true, method: "honey", mountable: true }, research: { knowledgeLevel: "studied", fieldNotes: ["a", "b"] } }) });
    const text = codexLines(rich)[0]!;
    expect(text).toContain("    Combat: threat 6/10, abilities: Dust, weak to: Light");
    expect(text).toContain("    Taming: tameable via honey, mountable");
    expect(text).toContain("    Research: studied (2 notes)");
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; a creature of no species and an unknown sub-feature are refused", () => {
    const c = seeded();
    expect(parseCodex(c)).toEqual(c);
    expect(readCodex(undefined)).toEqual(DEFAULT_CODEX);
    expect(readCodex({ species: 1 })).toEqual(DEFAULT_CODEX);
    expect(parseCodex({ ...c, creatures: [{ ...c.creatures[0]!, speciesId: "nope" }] })).toBeNull();
    expect(parseCodex({ ...DEFAULT_CODEX, subs: { shiny: true } })).toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("the species prompt asks for the sub-features that are on", () => {
    const ask = { action: "generate" as const, itemName: "Moth", characterName: "Vera", personaName: "Mira", transcript: [] };
    const plain = itemMessages(SPECIES_GEN, { ...ask, subs: {} }).user;
    expect(plain).toContain("You are generating a Creature SPECIES entry \u2014 the GENERAL template");
    expect(plain).not.toContain("combatProfile");
    const on = itemMessages(SPECIES_GEN, { ...ask, subs: { combat: true, creatureStats: true } }).user;
    expect(on).toContain("REQUIRED: Include a full combatProfile");
    expect(on).toContain('"combatProfile": { "threatLevel": number (1-10)');
    expect(on).toContain('"damage": string (e.g. "2d6 poison")');
  });
  test("the creature prompt names the species it must match", () => {
    expect(itemMessages(CREATURE_GEN, { action: "generate", itemName: "Dusty", characterName: "Vera", personaName: "Mira", transcript: [], subs: {} }).user).toContain('"speciesName": string (must match an existing species)');
  });
  test("a species answer is cleaned and a creature answer must name its species", () => {
    expect(parseItem(SPECIES_GEN)('{"name":"Moth","rarity":"Rare","disposition":"Docile","taxonomy":{"order":"Beast","family":"Moth","kind":null},"abilities":[{"name":"Dust","type":"attack"}],"baseTraits":["a"]}')).toMatchObject({ ok: true, value: { name: "Moth", rarity: "rare", disposition: "docile", classification: "Beast", habitat: "Unknown", taxonomy: { order: "Beast", family: "Moth" }, abilities: [{ name: "Dust", type: "attack", effects: [] }] } });
    expect(parseItem(CREATURE_GEN)('{"nickname":"Dusty"}')).toMatchObject({ ok: false });
    expect(parseItem(CREATURE_GEN)('{"speciesName":"Moth","nickname":"Dusty","status":"Tamed","bond":"80"}')).toMatchObject({ ok: true, value: { speciesName: "Moth", status: "tamed", bond: 80, location: "Unknown", encounters: [] } });
  });
});
