/** Authoring contracts through the real editor: one saved workflow across views and a model-free rehearsal. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { PromptbookEditor } from "./promptbook-editor";
import { installPieceDom, mountEditor } from "../pieces/fake-piece-rig";
import type { InstalledDom } from "../../../_shared/test-dom";
import { emptyPromptbookBody } from "../../../../core/promptbook";
import type { PromptbookBody } from "../../../../entities/promptbook/schema";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());
const api = { listEntities: async () => [], sceneConnections: async () => [] };
test("a recipe, phase edits and saved setups persist as one revision-checked book", async () => {
  const imported = emptyPromptbookBody("Casebook");
  imported.phases[0]!.id = "think";
  const m = await mountEditor(PromptbookEditor, "promptbook", imported, { api });
  try {
    await m.click(m.button(/^Think, then write$/));
    await m.type(m.field("Phase name"), "Plan the scene");
    await m.type(m.field("Setup name"), "Full workflow");
    await m.click(m.button(/^Save setup$/));
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(1);
    expect(m.saves[0]!.kind).toBe("promptbook");
    expect(m.saves[0]!.expected).toBe("r1");
    const body = (m.saves[0]!.patch.head as { body: PromptbookBody }).body;
    expect(body.phases).toHaveLength(2);
    expect(body.phases[0]!.name).toBe("Plan the scene");
    expect(body.phases[0]!.id).not.toBe(body.phases[1]!.id);
    expect(body.phases[1]!.reads).toEqual([body.phases[0]!.id]);
    expect(body.setups[0]!.name).toBe("Full workflow");
  } finally { await m.unmount(); }
});
test("Cards and Board preserve edits; Try a line creates no save or provider request", async () => {
  const m = await mountEditor(PromptbookEditor, "promptbook", emptyPromptbookBody("Casebook"), { api });
  try {
    await m.type(m.field("Phase name"), "Tell the story");
    await m.click(m.button(/^Cards$/));
    expect(m.field<HTMLInputElement>("Phase name").value).toBe("Tell the story");
    await m.click(m.button(/^Board$/));
    expect(m.host.querySelector('[data-part="promptbook.board"]')).not.toBeNull();
    expect(m.field<HTMLInputElement>("Phase name").value).toBe("Tell the story");
    await m.type(m.field("Rehearsal line"), "I open the door.");
    await m.click(m.button(/^Try$/));
    expect(m.host.textContent).toContain("Tell the story: Runs");
    expect(m.saves).toHaveLength(0);
  } finally { await m.unmount(); }
});
