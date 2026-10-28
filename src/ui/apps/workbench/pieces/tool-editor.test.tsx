/** The tool editor as it mounts: its action and fields save as only the change, a rename carries the roll, and Try returns the answer the AI would get. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { ToolBody } from "../../../../entities/tool/schema";
import type { InstalledDom } from "../../../_shared/test-dom";
import { ToolEditor } from "./tool-editor";
import { installPieceDom, mountEditor } from "./fake-piece-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());

const attack: ToolBody = {
  name: "Attack roll", description: "Roll an attack when a character swings.",
  fields: [{ name: "dice", description: "The dice to roll.", type: "text", required: true }, { name: "target", description: "Who it is aimed at.", type: "text", required: false }],
  action: { kind: "roll", field: "dice" },
};
const luck = { schemaVersion: "1", kind: "dice", id: "d1", body: { name: "Luck", description: "", type: "roll", dice: "1d20" } };
const lists = (kind: string) => (kind === "dice" ? [{ id: "d1", name: "Luck", kind: "dice" }] : kind === "formula" ? [{ id: "f1", name: "Storm pressure", kind: "formula" }] : []);
const api = { listEntities: async (kind: string) => lists(kind), getEntity: async () => luck, getEntitySummary: async (kind: string, id: string) => lists(kind).find((p) => p.id === id) ?? null };
/** A generator at 0.7 shows 15 on a d20. */
const rand = () => 0.7;

const mount = (body: ToolBody = attack) => mountEditor(ToolEditor, "tool", body, { api, rand });

describe("what it shows", () => {
  test("what the AI sees: the call name, the parameters as the provider gets them, and the cost", async () => {
    const m = await mount();
    expect(m.field("When the AI should use it").tagName).toBe("TEXTAREA");
    expect(m.q('[aria-label="What it takes"]').textContent).toBe("dice (text, needed) The dice to roll.\ntarget (text, optional) Who it is aimed at.");
    expect(m.host.textContent).toContain("attack_roll");
    expect(m.host.textContent).toMatch(/Adds to every reply~\d+/);
    await m.unmount();
  });
});

describe("saving", () => {
  test("renaming the field a roll reads carries the roll with it, and nothing else changes", async () => {
    const m = await mount();
    await m.type(m.field("Field name"), "notation");
    await m.click(m.button(/^Save$/));
    const saved = (m.saves[0]!.patch.head as { body: ToolBody }).body;
    expect(saved).toEqual({ ...attack, fields: [{ ...attack.fields[0]!, name: "notation" }, attack.fields[1]!], action: { kind: "roll", field: "notation" } });
    await m.unmount();
  });

  test("choosing what the tool does shows only that choice's picker, starts with no piece picked, and saves the piece picked by id", async () => {
    const m = await mount();
    await m.click(m.button(/^Roll a dice piece$/));
    expect(m.field("Dice piece")).not.toBeNull();
    expect(m.host.querySelector('[aria-label="Which field holds the dice"]')).toBeNull();
    expect(m.host.textContent).toContain("Pick the piece it uses.");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(0);
    await m.type(m.field<HTMLSelectElement>("Dice piece"), "d1");
    await m.click(m.button(/^Save$/));
    expect((m.saves[0]!.patch.head as { body: ToolBody }).body.action).toEqual({ kind: "dice", id: "d1" });
    await m.unmount();
  });

  test("switching away from a picked piece and back finds it again", async () => {
    const m = await mount({ ...attack, action: { kind: "dice", id: "d1" } });
    await m.click(m.button(/^Run a formula$/));
    expect((m.field<HTMLSelectElement>("Formula")).value).toBe("");
    await m.type(m.field<HTMLSelectElement>("Formula"), "f1");
    await m.click(m.button(/^Roll a dice piece$/));
    expect(m.field<HTMLSelectElement>("Dice piece").value).toBe("d1");
    await m.click(m.button(/^Run a formula$/));
    expect(m.field<HTMLSelectElement>("Formula").value).toBe("f1");
    await m.unmount();
  });

  test("a field typed through a sibling's name does not drag the roll onto the sibling, and the roll follows the last name", async () => {
    const m = await mount();
    for (const name of ["t", "target", "notation"]) await m.type(m.field("Field name"), name);
    await m.click(m.button(/^Save$/));
    expect((m.saves[0]!.patch.head as { body: ToolBody }).body.action).toEqual({ kind: "roll", field: "notation" });
    await m.unmount();
  });

  test("a roll that reads the sibling stays on it while the other field is typed through its name", async () => {
    const m = await mount({ ...attack, action: { kind: "roll", field: "target" } });
    for (const name of ["ta", "target", "notation"]) await m.type(m.field("Field name"), name);
    await m.click(m.button(/^Save$/));
    expect((m.saves[0]!.patch.head as { body: ToolBody }).body.action).toEqual({ kind: "roll", field: "target" });
    await m.unmount();
  });

  test("deleting the field a roll reads leaves the roll with no field picked, and says so", async () => {
    const m = await mount();
    await m.click(m.button(/Delete field/));
    expect(m.field<HTMLSelectElement>("Which field holds the dice").value).toBe("");
    expect(m.host.textContent).toContain("The roll must read one of the tool's text fields.");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });

  test("a roll with no text field left is refused in words and not sent", async () => {
    const m = await mount();
    await m.click(m.button(/^Number$/));
    expect(m.host.textContent).toContain("The roll must read one of the tool's text fields.");
    await m.click(m.button(/^Save$/));
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });

  test("with nothing changed, nothing is sent", async () => {
    const m = await mount();
    await m.click(m.button(/^Saved$/));
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });
});

