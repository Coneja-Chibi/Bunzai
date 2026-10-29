/**
 * The Spellbook panel as it mounts (RoleCall SpellbookWingPanel.tsx): the tabs, the cards, Cast (Invoke) paying out of the Stats tracker and leaving a note for the
 * next reply, Signature, Edit, Add Spell and Refresh as proposals, Delete with its Undo.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_RESOURCES } from "../../../../../../core/trackers/resources";
import { DEFAULT_SPELLBOOK, applySpellbook, type Spellbook, type SpellMade } from "../../../../../../core/trackers/spellbook";
import { panelRig } from "../items/panel-test-rig";
import { SpellbookPanel } from "./spellbook-panel";

const r = panelRig("spellbook");
const made = (over: Partial<SpellMade> = {}): SpellMade => ({ name: "Firebolt", template: "attack", description: "A bolt of fire.", level: 3, status: "learned", manaCost: 10, cooldown: "3 turns", damage: "3d8 fire", element: "fire", class: "Pyromancy", ...over });
const book = (...over: Partial<SpellMade>[]): Spellbook => over.reduce((b, o, i) => applySpellbook(b, { kind: "add", spell: made(o), id: `s${i}` }), DEFAULT_SPELLBOOK);
const panel = (initial?: Spellbook): JSX.Element => {
  if (initial) r.seed(initial);
  return <SpellbookPanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.spellbook" />;
};
const tab = (name: string): Element => r.qa(".st-tabs button").find((b) => b.textContent?.trim().startsWith(name))!;
const withStats = (): void => r.seed(DEFAULT_RESOURCES, "resources");

describe("what it shows", () => {
  test("the frame and the empty state", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Spellbook module");
    expect(r.text()).toContain("Tracks spells, mana costs, cooldowns, and cast history. Click spells to cast them with AI narration.");
    expect(r.text()).toContain("No spells known");
    expect(r.text()).toContain("Spells will be discovered as the story progresses");
  });
  test("a card shows the name, stars, class, rarity-free status and the start of the description; the tabs count by status; Observed shows where it was seen", async () => {
    const fs = await r.mount(panel(book({}, { name: "Ward", status: "observed", class: "Divine", level: 6, ...({ observedFrom: "Vera" } as object) })));
    expect(r.qa(".st-tabs button").map((b) => b.textContent?.trim())).toEqual(["All2", "Learned1", "Observed1", "Theoretical0"]);
    expect(r.qa(".it-title b").map((n) => n.textContent)).toEqual(["Ward", "Firebolt"]);
    expect(r.text()).toContain("★★★★★+1");
    await r.press(fs, tab("Observed"));
    expect(r.text()).toContain("Seen from Vera");
  });
  test("the type and class chips and the search narrow the list", async () => {
    const fs = await r.mount(panel(book({}, { name: "Mend", template: "heal", class: "Divine" })));
    await r.press(fs, r.by("heal"));
    expect(r.qa(".it-title b").map((n) => n.textContent)).toEqual(["Mend"]);
    await r.press(fs, r.qa(".it-filters")[0]!.querySelector("button")!);
    await r.type(fs, r.q('input[aria-label="Search spells"]'), "zzz");
    expect(r.text()).toContain("No results found");
  });
});

describe("the trackers' state is read once", () => {
  test("the Spellbook panel reads Stats beside its own book, and the scene's panels share one read of the state, not one each", async () => {
    withStats();
    await r.mount(panel(book({})));
    expect(r.state.reads).toBe(1);
  });
});

describe("Cast", () => {
  test("Invoke pays the mana out of Stats, starts the cooldown, adds mastery and history, and leaves a note for the next reply with a way to cancel it", async () => {
    withStats();
    const fs = await r.mount(panel(book({})));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Invoke"));
    await r.type(fs, r.q('input[aria-label="Your intent"]'), "burn the door");
    await r.press(fs, r.qa("button").filter((b) => b.textContent?.trim() === "Invoke")[0]!);
    const stats = r.state.writes.find((w) => w.module === "resources")!.patch.data as { mp: number };
    expect(stats.mp).toBe(40);
    // Stats and the Spellbook are one decision: one step of the store carried both, so neither can land alone.
    expect(r.state.calls[0]).toEqual(["spellbook", "resources"]);
    const sb = r.state.writes.find((w) => w.module === "spellbook")!.patch.data as unknown as Spellbook;
    expect(sb.spells[0]).toMatchObject({ cooldownRemaining: 3, masteryLevel: 2 });
    expect(sb.pendingCast).toContain(`Player's intent: "burn the door"`);
    expect(r.text()).toContain("Firebolt cast successfully! (3 turn cooldown)");
    expect(r.text()).toContain("A cast is waiting");
    await r.press(fs, r.by("Cancel cast"));
    expect(r.lastData<Spellbook>().pendingCast).toBeUndefined();
  });
  test("too little mana refuses with the reason and writes nothing; a spell cooling down cannot be invoked and can be made ready", async () => {
    withStats();
    const fs = await r.mount(panel(book({ manaCost: 80 })));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Invoke"));
    await r.press(fs, r.qa("button").filter((b) => b.textContent?.trim() === "Invoke")[0]!);
    expect(r.text()).toContain("Not enough mp (need 80)");
    const cool = book({});
    const fs2 = await r.mount(panel({ ...cool, spells: cool.spells.map((s) => ({ ...s, cooldownRemaining: 2 })) }));
    await r.press(fs2, r.q(".it-head"));
    expect((r.by("Invoke") as HTMLButtonElement).disabled).toBe(true);
    await r.press(fs2, r.by("Make this spell ready now"));
    expect(r.lastData<Spellbook>().spells[0]).not.toHaveProperty("cooldownRemaining");
  });
  test("Tactical Mode calls it Cast and shows the roll", async () => {
    const fs = await r.mount(panel({ ...book({ diceFormula: "d20" }), subs: { tacticalMode: true } }));
    await r.press(fs, r.q(".it-head"));
    expect(r.by("Cast")).toBeDefined();
    expect(r.text()).toContain("Roll: d20");
  });
});

describe("the card's other buttons", () => {
  test("Set Signature stars a spell and Edit saves the five fields, a blank Mana Cost clearing it", async () => {
    const fs = await r.mount(panel(book({})));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Set Signature"));
    expect(r.lastData<Spellbook>().spells[0]!.isSignature).toBe(true);
    await r.press(fs, r.by("Edit"));
    await r.type(fs, r.q('.it-fields input[type="number"]'), "");
    await r.type(fs, r.qa(".it-fields input")[0]!, "Fire Bolt");
    await r.press(fs, r.by("Save"));
    const s = r.lastData<Spellbook>().spells[0]!;
    expect(s.name).toBe("Fire Bolt");
    expect(s).not.toHaveProperty("manaCost");
  });
  test("Delete marks the spell and Undo restores it", async () => {
    const fs = await r.mount(panel(book({})));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Delete spell"));
    expect(r.lastData<Spellbook>().spells[0]!.removedAt).toBeGreaterThan(0);
    await r.press(fs, r.by("Undo"));
    expect(r.qa(".it-title b").map((n) => n.textContent)).toEqual(["Firebolt"]);
  });
});

describe("Add Spell and Refresh: the model proposes, the person accepts", () => {
  test("Generate asks with the name and guide and Accept keeps it", async () => {
    r.state.answers.push(made({ name: "Frost Nova" }));
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Add Spell"));
    await r.type(fs, r.q('input[aria-label="Spell name"]'), "Frost Nova");
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "a cold spell");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "spellbook", action: "generate", itemName: "Frost Nova", userGuide: "a cold spell" }]);
    expect(r.state.writes).toHaveLength(0);
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Spellbook>().spells[0]).toMatchObject({ name: "Frost Nova" });
  });
  test("Refresh keeps the id, cooldown and mastery", async () => {
    r.state.answers.push(made({ description: "Hotter." }));
    const cool = book({});
    const fs = await r.mount(panel({ ...cool, spells: cool.spells.map((s) => ({ ...s, masteryLevel: 30 })) }));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Refresh with AI"));
    await r.press(fs, r.by("Generate"));
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Spellbook>().spells[0]).toMatchObject({ id: "s0", description: "Hotter.", masteryLevel: 30 });
  });
});

describe("a full tracker", () => {
  test("500 items mount fewer than 60 cards", async () => {
    await r.mount(panel(book(...Array.from({ length: 500 }, (_, i) => ({ name: `Spell ${String(i)}` })))));
    const cards = r.qa(".it-card").length;
    expect(cards).toBeGreaterThan(0);
    expect(cards).toBeLessThan(60);
  });
});
