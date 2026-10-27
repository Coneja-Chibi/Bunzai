/** The summary defaults page: every row reads the one `scenes.summaryDefaults` pref and writes it through the store's own checks, including the five keys the Settings app's page does not draw. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import type { AppContext } from "../../../../../app-contract";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { control, setValue, wait } from "../scene/fake-scene-rig";
import { MemoryDefaultRows } from "./memory-defaults";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8432); });
afterAll(async () => { await teardownAllDoms(); });

const KEY = "scenes.summaryDefaults";
function rig(saved?: unknown): { ctx: AppContext; store: Map<string, unknown> } {
  const store = new Map<string, unknown>(saved === undefined ? [] : [[KEY, saved]]);
  const ctx = {
    prefs: { get: (k: string) => store.get(k), set: (k: string, v: unknown) => { store.set(k, v); } },
    api: { sceneConnections: async () => [{ id: "or", label: "OpenRouter", model: "m1" }], connectionModels: async () => ({ models: [{ id: "m1" }, { id: "m2" }], saved: "m1" }) },
    setStatus: () => undefined,
  } as unknown as AppContext;
  return { ctx, store };
}
const mount = (ctx: AppContext) => mountSingle(installed, createElement(MemoryDefaultRows, { ctx }));

describe("summary defaults: the rows the Settings app page does not draw", () => {
  test("messages included, reasoning and truncation read the saved defaults and write their keys", async () => {
    const { ctx, store } = rig({ window: 30, truncate: false });
    const m = await mount(ctx);
    expect(control<HTMLInputElement>(m.host, "Messages included").value).toBe("30");
    expect(control<HTMLElement>(m.host, "Truncate messages").getAttribute("aria-checked")).toBe("false");
    control<HTMLElement>(m.host, "Enable reasoning").click();
    await wait(20);
    expect(store.get(KEY)).toEqual({ window: 30, truncate: false, reasoning: true });
    setValue(control<HTMLInputElement>(m.host, "Messages included"), "0");
    await wait(20);
    expect(store.get(KEY)).toEqual({ truncate: false, reasoning: true });
    control<HTMLElement>(m.host, "Truncate messages").click();
    await wait(20);
    expect(store.get(KEY)).toEqual({ truncate: true, reasoning: true });
    m.done();
  });

  test("the prompt template is saved once it rests, a blank one clears it, and an over-long one is refused with nothing saved", async () => {
    const { ctx, store } = rig();
    const m = await mount(ctx);
    const prompt = control<HTMLTextAreaElement>(m.host, "Prompt template");
    setValue(prompt, "Recap {{messages}} briefly.");
    await wait(550);
    expect(store.get(KEY)).toEqual({ prompt: "Recap {{messages}} briefly." });
    setValue(prompt, "   ");
    await wait(550);
    expect(store.get(KEY)).toBeNull();
    setValue(prompt, "x".repeat(20_001));
    await wait(550);
    expect(store.get(KEY)).toBeNull();
    expect(m.host.querySelector('[role="alert"]')?.textContent).toContain("prompt");
    m.done();
  });

  test("the summary model is a choice of connections that writes the model, and the empty choice clears it", async () => {
    const { ctx, store } = rig({ model: { id: "or", model: "m2" } });
    const m = await mount(ctx);
    await wait(60);
    const select = control<HTMLSelectElement>(m.host, "Summary model");
    expect(select.value).toBe("or|m2");
    setValue(select, "or|m1");
    await wait(20);
    expect(store.get(KEY)).toEqual({ model: { id: "or", model: "m1" } });
    setValue(control<HTMLSelectElement>(m.host, "Summary model"), "");
    await wait(20);
    expect(store.get(KEY)).toBeNull();
    m.done();
  });
});
