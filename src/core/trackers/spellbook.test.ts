/** The Spellbook tracker's rules (RoleCall stores/immersion/spellbook.ts, SpellbookWingPanel.tsx handleCastSpell and buildCastInjection, immersion-context.ts:283-310, generate-tracker-item/route.ts). */
import { describe, expect, test } from "bun:test";
import { itemMessages, parseItem } from "./generate";
import { DEFAULT_RESOURCES, type Resources } from "./resources";
import { DEFAULT_SPELLBOOK, SPELLBOOK_GEN, afterReply, applySpellbook, castSpell, masteryLabel, parseDiceFormula, parseSpellbook, readSpellbook, spellbookLines, type Spell, type Spellbook } from "./spellbook";

let n = 0;
const stamp = (now = 100) => ({ now, id: () => `r${++n}` });
const made = (over: Partial<Spell> = {}) => ({ name: "Firebolt", template: "attack" as const, description: "A bolt of fire.", level: 3, status: "learned" as const, manaCost: 10, cooldown: "3 turns", damage: "3d8 fire", element: "fire", ...over });
const learned = (...over: Partial<Spell>[]): Spellbook => over.reduce((s, o, i) => applySpellbook(s, { kind: "add", spell: made(o), id: `s${i}` }), DEFAULT_SPELLBOOK);
const rand = (v: number) => () => v;
const cast = (s: Spellbook, r: Resources = DEFAULT_RESOURCES, over: Partial<Parameters<typeof castSpell>[3]> = {}) => castSpell(s, r, "s0", { intent: "", tactical: false, at: 500, rand: rand(0.99), stamp: stamp(500), ...over });

describe("add, refresh, edit, remove", () => {
  test("a spell is kept with an id; a full book refuses another", () => {
    expect(learned({}).spells).toEqual([{ ...made(), id: "s0" }]);
    const full = learned(...Array.from({ length: 300 }, (_, i) => ({ name: `S${i}` })));
    expect(applySpellbook(full, { kind: "add", spell: made(), id: "z" })).toBe(full);
  });
  test("a refreshed spell takes the new fields and keeps its id, cooldown, history, mastery and signature", () => {
    let s = applySpellbook(learned({}), { kind: "signature", id: "s0" });
    s = { ...s, spells: s.spells.map((x) => ({ ...x, masteryLevel: 40, cooldownRemaining: 2 })) };
    s = applySpellbook(s, { kind: "refresh", id: "s0", spell: made({ description: "Hotter.", level: 5 }) });
    expect(s.spells[0]).toMatchObject({ id: "s0", description: "Hotter.", level: 5, masteryLevel: 40, cooldownRemaining: 2, isSignature: true });
  });
  test("an edit sets the five fields RoleCall's form has; a blank box takes the field away instead of saving 0", () => {
    let s = applySpellbook(learned({}), { kind: "edit", id: "s0", patch: { name: "Fire Bolt", description: "Edited.", manaCost: 4, narrativeCost: "tears", castingRequirement: "in moonlight", emotionalAffinity: "rage" } });
    expect(s.spells[0]).toMatchObject({ name: "Fire Bolt", description: "Edited.", manaCost: 4, narrativeCost: "tears", castingRequirement: "in moonlight", emotionalAffinity: "rage" });
    s = applySpellbook(s, { kind: "edit", id: "s0", patch: { name: "Fire Bolt", description: "Edited.", manaCost: undefined, narrativeCost: "", castingRequirement: "", emotionalAffinity: "" } });
    expect(s.spells[0]).not.toHaveProperty("manaCost");
    expect(s.spells[0]).not.toHaveProperty("narrativeCost");
  });
  test("delete marks the spell and Undo restores it; a removed spell is not counted or sent", () => {
    let s = applySpellbook(learned({}, { name: "Ward" }), { kind: "remove", id: "s0", at: 9 });
    expect(spellbookLines(s)).toEqual(['**Spellbook**: 1 learned | Known: Ward (attack)']);
    s = applySpellbook(s, { kind: "restore", id: "s0" });
    expect(spellbookLines(s)[0]).toContain("2 learned");
  });
});

