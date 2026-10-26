/** `single` on the World wing: one tab's body (Messenger section), no tab bar, no crumb. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import { WingPanel } from "./scene-wings";
import { expectNoTabChrome, installSingleDom, mountSingle } from "./single-wing-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8341); });
afterAll(async () => { await teardownAllDoms(); });

const world = { panel: createElement("p", { id: "lore" }, "lore body"), compendium: createElement("p", { id: "comp" }, "compendium body"), meta: "2 linked" };

describe("World wing, single", () => {
  test("the Compendium tab draws its body alone", async () => {
    const m = await mountSingle(installed, createElement(WingPanel, { id: "world", tab: "compendium", bare: true, single: true, world }));
    expect(m.host.querySelector("#comp")).not.toBeNull();
    expectNoTabChrome(m.host);
    m.done();
  });
  test("without single the same tab keeps its tab bar", async () => {
    const m = await mountSingle(installed, createElement(WingPanel, { id: "world", tab: "compendium", bare: true, world }));
    expect(m.host.querySelectorAll('[role="tab"]')).toHaveLength(2);
    m.done();
  });
});
