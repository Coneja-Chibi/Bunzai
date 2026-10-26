/** `single` on the AI wing's tabs: one tab's body (Messenger section), no tab bar, no crumb. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import { AiTabs } from "./scene-ai-tabs";
import { WingPanel } from "./scene-wings";
import { expectNoTabChrome, installSingleDom, mountSingle } from "./single-wing-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8342); });
afterAll(async () => { await teardownAllDoms(); });

const model = createElement("p", { id: "model" }, "model body");
const generation = createElement("p", { id: "gen" }, "gen body");

describe("AI tabs, single", () => {
  test("the Generation tab draws its body alone", async () => {
    const m = await mountSingle(installed, createElement(AiTabs, { model, generation, initialTab: "generation", single: true }));
    expect(m.host.querySelector("#gen")).not.toBeNull();
    expectNoTabChrome(m.host);
    m.done();
  });
  test("WingPanel passes single down to the tabs", async () => {
    const m = await mountSingle(installed, createElement(WingPanel, { id: "ai", tab: "model", bare: true, single: true, ai: model, aiGeneration: generation }));
    expect(m.host.querySelector("#model")).not.toBeNull();
    expectNoTabChrome(m.host);
    m.done();
  });
});