describe("Try", () => {
  test("a roll tool answers exactly what the AI would be told", async () => {
    const m = await mount();
    await m.click(m.button(/^Try$/));
    await m.type(m.field("dice"), "1d20+5");
    await m.click(m.button(/^Call it$/));
    expect(m.q('[role="status"]').textContent).toBe("Rolled 1d20+5: [15] +5 = 20");
    expect(m.host.textContent).toContain("This is the answer the AI gets back.");
    await m.unmount();
  });

  test("a call the AI could not make comes back as the sentence the AI is sent", async () => {
    const m = await mount();
    await m.click(m.button(/^Try$/));
    await m.click(m.button(/^Call it$/));
    expect(m.q('[role="status"]').textContent).toBe("dice is required.");
    await m.type(m.field("dice"), "abc");
    await m.click(m.button(/^Call it$/));
    expect(m.q('[role="status"]').textContent).toBe('"abc" is not dice this tool can roll (like 2d6 or 1d20+3, with at least 1 die of at least 2 sides).');
    await m.unmount();
  });

  test("a dice-piece tool rolls the piece it links", async () => {
    const m = await mount({ ...attack, fields: [], action: { kind: "dice", id: "d1" } });
    await m.click(m.button(/^Try$/));
    await m.click(m.button(/^Call it$/));
    expect(m.q('[role="status"]').textContent).toBe("Luck, 1d20: [15] = 15");
    await m.unmount();
  });

  test("a formula tool says it needs a scene and opens the formula, where Try runs it", async () => {
    const m = await mount({ ...attack, fields: [], action: { kind: "formula", id: "f1" } });
    await m.click(m.button(/^Try$/));
    expect(m.host.textContent).toContain("a formula reads a scene");
    expect(m.host.querySelector("button")).not.toBeNull();
    expect(m.buttons(/^Call it$/)).toHaveLength(0);
    await m.click(m.button(/^Open the formula$/));
    expect(m.opened.map((p) => p.id)).toEqual(["f1"]);
    await m.unmount();
  });

  test("a yes-or-no argument can be left out, said yes or said no", async () => {
    const m = await mount({ name: "Check", description: "", fields: [{ name: "hard", description: "", type: "boolean", required: true }], action: { kind: "record" } });
    await m.click(m.button(/^Try$/));
    await m.click(m.button(/^Call it$/));
    expect(m.q('[role="status"]').textContent).toBe("hard is required.");
    await m.click(m.button(/^No$/));
    await m.click(m.button(/^Call it$/));
    expect(m.q('[role="status"]').textContent).toBe("Recorded.");
    await m.click(m.button(/^Not sent$/));
    expect(m.host.querySelector('[role="status"]')).toBeNull();
    await m.unmount();
  });

  test("a draft that cannot be saved cannot be tried", async () => {
    const m = await mount({ ...attack, action: { kind: "roll", field: "gone" } });
    await m.click(m.button(/^Try$/));
    expect(m.host.textContent).toContain("Fix the tool first to try it");
    expect(m.buttons(/^Call it$/)).toHaveLength(0);
    await m.unmount();
  });
});
