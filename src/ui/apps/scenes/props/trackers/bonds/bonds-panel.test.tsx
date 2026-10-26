/**
 * The Bonds panel as it mounts (RoleCall BondsWingPanel.tsx): the strength totals, the Active and Broken tabs, the bond cards and what opens under them, Add Bond
 * and Refresh as proposals the person accepts, and Break, which moves a bond to the Broken tab and leaves an Undo. An unbreakable bond offers no Break.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_BONDS, applyBonds, type Bond, type Bonds } from "../../../../../../core/trackers/bonds";
import { panelRig } from "../items/panel-test-rig";
import { BondsPanel } from "./bonds-panel";

const r = panelRig("bonds");
const made = (over: Partial<Bond> = {}): Bond => ({ bondType: "blood_bound", partnerName: "Vera", intensityValue: 60, activeEffects: ["Sense her mood"], canBeBroken: true, playerRole: "Childe", partnerRole: "Sire", description: "Sworn in blood.", drawbacks: ["Compelled to obey"], ...over });
const formed = (...over: Partial<Bond>[]): Bonds => over.reduce((b, o, i) => applyBonds(b, { kind: "form", bond: made(o), id: `b${i}`, at: 10 + i }), DEFAULT_BONDS);
const panel = (initial?: Bonds): JSX.Element => {
  if (initial) r.seed(initial);
  return <BondsPanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.bonds" />;
};
const tab = (name: string): Element => r.qa(".st-tabs button").find((b) => b.textContent?.trim().startsWith(name))!;

describe("what it shows", () => {
  test("the frame, the empty state and the Add Bond button", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Bonds module");
    expect(r.q("h2").textContent).toBe("Supernatural Bonds");
    expect(r.text()).toContain("Tracks supernatural or deep connections between characters. The AI uses bond strength to influence interactions.");
    expect(r.text()).toContain("No active bonds");
    expect(r.text()).toContain("You walk this path alone... for now");
    expect(r.by("Add Bond")).toBeDefined();
  });
  test("the totals, the strongest bond, the count badge and a card with its type, role and intensity", async () => {
    await r.mount(panel(formed({}, { partnerName: "Tam", bondType: "pack_member", intensityValue: 80, playerRole: undefined })));
    expect(r.q(".it-sum b").textContent).toBe("140");
    expect(r.text()).toContain("Strongest Bond");
    expect(r.qa(".it-sum b")[1]!.textContent).toBe("Tam");
    expect(r.q(".it-pill").textContent).toBe("2 BONDS");
    expect(r.qa(".it-meta")[0]!.textContent).toBe("Blood Bound • Childe");
    expect(r.qa(".it-tag").map((t) => t.textContent)).toEqual(["strong", "overwhelming"]);
  });
  test("an open card shows the description, the intensity words, roles, effects, drawbacks and that it can be broken", async () => {
    const fs = await r.mount(panel(formed({})));
    await r.press(fs, r.q(".it-head"));
    for (const s of ["Sworn in blood.", "Intensity: strong (60/100)", "A powerful pull you cannot ignore", "Sire", "You", "Childe", "Sense her mood", "Compelled to obey", "Can be broken", "Formed:"]) expect(r.text()).toContain(s);
  });
});

describe("Add Bond: the model proposes, the person accepts", () => {
  test("Generate asks with the partner and guide, and a bond of the same partner and type is updated", async () => {
    r.state.answers.push(made());
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Add Bond"));
    await r.type(fs, r.q('input[aria-label="Partner Name"]'), "Vera");
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "a blood bond with my sire");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "bonds", action: "generate", itemName: "Vera", userGuide: "a blood bond with my sire" }]);
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Bonds>().bonds[0]).toMatchObject({ partnerName: "Vera", isActive: true, intensityValue: 60 });
    expect(r.lastData<Bonds>().bonds[0]!.id).toMatch(/^bond-/);
  });
});

describe("Refresh and Break", () => {
  test("Refresh keeps the id; Break moves the bond to the Broken tab with BROKEN shown, and Undo brings it back", async () => {
    r.state.answers.push(made({ intensityValue: 90 }));
    const fs = await r.mount(panel(formed({})));
    await r.press(fs, r.by("Refresh with AI"));
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked[0]).toMatchObject({ module: "bonds", action: "refresh", existing: { id: "b0", partnerName: "Vera" } });
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Bonds>().bonds[0]).toMatchObject({ id: "b0", intensityValue: 90 });
    await r.press(fs, r.by("Break the bond with Vera"));
    expect(r.lastData<Bonds>().bonds[0]).toMatchObject({ isActive: false, intensityValue: 0 });
    expect(r.text()).toContain("No active bonds");
    await r.press(fs, tab("Broken"));
    expect(r.text()).toContain("BROKEN");
    expect(r.qa('button[title="Refresh with AI"]')).toHaveLength(0);
    await r.press(fs, r.by("Undo"));
    await r.press(fs, tab("Active"));
    expect(r.q(".it-title b").textContent).toBe("Vera");
  });
  test("an unbreakable bond says so and has no Break button", async () => {
    await r.mount(panel(formed({ canBeBroken: false })));
    expect(r.qa('button[title="Break bond"]')).toHaveLength(0);
    expect(r.text()).toContain("Unbreakable");
  });
});

describe("a full tracker", () => {
  test("500 items mount fewer than 60 cards", async () => {
    await r.mount(panel(formed(...Array.from({ length: 500 }, (_, i) => ({ partnerName: `Partner ${String(i)}` })))));
    const cards = r.qa(".it-card").length;
    expect(cards).toBeGreaterThan(0);
    expect(cards).toBeLessThan(60);
  });
});