describe("signature spells", () => {
  test("at most two; choosing a third lets go of the oldest; clearing removes the star", () => {
    let s = learned({}, { name: "B" }, { name: "C" });
    for (const id of ["s0", "s1", "s2"]) s = applySpellbook(s, { kind: "signature", id });
    expect(s.spells.map((x) => x.isSignature === true)).toEqual([false, true, true]);
    s = applySpellbook(s, { kind: "unsignature", id: "s1" });
    expect(s.spells.map((x) => x.isSignature === true)).toEqual([false, false, true]);
  });
});

describe("cast", () => {
  test("a learned spell costs mana, starts its cooldown, gains mastery by its level, is written in its history and sets the narrator's injection", () => {
    const out = cast(learned({}));
    if (!out.ok) throw new Error(out.reason);
    expect(out.resources.mp).toBe(40);
    expect(out.resources.log[0]).toMatchObject({ type: "mp", previous: 50, value: 40, reason: "Cast Firebolt" });
    expect(out.spellbook.spells[0]).toMatchObject({ cooldownRemaining: 3, masteryLevel: 2 });
    expect(out.spellbook.spells[0]!.castHistory).toEqual([{ castAt: 500, context: "Cast during the current scene", manaSpent: 10 }]);
    expect(out.spellbook.pendingCast).toBe(out.injection);
    expect(out.message).toBe("Firebolt cast successfully! (3 turn cooldown)");
  });
  test("the injection is RoleCall's text, with the player's intent, the requirement and the resonance", () => {
    const out = cast(learned({ castingRequirement: "Must be outdoors", emotionalAffinity: "hope", narrativeCost: "ignored when there is a cost" }), DEFAULT_RESOURCES, { intent: "burn the door" });
    if (!out.ok) throw new Error(out.reason);
    expect(out.injection).toBe([
      '[SPELL CAST] The player invokes "Firebolt" (attack, Level 3).',
      "Description: A bolt of fire.",
      "Cost: 10 mp.",
      "Requirement: Must be outdoors.",
      `Player's intent: "burn the door"`,
      "Emotional resonance: hope.",
      "Narrate the casting and its effects naturally through storytelling.",
    ].join("\n"));
  });
  test("a spell with no cost names its narrative cost; tactical mode rolls the formula and says so", () => {
    const out = cast(learned({ manaCost: undefined, narrativeCost: "a cherished memory", diceFormula: "2d6+3" }), DEFAULT_RESOURCES, { tactical: true, rand: rand(0) });
    if (!out.ok) throw new Error(out.reason);
    expect(out.injection).toContain("Narrative cost: a cherished memory.");
    expect(out.injection).toContain("Dice roll: Rolled 5 (2d6+3: [1, 1] +3).");
    expect(out.injection).toContain("Narrate the casting with these mechanical results woven into the scene.");
    expect(out.message).toBe("Firebolt cast successfully! Rolled 5 (2d6+3: [1, 1] +3) (3 turn cooldown)");
  });
  test("the dice formula needs a count of 1 to 100 and sides of 2 to 1000, as RoleCall reads it", () => {
    expect(parseDiceFormula("d20")).toEqual({ count: 1, sides: 20, modifier: 0 });
    expect(parseDiceFormula("3d8-2")).toEqual({ count: 3, sides: 8, modifier: -2 });
    for (const bad of ["d1", "0d6", "101d6", "d1001", "fire"]) expect(parseDiceFormula(bad)).toBeNull();
  });
  test("a wild magic surge is added when the roll lands within the spell's susceptibility", () => {
    const hit = cast(learned({ wildMagicSusceptibility: 50 }), DEFAULT_RESOURCES, { rand: rand(0.1) });
    if (!hit.ok) throw new Error(hit.reason);
    expect(hit.injection).toContain("[WILD MAGIC SURGE] A random magical side effect occurs: The temperature drops noticeably for a moment. Narrate this side-effect alongside the spell's main effect.");
    const miss = cast(learned({ wildMagicSusceptibility: 50 }), DEFAULT_RESOURCES, { rand: rand(0.9) });
    if (!miss.ok) throw new Error(miss.reason);
    expect(miss.injection).not.toContain("WILD MAGIC");
  });
  test("a cost in hit points, action points or a custom need is paid from that; a need that does not exist does not gate the cast", () => {
    const hp = cast(learned({ manaCost: undefined, castingCost: { resource: "hp", amount: 20 } }));
    if (!hp.ok) throw new Error(hp.reason);
    expect(hp.resources.hp).toBe(80);
    const ap = cast(learned({ manaCost: undefined, castingCost: { resource: "ap", amount: 2 } }));
    if (!ap.ok) throw new Error(ap.reason);
    expect(ap.resources.ap).toBe(1);
    const rage = cast(learned({ manaCost: undefined, castingCost: { resource: "fury", amount: 30, label: "Fury" } }), { ...DEFAULT_RESOURCES, needs: { fury: { value: 50, maxValue: 100 } } });
    if (!rage.ok) throw new Error(rage.reason);
    expect(rage.resources.needs["fury"]!.value).toBe(20);
    expect(rage.injection).toContain("Cost: 30 Fury.");
    expect(cast(learned({ manaCost: undefined, castingCost: { resource: "ki", amount: 5 } })).ok).toBe(true);
  });
  test("not enough of the resource, a spell that is not learned and a spell on cooldown each refuse with a reason and change nothing", () => {
    expect(cast(learned({ manaCost: 80 }))).toEqual({ ok: false, reason: "Not enough mp (need 80)" });
    expect(cast(learned({ manaCost: undefined, castingCost: { resource: "hp", amount: 100 } }))).toEqual({ ok: false, reason: "Not enough hp (need 100)" });
    expect(cast(learned({ status: "observed" }))).toEqual({ ok: false, reason: "Spell is observed, not learned" });
    const cooling = { ...learned({}), spells: learned({}).spells.map((s) => ({ ...s, cooldownRemaining: 2 })) };
    expect(cast(cooling)).toEqual({ ok: false, reason: "On cooldown (2 turns remaining)" });
  });
});

