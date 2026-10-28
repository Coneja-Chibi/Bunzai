/** The time-budget rows: seconds shown from the saved milliseconds (the default when nothing is saved), a typed positive number saved in milliseconds when the box is left, and anything else saves nothing. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import type { AppContext } from "../../../../../app-contract";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { control, setValue, wait } from "../scene/fake-scene-rig";
import { BudgetRows } from "./budget-rows";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8433); });
afterAll(async () => { await teardownAllDoms(); });

const TOOLS = "Tools, per reply, in seconds";
const PROMPT = "Building the prompt, in seconds";
function rig(saved: Record<string, unknown> = {}): { ctx: AppContext; store: Map<string, unknown>; writes: [string, unknown][] } {
  const store = new Map<string, unknown>(Object.entries(saved));
  const writes: [string, unknown][] = [];
  const ctx = { prefs: { get: (k: string) => store.get(k), set: (k: string, v: unknown) => { writes.push([k, v]); store.set(k, v); } } } as unknown as AppContext;
  return { ctx, store, writes };
}
const mount = (ctx: AppContext) => mountSingle(installed, createElement(BudgetRows, { ctx }));
async function type(host: HTMLElement, label: string, text: string): Promise<void> {
  const box = control<HTMLInputElement>(host, label);
  box.focus();
  setValue(box, text);
  box.blur();
  await wait(20);
}

describe("time budget rows", () => {
  test("nothing saved shows the defaults in seconds; saved milliseconds show as seconds", async () => {
    const empty = await mount(rig().ctx);
    expect(control<HTMLInputElement>(empty.host, TOOLS).value).toBe("5");
    expect(control<HTMLInputElement>(empty.host, PROMPT).value).toBe("3");
    empty.done();
    const set = await mount(rig({ "scenes.toolBudgetMs": 12_500, "scenes.promptBudgetMs": 1_000 }).ctx);
    expect(control<HTMLInputElement>(set.host, TOOLS).value).toBe("12.5");
    expect(control<HTMLInputElement>(set.host, PROMPT).value).toBe("1");
    set.done();
  });

  test("a typed number of seconds is saved in milliseconds under the studio's key when the box is left, any size", async () => {
    const { ctx, writes } = rig();
    const m = await mount(ctx);
    await type(m.host, TOOLS, "20");
    await type(m.host, PROMPT, "100000");
    expect(writes).toEqual([["scenes.toolBudgetMs", 20_000], ["scenes.promptBudgetMs", 100_000_000]]);
    expect(control<HTMLInputElement>(m.host, TOOLS).value).toBe("20");
    m.done();
  });

  test("an empty box, words, zero and a negative number save nothing and the box goes back to what is saved", async () => {
    const { ctx, writes } = rig({ "scenes.toolBudgetMs": 8_000 });
    const m = await mount(ctx);
    for (const bad of ["", "soon", "0", "-4"]) {
      await type(m.host, TOOLS, bad);
      expect(control<HTMLInputElement>(m.host, TOOLS).value).toBe("8");
    }
    expect(writes).toEqual([]);
    m.done();
  });

  test("a value equal to the saved one writes nothing", async () => {
    const { ctx, writes } = rig({ "scenes.toolBudgetMs": 8_000 });
    const m = await mount(ctx);
    await type(m.host, TOOLS, "8");
    expect(writes).toEqual([]);
    m.done();
  });
});
