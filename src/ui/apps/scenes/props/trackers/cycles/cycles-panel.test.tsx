/**
 * The Cycles panel as it mounts (RoleCall BiologicalCyclesWingPanel.tsx): the All tab and a tab for each kind that exists, the cards and what opens under them (the
 * pregnancy card, the menstrual card, the fertility window), Add Biological Cycle and Refresh as proposals the person accepts, and Delete with its Undo.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_CYCLES, applyCycles, type Cyc, type Cycles } from "../../../../../../core/trackers/cycles";
import { panelRig } from "../items/panel-test-rig";
import { CyclesPanel } from "./cycles-panel";

const r = panelRig("cycles");
const made = (over: Partial<Cyc> = {}): Cyc => ({ characterName: "Vera", cycleType: "heat", currentPhase: "Peak", phaseProgress: 40, intensity: 70, effects: ["restless"], symptoms: ["flushed"], description: "A hot spell.", ...over });
const tracked = (...over: Partial<Cyc>[]): Cycles => over.reduce((c, o, i) => applyCycles(c, { kind: "add", cycle: made(o), id: `c${i}`, at: 10 + i }), DEFAULT_CYCLES);
const panel = (initial?: Cycles): JSX.Element => {
  if (initial) r.seed(initial);
  return <CyclesPanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.cycles" />;
};
const tab = (name: string): Element => r.qa(".st-tabs button").find((b) => b.textContent?.trim().startsWith(name))!;
const names = (): (string | null)[] => r.qa(".it-title b").map((n) => n.textContent);

describe("what it shows", () => {
  test("the frame and the empty state", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Cycles module");
    expect(r.q("h2").textContent).toBe("Biological Cycles");
    expect(r.text()).toContain("Tracks biological rhythms and cycles. The AI adjusts character behavior based on current phases.");
    expect(r.text()).toContain("No cycles tracked");
    expect(r.text()).toContain("Cycles will be added as the story progresses");
  });
  test("a card shows the character, kind, phase and the two bars; tabs exist only for kinds that are tracked", async () => {
    const fs = await r.mount(panel(tracked({}, { characterName: "Tam", cycleType: "lunar", currentPhase: "Waxing" })));
    expect(r.qa(".st-tabs button").map((b) => b.textContent?.trim())).toEqual(["All2", "Heat1", "Lunar1"]);
    expect(r.text()).toContain("Phase:");
    expect(r.text()).toContain("Progress");
    expect(r.text()).toContain("Intensity");
    await r.press(fs, tab("Lunar"));
    expect(names()).toEqual(["Tam"]);
  });
  test("an open card shows the effects, symptoms and description; a pregnant entry shows its week, trimester and days remaining; a lunar one RoleCall's words for a moon it cannot find", async () => {
    const fs = await r.mount(panel(tracked({ cycleType: "pregnancy", pregnancyData: { isPregnant: true, weekNumber: 20, trimester: 2, daysPregnant: 140, babySizeComparison: "a banana", babyDevelopment: "Halfway point", symptoms: ["tired"] } }, { characterName: "Tam", cycleType: "lunar", linkedMoonName: "Luna", transformationType: "Wolf" })));
    await r.press(fs, r.qa(".it-head")[1]!);
    for (const s of ["restless", "flushed", "A hot spell.", "Week 20", "Baby is the size of a banana", "140 days remaining", "Second Trimester", "Halfway point", "tired"]) expect(r.text()).toContain(s);
    await r.press(fs, r.qa(".it-head")[0]!);
    expect(r.text()).toContain("Link to calendar moon phases to track transformations");
    expect(r.text()).toContain("Transformation:");
  });
  test("a cycle that is not a pregnancy shows its phase, the cycle day and the days until the period", async () => {
    const fs = await r.mount(panel(tracked({ cycleType: "period", pregnancyData: { isPregnant: false, cyclePhase: "luteal", cycleDay: 20, cycleLength: 28, daysUntilPeriod: 8, energyLevel: 40 }, fertilityWindow: { start: 10, peak: 14, end: 16 }, conceptionChance: 22 })));
    await r.press(fs, r.q(".it-head"));
    for (const s of ["Luteal", "low fertility", "Cycle Day 20 of 28", "8 days until period", "22% chance", "Fertility Window"]) expect(r.text()).toContain(s);
  });
});

describe("Add Biological Cycle: the model proposes, the person accepts", () => {
  test("Generate asks with the character and guide and Accept keeps it", async () => {
    r.state.answers.push(made());
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Add Biological Cycle"));
    await r.type(fs, r.q('input[aria-label="Character name"]'), "Vera");
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "entering heat cycle");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "cycles", action: "generate", itemName: "Vera", userGuide: "entering heat cycle" }]);
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Cycles>().cycles[0]).toMatchObject({ characterName: "Vera", cycleType: "heat" });
    expect(r.lastData<Cycles>().cycles[0]!.startedAt).toBeGreaterThan(0);
  });
});

describe("an opened cycle", () => {
  test("Refresh keeps the id; Delete marks the cycle and Undo restores it", async () => {
    r.state.answers.push(made({ currentPhase: "Waning" }));
    const fs = await r.mount(panel(tracked({})));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Refresh with AI"));
    await r.press(fs, r.by("Generate"));
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Cycles>().cycles[0]).toMatchObject({ id: "c0", currentPhase: "Waning" });
    await r.press(fs, r.by("Delete cycle"));
    expect(r.lastData<Cycles>().cycles[0]!.removedAt).toBeGreaterThan(0);
    await r.press(fs, r.by("Undo"));
    expect(names()).toEqual(["Vera"]);
  });
});