describe("after a reply", () => {
  test("a cast that rode the reply is spent; cooldowns count down on the replies after it; nothing changes when there is nothing to do", () => {
    const out = cast(learned({}));
    if (!out.ok) throw new Error(out.reason);
    const first = afterReply(out.spellbook, true);
    expect(first.pendingCast).toBeUndefined();
    expect(first.spells[0]!.cooldownRemaining).toBe(3);
    const second = afterReply(first, false);
    expect(second.spells[0]!.cooldownRemaining).toBe(2);
    expect(afterReply(afterReply(afterReply(second, false), false), false).spells[0]!.cooldownRemaining).toBe(0);
    expect(afterReply(DEFAULT_SPELLBOOK, false)).toBe(DEFAULT_SPELLBOOK);
    expect(afterReply(learned({}), false)).toEqual(learned({}));
  });
});

describe("the prompt line (immersion-context.ts:283-310)", () => {
  test("counts what is learned, what is ready, what is cooling, the signature spells and the three best known", () => {
    expect(spellbookLines(DEFAULT_SPELLBOOK)).toEqual([]);
    let s = learned({ name: "A", level: 1 }, { name: "B", template: "heal" }, { name: "C", template: "utility" }, { name: "D", status: "observed" });
    s = { ...s, spells: s.spells.map((x, i) => ({ ...x, masteryLevel: [10, 90, 50, 0][i]!, ...(i === 0 ? { cooldownRemaining: 2 } : {}) })) };
    s = applySpellbook(s, { kind: "signature", id: "s1" });
    expect(spellbookLines(s)).toEqual(["**Spellbook**: 3 learned (2 ready) | On cooldown: A (2 turns) | Signature: B | Known: B (heal), C (utility), A (attack)"]);
  });
  test("when every learned spell is ready the count of ready ones is left out", () => {
    expect(spellbookLines(learned({ name: "A" }))).toEqual(["**Spellbook**: 1 learned | Known: A (attack)"]);
  });
});

