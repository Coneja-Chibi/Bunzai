/** Where a tracker or a tool is linked, said in its header and listed on a click. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { InstalledDom } from "../../../_shared/test-dom";
import { ToolEditor } from "./tool-editor";
import { TrackerEditor } from "./tracker-editor";
import { linkedText } from "./linked-scenes";
import { installPieceDom, mountEditor } from "./fake-piece-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());

const tracker = { name: "Health", description: "", layout: "record", note: "", fields: [{ name: "hp", description: "", type: "number" }] };
const tool = { name: "Roll", description: "", fields: [], action: { kind: "record" } };
const scenes = [{ chatId: "s1", title: "Harbour at dusk" }, { chatId: "s2", title: "Market day" }];

describe("the words", () => {
  test("none, one and many, with no warning in any of them", () => {
    expect(linkedText(0)).toBe("not linked to a scene");
    expect(linkedText(1)).toBe("linked in 1 scene");
    expect(linkedText(2)).toBe("linked in 2 scenes");
    expect(linkedText(1000)).toBe("linked in 1000 scenes");
  });
});

describe("in the header", () => {
  test("a tracker asks for its own id and kind, says how many scenes link it, and a click names them", async () => {
    const asked: [string, string][] = [];
    const m = await mountEditor(TrackerEditor, "tracker", tracker, { api: { getLinkedScenes: async (kind: string, id: string) => { asked.push([kind, id]); return scenes; } } });
    expect(asked).toEqual([["tracker", "p1"]]);
    const head = m.q('[data-editor="head"]');
    expect(head.textContent).toContain("one record · linked in 2 scenes");
    expect(m.host.querySelector('[aria-label="Scenes that link it"]')).toBeNull();
    await m.click(m.button(/linked in 2 scenes/));
    expect(m.q('[aria-label="Scenes that link it"]').textContent).toBe("Harbour at duskMarket day");
    await m.click(m.button(/linked in 2 scenes/));
    expect(m.host.querySelector('[aria-label="Scenes that link it"]')).toBeNull();
    await m.unmount();
  });

  test("a tool says the same, and a piece no scene links says so without a list to open", async () => {
    const m = await mountEditor(ToolEditor, "tool", tool, { api: { getLinkedScenes: async () => [] } });
    expect(m.q('[data-editor="head"]').textContent).toContain("notes the call · not linked to a scene");
    expect(m.buttons(/not linked/)).toHaveLength(0);
    await m.unmount();
    const one = await mountEditor(ToolEditor, "tool", tool, { api: { getLinkedScenes: async (kind: string) => (kind === "tool" ? [scenes[0]] : []) } });
    expect(one.q('[data-editor="head"]').textContent).toContain("linked in 1 scene");
    await one.unmount();
  });

  test("a read that fails says so in words instead of claiming the piece is unlinked", async () => {
    const m = await mountEditor(TrackerEditor, "tracker", tracker, { api: { getLinkedScenes: async () => { throw new Error("The scenes could not be read."); } } });
    expect(m.q('[data-editor="head"]').textContent).toContain("The scenes could not be read.");
    expect(m.q('[data-editor="head"]').textContent).not.toContain("not linked");
    await m.unmount();
  });
});
