/** The formula editor as it mounts: the text saves as only the change, the macro chips add to it, and Try calls the route with the picked scene and shows its result and its stop. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { FormulaBody } from "../../../../entities/formula/schema";
import type { InstalledDom } from "../../../_shared/test-dom";
import { FormulaEditor } from "./formula-editor";
import { installPieceDom, mountEditor } from "./fake-piece-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installPieceDom(); });
afterAll(() => installed.teardown());

const storm: FormulaBody = { name: "Storm pressure", description: "How close the harbour is to a storm.", text: "{{if::{{compare::{{mentions::storm::10}}::>::2}}::rising::calm}}" };
const scenes = [{ id: "s1", title: "Harbour at dusk" }, { id: "s2", title: "Market day" }];

type Try = (chatId: string, text: string) => Promise<unknown>;
const mount = (tryFormula: Try = async () => ({ ok: true, text: "rising", ms: 3 })) =>
  mountEditor(FormulaEditor, "formula", storm, { api: { listScenes: async () => scenes, tryFormula } });
const bodyOf = (call: { patch: { head: unknown } }): FormulaBody => (call.patch.head as { body: FormulaBody }).body;

describe("editing", () => {
  test("a chip adds its macro to the text, and the save carries only the text", async () => {
    const m = await mount();
    await m.click(m.button(/\{\{odds::percent\}\}/));
    expect(m.q<HTMLTextAreaElement>("textarea").value).toBe(`${storm.text}{{odds::percent}}`);
    await m.click(m.button(/^Save$/));
    expect(bodyOf(m.saves[0]!)).toEqual({ ...storm, text: `${storm.text}{{odds::percent}}` });
    await m.unmount();
  });

  test("the chips include the four chat-watching macros and the tracker macro", async () => {
    const m = await mount();
    const chips = [...m.host.querySelectorAll("code")].map((c) => c.textContent);
    expect(chips).toEqual(["{{mentions::word::n}}", "{{lastmention::word}}", "{{tally::a,b,c}}", "{{odds::percent}}", "{{tracker::name::field}}"]);
    await m.unmount();
  });

  test("with nothing changed, nothing is sent", async () => {
    const m = await mount();
    await m.click(m.button(/^Saved$/));
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });
});

describe("Try it", () => {
  test("Run is off until a scene is picked, then sends the formula as it stands (unsaved) with that scene", async () => {
    const asked: [string, string][] = [];
    const m = await mount(async (chatId, text) => { asked.push([chatId, text]); return { ok: true, text: "rising", ms: 3 }; });
    expect(m.button(/^Run$/).disabled).toBe(true);
    await m.type(m.field<HTMLSelectElement>("Run against"), "s1");
    await m.type(m.q<HTMLTextAreaElement>("textarea"), "{{calc::1 + 2}}");
    await m.click(m.button(/^Run$/));
    expect(asked).toEqual([["s1", "{{calc::1 + 2}}"]]);
    expect(m.q('[role="status"]').textContent).toBe("rising3 ms");
    expect(m.saves).toHaveLength(0);
    await m.unmount();
  });

  test("a run that stopped says so in the route's words, and a result is dropped when the text changes", async () => {
    const m = await mount(async () => ({ ok: false, error: "This formula changes variables (x), which it cannot do here.", ms: 2 }));
    await m.type(m.field<HTMLSelectElement>("Run against"), "s2");
    await m.click(m.button(/^Run$/));
    expect(m.q('[role="status"]').textContent).toContain("Stopped: This formula changes variables (x), which it cannot do here.");
    await m.type(m.q<HTMLTextAreaElement>("textarea"), "{{odds::50}}");
    expect(m.host.querySelector('[role="status"]')).toBeNull();
    await m.unmount();
  });

  test("a scene the route cannot read is told in words, not as an empty result", async () => {
    const m = await mount(async () => { throw new Error("This scene has no connection yet."); });
    await m.type(m.field<HTMLSelectElement>("Run against"), "s1");
    await m.click(m.button(/^Run$/));
    expect(m.q('[role="status"]').textContent).toContain("Stopped: This scene has no connection yet.");
    await m.unmount();
  });
});