describe("mastery words", () => {
  test("Novice under 26, Practiced from 26, Adept from 51, Master from 76", () => {
    expect([0, 25, 26, 50, 51, 75, 76, 100].map(masteryLabel)).toEqual(["Novice", "Novice", "Practiced", "Practiced", "Adept", "Adept", "Master", "Master"]);
  });
});

describe("what the store keeps", () => {
  test("a state is read back as written; anything else reads as an empty book", () => {
    const s = applySpellbook(learned({ castHistory: [{ castAt: 1, context: "x" }], castingCost: { resource: "mp", amount: 3 }, diceFormula: "d20", successThreshold: 12 }), { kind: "signature", id: "s0" });
    expect(parseSpellbook({ ...s, pendingCast: "inject" })).toEqual({ ...s, pendingCast: "inject" });
    expect(readSpellbook(undefined)).toEqual(DEFAULT_SPELLBOOK);
    expect(readSpellbook({ spells: 2 })).toEqual(DEFAULT_SPELLBOOK);
  });
  test("an unknown template and an unknown sub-feature are refused; the known ones are kept", () => {
    expect(parseSpellbook({ ...learned({}), spells: [{ ...learned({}).spells[0]!, template: "dance" }] })).toBeNull();
    expect(parseSpellbook({ ...DEFAULT_SPELLBOOK, subs: { rainbow: true } })).toBeNull();
    expect(parseSpellbook({ ...DEFAULT_SPELLBOOK, subs: { tacticalMode: true, wildMagic: true } })).not.toBeNull();
  });
});

describe("Generate and Refresh", () => {
  test("the generate prompt is RoleCall's; tactical mode adds the dice fields and Wild Magic adds its susceptibility", () => {
    const ask = { action: "generate" as const, itemName: "Firebolt", characterName: "Vera", personaName: "Mira", transcript: [] };
    const narrative = itemMessages(SPELLBOOK_GEN, { ...ask, subs: {} }).user;
    expect(narrative).toContain("You are generating a Spell or ability entry with narrative focus for a roleplay game.");
    expect(narrative).not.toContain("diceFormula");
    expect(itemMessages(SPELLBOOK_GEN, { ...ask, subs: { tacticalMode: true } }).user).toContain("You are generating a Spell or ability entry with full mechanical detail (tactical mode enabled) for a roleplay game.");
    expect(itemMessages(SPELLBOOK_GEN, { ...ask, subs: { tacticalMode: true } }).user).toContain('"diceFormula": string (optional, for tactical mode');
    expect(itemMessages(SPELLBOOK_GEN, { ...ask, subs: { wildMagic: true } }).user).toContain('"wildMagicSusceptibility": number');
  });
  test("an answer becomes a spell: the template and status are read, a level is kept within 1 to 10", () => {
    expect(parseItem(SPELLBOOK_GEN)('{"name":"Firebolt","template":"Attack","description":"d","level":"12","status":"Learned","manaCost":8,"castingCost":{"resource":"fury","amount":5},"cooldown":"3 turns"}')).toEqual({
      ok: true, value: { name: "Firebolt", template: "attack", description: "d", level: 10, status: "learned", manaCost: 8, castingCost: { resource: "fury", amount: 5 }, cooldown: "3 turns" },
    });
    expect(parseItem(SPELLBOOK_GEN)('{"template":"attack"}')).toMatchObject({ ok: false });
  });
});
