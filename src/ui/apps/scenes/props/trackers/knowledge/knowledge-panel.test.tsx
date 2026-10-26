/**
 * The Knowledge panel as it mounts (RoleCall KnowledgeWingPanel.tsx): the search box, the tabs with their counts, the category chips, the entries and what opens
 * under them, Add Knowledge Entry and Refresh as proposals the person accepts, Delete with its Undo.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_KNOWLEDGE, knowledgeLines, type KnowEntry, type Knowledge } from "../../../../../../core/trackers/knowledge";
import { panelRig } from "../items/panel-test-rig";
import { KnowledgePanel } from "./knowledge-panel";

const r = panelRig("knowledge");
const entry = (id: string, over: Partial<KnowEntry> = {}): KnowEntry => ({ id, subject: "The Duke's debt", content: "He owes the guild a fortune.", reliability: "believes", category: "rumor", learnedAt: 1, ...over });
const kept = (...entries: KnowEntry[]): Knowledge => ({ ...DEFAULT_KNOWLEDGE, entries });
const panel = (initial?: Knowledge): JSX.Element => {
  if (initial) r.seed(initial);
  return <KnowledgePanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.knowledge" />;
};
const tab = (name: string): Element => r.qa(".st-tabs button").find((b) => b.textContent?.trim().startsWith(name))!;
const subjects = (): (string | null)[] => r.qa(".it-title b").map((n) => n.textContent);
const made = { subject: "The Duke's debt", content: "He owes the guild a fortune.", reliability: "believes", category: "rumor", source: "Tam" };

describe("what it shows", () => {
  test("the frame, the empty state and the tab counts", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Knowledge module");
    expect(r.q(".trk").getAttribute("data-part")).toBe("props.tracker.knowledge");
    expect(r.text()).toContain("Tracks what you know and have discovered. The AI ensures you don't reference unknown information.");
    expect(r.text()).toContain("No knowledge entries");
    expect(r.text()).toContain("Your knowledge base is empty");
    expect(r.qa(".st-tabs button").map((b) => b.textContent?.trim())).toEqual(["All0", "Certain0", "Uncertain0", "Secrets0"]);
  });
  test("a closed entry shows its subject, source, reliability and the start of its content; WRONG is counted in the header", async () => {
    await r.mount(panel(kept(entry("a", { source: "Tam" }), entry("b", { subject: "Moon", reliability: "wrong", content: "It is cheese." }))));
    expect(r.q(".it-pill.bad").textContent).toBe("1 WRONG");
    expect(r.text()).toContain("From: Tam");
    expect(r.qa(".it-tag").map((t) => t.textContent)).toContain("~Believes");
    expect(r.text()).toContain("He owes the guild a fortune.");
    expect(r.q(".trk-tokens").textContent).toBe(`~${Math.ceil(knowledgeLines(kept(entry("a"), entry("b"))).join("\n").length / 4)}t`);
  });
  test("the tabs, the category chips and the search narrow the list; a search with no match says so", async () => {
    const fs = await r.mount(panel(kept(
      entry("a", { subject: "Sure thing", reliability: "certain", category: "fact", learnedAt: 3 }),
      entry("b", { subject: "Maybe", reliability: "suspects", category: "person", learnedAt: 2 }),
      entry("c", { subject: "Hidden", reliability: "believes", category: "secret", secretType: "player_hiding", learnedAt: 1 }))));
    expect(subjects()).toEqual(["Sure thing", "Maybe", "Hidden"]);
    await r.press(fs, tab("Certain"));
    expect(subjects()).toEqual(["Sure thing"]);
    await r.press(fs, tab("Uncertain"));
    expect(subjects()).toEqual(["Maybe", "Hidden"]);
    await r.press(fs, tab("Secrets"));
    expect(subjects()).toEqual(["Hidden"]);
    await r.press(fs, tab("All"));
    await r.press(fs, r.by("person"));
    expect(subjects()).toEqual(["Maybe"]);
    await r.press(fs, r.qa(".it-filters button")[0]!);
    await r.type(fs, r.q('input[aria-label="Search knowledge"]'), "zzz");
    expect(r.text()).toContain("No results found");
  });
  test("an open entry shows its content, category, tags, related NPCs, secret details and when it was learned", async () => {
    const fs = await r.mount(panel(kept(entry("a", { tags: ["court"], linkedNpcNames: ["Vera"], secretType: "npc_hiding", hiddenFrom: ["Mira"], concealmentMethod: "lying", vulnerabilityPoints: ["a ledger"], revelationImpact: "War.", dangerLevel: "explosive", learnedFrom: "Tam", actuallyTrue: false, dmNotes: "He lied." }))));
    await r.press(fs, r.q(".it-head"));
    for (const s of ["He owes the guild a fortune.", "Category: Rumor", "court", "Related NPCs", "Vera", "Secret Details", "Hidden from:", "Mira", "lying", "a ledger", "War.", "Learned from: Tam", "Actually False", "He lied."]) expect(r.text()).toContain(s);
  });
});

describe("Add Knowledge Entry: the model proposes, the person accepts", () => {
  test("Generate asks with the subject and guide, and Accept writes the entry", async () => {
    r.state.answers.push(made);
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Add Knowledge Entry"));
    await r.type(fs, r.q('input[aria-label="Subject"]'), "The Duke's debt");
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "a rumor about the king");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "knowledge", action: "generate", itemName: "The Duke's debt", userGuide: "a rumor about the king" }]);
    expect(r.text()).toContain("Proposed entry");
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Knowledge>().entries[0]).toMatchObject({ subject: "The Duke's debt", reliability: "believes", source: "Tam" });
    expect(r.lastData<Knowledge>().entries[0]!.id).toMatch(/^know-/);
  });
  test("an entry that says what is already known is not added, and the panel says so", async () => {
    r.state.answers.push(made);
    const fs = await r.mount(panel(kept(entry("a"))));
    await r.press(fs, r.by("Add Knowledge Entry"));
    await r.type(fs, r.q('input[aria-label="Subject"]'), "The Duke's debt");
    await r.press(fs, r.by("Generate"));
    await r.press(fs, r.by("Accept"));
    expect(r.state.writes).toHaveLength(0);
    expect(r.text()).toContain("That is already in Knowledge.");
  });
});

describe("an opened entry", () => {
  test("Refresh asks with the entry and Accept replaces its fields, keeping the id and when it was learned", async () => {
    r.state.answers.push({ ...made, content: "Now certain.", reliability: "certain" });
    const fs = await r.mount(panel(kept(entry("a", { learnedAt: 7 }))));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Refresh with AI"));
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked[0]).toMatchObject({ module: "knowledge", action: "refresh", existing: { id: "a", subject: "The Duke's debt" } });
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Knowledge>().entries[0]).toMatchObject({ id: "a", learnedAt: 7, content: "Now certain.", reliability: "certain" });
  });
  test("Delete marks the entry and leaves an Undo that brings it back", async () => {
    const fs = await r.mount(panel(kept(entry("a"))));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Delete entry"));
    expect(r.lastData<Knowledge>().entries[0]!.removedAt).toBeGreaterThan(0);
    expect(r.text()).toContain("No knowledge entries");
    await r.press(fs, r.by("Undo"));
    expect(subjects()).toEqual(["The Duke's debt"]);
  });
});

describe("the frame", () => {
  test("Clear All Data keeps the sub-features that were switched on", async () => {
    const fs = await r.mount(panel({ ...kept(entry("a")), subs: { secrets: true } }));
    await r.press(fs, r.by("Panel AI settings"));
    await r.press(fs, r.by("Clear All Data"));
    await r.press(fs, r.by("Yes, clear"));
    expect(r.lastData<Knowledge>()).toEqual({ entries: [], subs: { secrets: true } });
  });
});

describe("a full tracker", () => {
  test("500 items mount fewer than 60 cards", async () => {
    await r.mount(panel(kept(...Array.from({ length: 500 }, (_, i) => entry(`k${String(i)}`, { subject: `Subject ${String(i)}` })))));
    const cards = r.qa(".it-card").length;
    expect(cards).toBeGreaterThan(0);
    expect(cards).toBeLessThan(60);
  });
});
