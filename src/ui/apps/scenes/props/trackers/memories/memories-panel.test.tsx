/**
 * The Memories panel as it mounts (RoleCall MemoryJournalWingPanel.tsx): the NPC chips and tabs with their counts, the cards, Add Memory and Refresh as proposals the
 * person accepts, and Delete with its Undo.
 */
import { describe, expect, test } from "bun:test";
import type { JSX } from "react";
import { DEFAULT_MEMORIES, applyMemories, type Mem, type Memories } from "../../../../../../core/trackers/memories";
import { panelRig } from "../items/panel-test-rig";
import { MemoriesPanel } from "./memories-panel";

const r = panelRig("memories");
const made = (over: Partial<Mem> = {}): Mem => ({ npcName: "Vera", content: "The Promise: She swore to keep the light.", category: "promise", emotionalWeight: "defining", sentiment: "positive", ...over });
const kept = (...over: Partial<Mem>[]): Memories => over.reduce((m, o, i) => applyMemories(m, { kind: "add", memory: made(o), id: `m${i}`, at: 10 + i }), DEFAULT_MEMORIES);
const panel = (initial?: Memories): JSX.Element => {
  if (initial) r.seed(initial);
  return <MemoriesPanel ctx={r.ctx()} chat={r.state.chat} id="props.tracker.memories" />;
};
const tab = (name: string): Element => r.qa(".st-tabs button").find((b) => b.textContent?.trim().startsWith(name))!;
const titles = (): (string | null)[] => r.qa(".it-title b").map((n) => n.textContent);

describe("what it shows", () => {
  test("the frame and the empty state", async () => {
    await r.mount(panel());
    expect(r.q(".eb").textContent).toBe("Memories module");
    expect(r.q("h2").textContent).toBe("Memory Journal");
    expect(r.text()).toContain("Tracks per-NPC memories and shared experiences. The AI uses these for emotionally consistent callbacks.");
    expect(r.text()).toContain("No memories recorded");
    expect(r.text()).toContain("NPC memories will form as the story progresses");
  });
  test("a card titles itself from the text before the colon; the NPC chips narrow the list and the tabs count", async () => {
    const fs = await r.mount(panel(kept({}, { npcName: "Tam", content: "A plain memory.", sentiment: "negative", emotionalWeight: "minor", category: "betrayal" })));
    expect(titles()).toEqual(["Betrayal", "The Promise"]);
    await r.press(fs, r.qa(".it-filters button")[1]!);
    expect(titles()).toEqual(["Betrayal"]);
    expect(r.qa(".st-tabs button").map((b) => b.textContent?.trim())).toEqual(["All1", "Defining0", "Positive0", "Negative1"]);
    await r.press(fs, tab("Negative"));
    expect(titles()).toEqual(["Betrayal"]);
  });
  test("an open card shows the memory, the linked event, the tags and when it formed", async () => {
    const fs = await r.mount(panel(kept({ linkedEventDescription: "the storm" })));
    await r.press(fs, r.q(".it-head"));
    for (const s of ["She swore to keep the light.", "Linked Event", "the storm", "Promise", "Defining", "positive", "Formed:"]) expect(r.text()).toContain(s);
  });
});

describe("Add Memory: the model proposes, the person accepts", () => {
  test("Generate asks with the NPC and guide and Accept keeps it", async () => {
    r.state.answers.push(made());
    const fs = await r.mount(panel());
    await r.press(fs, r.by("Add Memory"));
    await r.type(fs, r.q('input[aria-label="NPC name"]'), "Vera");
    await r.type(fs, r.q('input[aria-label="Guide the AI"]'), "a childhood trauma");
    await r.press(fs, r.by("Generate"));
    expect(r.state.asked).toEqual([{ chatId: "c1", module: "memories", action: "generate", itemName: "Vera", userGuide: "a childhood trauma" }]);
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Memories>().memories[0]).toMatchObject({ npcName: "Vera", emotionalWeight: "defining" });
  });
});

describe("an opened memory", () => {
  test("Refresh keeps the id and Accept replaces the fields; Delete marks it and Undo restores it", async () => {
    r.state.answers.push(made({ content: "Rewritten.", sentiment: "complex" }));
    const fs = await r.mount(panel(kept({})));
    await r.press(fs, r.q(".it-head"));
    await r.press(fs, r.by("Refresh with AI"));
    await r.press(fs, r.by("Generate"));
    await r.press(fs, r.by("Accept"));
    expect(r.lastData<Memories>().memories[0]).toMatchObject({ id: "m0", content: "Rewritten.", sentiment: "complex" });
    await r.press(fs, r.by("Delete memory"));
    expect(r.lastData<Memories>().memories[0]!.removedAt).toBeGreaterThan(0);
    await r.press(fs, r.by("Undo"));
    expect(titles()).toHaveLength(1);
  });
});
