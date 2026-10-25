/**
 * The Creature Codex panel as it mounts (RoleCall CreatureCodexWingPanel.tsx): the tabs, species and creature cards and what opens under them, Add Species and Log Creature
 * as proposals the person accepts (a creature must name a species that exists), Refresh, and Delete with its Undo, a species taking its creatures along.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_CODEX, applyCodex, type Codex, type CreatureMade, type SpeciesMade } from "../../../../../../core/trackers/codex";
import { panelRig } from "../items/panel-test-rig";
import { CodexPanel } from "./codex-panel";

const r = panelRig("codex");
const sp = (over: Partial<SpeciesMade> = {}): SpeciesMade => ({ name: "Gloomwing Moth", classification: "Beast", rarity: "rare", disposition: "cautious", habitat: "Caves", description: "A pale moth.", appearance: "Grey wings.", baseTraits: ["nocturnal"], baseBehaviors: ["flutters"], taxonomy: { order: "Beast", family: "Moth", kindRevealed: false, kindHint: "dusty wings" }, abilities: [{ name: "Dust", type: "attack", description: "Blinds.", effects: ["blind"], usageNotes: "Close range." }], ...over });
const cr = (over: Partial<CreatureMade> = {}): CreatureMade => ({ speciesName: "Gloomwing Moth", nickname: "Dusty", location: "Cave mouth", condition: "healthy", mood: "curious", status: "alive", bond: 60, trust: 40, encounters: [{ date: "Day 2", description: "Followed me.", outcome: "peaceful" }], ...over });
const seeded = (): Codex => applyCodex(applyCodex(DEFAULT_CODEX, { kind: "addSpecies", species: sp(), id: "s1" }), { kind: "addCreature", creature: cr(), id: "c1" });
const panel = (initial?: Codex): JSX.Element => {
  if (initial) r.seed(initial);
  return <CodexPanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.codex" />;
};
const tab = (name: string): Element => r.qa(".st-tabs button").find((b) => b.textContent?.trim().startsWith(name))!;
const titles = (): (string | null)[] => r.qa(".it-titlerow b").map((n) => n.textContent);

describe("what it shows", () => {
  test("the frame and the empty state", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Creature Codex module");
    expect(r.text()).toContain("Bestiary entries, creature stats, ecology, and weaknesses.");
    expect(r.text()).toContain("No creatures recorded");
  });
  test("a species card shows the taxonomy, the unknown kind with its hint, rarity and disposition; the tabs count and narrow", async () => {
    const fs = await r.mount(panel(seeded()));
    expect(titles()).toEqual(["Gloomwing Moth", "Dusty"]);
    expect(r.text()).toContain("Unknown: dusty wings");
    expect(r.qa(".it-tag").map((t) => t.textContent)).toContain("cautious");
    expect(r.qa(".st-tabs button").map((b) => b.textContent?.trim())).toEqual(["All2", "Species1", "Creatures1"]);
    await r.press(fs, tab("Creatures"));
    expect(titles()).toEqual(["Dusty"]);
    expect(r.by("Add Species")).toBeUndefined();
  });
  test("an open species shows its abilities and the creatures known; an open creature its species, bond and trust bars and its encounters", async () => {
    const fs = await r.mount(panel(seeded()));
    await r.press(fs, r.qa(".it-head")[0]!);
    for (const s of ["Abilities", "Dust", "Blinds.", "Close range.", "Known Creatures (1)", "Dusty"]) expect(r.text()).toContain(s);
    await r.press(fs, r.qa(".it-head")[1]!);
    expect(r.qa(".cx-bt .bd-bar")).toHaveLength(2);
    for (const s of ["Encounters (1)", "Day 2", "Followed me."]) expect(r.text()).toContain(s);
  });
});

describe("Add Species and Log Creature: the model proposes, the person accepts", () => {
  test("a species is asked for with the name and guide and kept only on Accept", async () => {
    r.state.answers.push(sp({ name: "Frost Slime" }));
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Add Species"));
    await r.type(fs, r.q('input[aria-label="Species name"]'), "Frost Slime");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "codex", action: "generate", itemName: "Frost Slime" }]);
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Codex>().species[0]).toMatchObject({ name: "Frost Slime" });
  });
  test("a creature is asked for as the creature kind and attaches to the species it names", async () => {
    r.state.answers.push(cr({ nickname: "Wisp" }));
    const fs = await r.mount(panel(applyCodex(DEFAULT_CODEX, { kind: "addSpecies", species: sp(), id: "s1" })));
    await r.press(fs, r.by("Log Creature"));
    await r.type(fs, r.q('input[aria-label="Creature nickname"]'), "Wisp");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked[0]).toMatchObject({ module: "codex", variant: "creature", action: "generate", itemName: "Wisp" });
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Codex>().creatures[0]).toMatchObject({ nickname: "Wisp", speciesId: "s1" });
  });
  test("a creature naming no species says so and keeps nothing", async () => {
    r.state.answers.push(cr({ speciesName: "Mystery" }));
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Log Creature"));
    await r.type(fs, r.q('input[aria-label="Creature nickname"]'), "Wisp");
    await r.press(fs, r.by("Generate"));
    expect(r.text()).toContain("No species is called Mystery. Add that species first.");
    await r.press(fs, r.by("Accept"));
    expect(r.state.writes).toHaveLength(0);
    expect(r.text()).toContain("so the creature was not added");
  });
});

describe("Refresh and Delete", () => {
  test("Refresh keeps the species link; deleting a species takes its creatures, and Undo brings both back", async () => {
    r.state.answers.push(cr({ mood: "calm" }));
    const fs = await r.mount(panel(seeded()));
    await r.press(fs, r.qa(".it-head")[1]!);
    await r.press(fs, r.by("Refresh with AI"));
    await r.press(fs, r.by("Generate"));
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Codex>().creatures[0]).toMatchObject({ id: "c1", speciesId: "s1", mood: "calm" });
    await r.press(fs, r.qa(".it-head")[0]!);
    await r.press(fs, r.by("Delete species"));
    expect(r.lastData<Codex>().species[0]!.removedAt).toBeGreaterThan(0);
    expect(r.lastData<Codex>().creatures[0]!.removedAt).toBeGreaterThan(0);
    expect(r.text()).toContain("No creatures recorded");
    await r.press(fs, r.by("Undo"));
    expect(titles()).toEqual(["Gloomwing Moth", "Dusty"]);
  });
});
