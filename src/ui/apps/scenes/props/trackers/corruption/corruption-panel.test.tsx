/**
 * The Corruption panel as it mounts (RoleCall CorruptionWingPanel.tsx): the overall state, the player's metrics with -5 and +5, the NPC cards with Add NPC and
 * Refresh as proposals the person accepts, the Effects and History tabs, and Delete with its Undo.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_CORRUPTION, applyCorruption, type Corruption } from "../../../../../../core/trackers/corruption";
import { panelRig } from "../items/panel-test-rig";
import { CorruptionPanel } from "./corruption-panel";

const r = panelRig("corruption");
const npc = (over: Record<string, unknown> = {}) => ({ npcName: "Sera", corruption: 10, submission: 20, dependence: 0, obsession: 0, identityLoss: 0, cause: "The amulet", effects: ["pale"], description: "Fading.", ...over });
const panel = (initial?: Corruption): JSX.Element => {
  if (initial) r.seed(initial);
  return <CorruptionPanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.corruption" />;
};
const tab = (name: string): Element => r.qa(".st-tabs button").find((b) => b.textContent?.trim() === name)!;

describe("the player's metrics", () => {
  test("the frame, the overall state and the five metrics", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Corruption module");
    expect(r.text()).toContain("Overall State");
    expect(r.q(".cr-state b").textContent).toBe("PURE");
    expect(r.qa(".cr-metric .cr-head").map((h) => h.textContent?.replace(/-5\+5\d+$/, ""))).toEqual(["Corruption", "Submission", "Dependence", "Obsession", "Identity Loss"]);
  });
  test("+5 and -5 move a metric within 0 to 100 and the state follows: level, dominant metric, effects and the badge", async () => {
    const fs = await r.mount(panel());
    for (let i = 0; i < 6; i++) await r.press(fs, r.by("Raise Obsession by 5"));
    expect(r.lastData<Corruption>().values.obsession).toBe(30);
    expect(r.text()).toContain("Dominated by");
    expect(r.text()).toContain("Minor Obsession influence");
    await r.press(fs, r.by("Lower Obsession by 5"));
    expect(r.lastData<Corruption>().values.obsession).toBe(25);
    await r.press(fs, r.by("Lower Corruption by 5"));
    expect(r.lastData<Corruption>().values.corruption).toBe(0);
  });
  test("the Effects tab lists what the values bring, and the History tab the changes newest first", async () => {
    const fs = await r.mount(panel({ ...DEFAULT_CORRUPTION, values: { ...DEFAULT_CORRUPTION.values, corruption: 60 } }));
    await r.press(fs, tab("Effects"));
    expect(r.text()).toContain("Moderate Corruption compulsion");
    await r.press(fs, tab("History"));
    expect(r.text()).toContain("No history yet");
    await r.press(fs, tab("Player"));
    await r.press(fs, r.by("Raise Corruption by 5"));
    await r.press(fs, tab("History"));
    expect(r.text()).toContain("corruption increased");
  });
});

describe("NPCs: the model proposes, the person accepts", () => {
  test("Add NPC asks with the name and guide and Accept keeps it", async () => {
    r.state.answers.push(npc());
    const fs = await r.mount(panel());
    await r.press(fs, tab("NPCs"));
    expect(r.text()).toContain("No NPC corruption tracked");
    await r.press(fs, r.by("Add NPC"));
    expect(r.text()).toContain("NPC Name");
    await r.type(fs, r.q('input[aria-label="Enter NPC name"]'), "Sera");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "corruption", action: "generate", itemName: "Sera" }]);
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Corruption>().npcs[0]).toMatchObject({ npcName: "Sera", corruption: 10, cause: "The amulet" });
    expect(r.text()).toContain("Cause: The amulet");
    expect(r.text()).toContain("Fading.");
  });
  test("an NPC's metric moves by 5; Delete marks the NPC and Undo brings it back", async () => {
    const fs = await r.mount(panel(applyCorruption(DEFAULT_CORRUPTION, { kind: "npcAdd", npc: npc() as never, id: "n1" })));
    await r.press(fs, tab("NPCs"));
    await r.press(fs, r.by("Raise Sera Corruption by 5"));
    expect(r.lastData<Corruption>().npcs[0]!.corruption).toBe(15);
    await r.press(fs, r.by("Delete"));
    expect(r.lastData<Corruption>().npcs[0]!.removedAt).toBeGreaterThan(0);
    expect(r.text()).toContain("No NPC corruption tracked");
    await r.press(fs, r.by("Undo"));
    expect(r.text()).toContain("Sera");
  });
  test("Refresh asks with the NPC and Accept replaces its fields", async () => {
    r.state.answers.push(npc({ cause: "The crown" }));
    const fs = await r.mount(panel(applyCorruption(DEFAULT_CORRUPTION, { kind: "npcAdd", npc: npc() as never, id: "n1" })));
    await r.press(fs, tab("NPCs"));
    await r.press(fs, r.by("Refresh with AI"));
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked[0]).toMatchObject({ module: "corruption", action: "refresh", existing: { id: "n1", npcName: "Sera" } });
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Corruption>().npcs[0]).toMatchObject({ id: "n1", cause: "The crown" });
  });
});
