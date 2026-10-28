/** The "Show what each reply changed" row: on unless the scene's prompting says false, and a flip writes `trackerChanges` through the scene's prompting writer. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { teardownAllDoms, type InstalledDom } from "../../../../../_shared/test-dom";
import { installSingleDom, mountSingle } from "../../../single-wing-rig";
import { featuresCategories } from "./features";
import { bodyOfSection, control, rig, wait } from "./fake-scene-rig";

let installed: InstalledDom;
beforeAll(() => { installed = installSingleDom(8434); });
afterAll(async () => { await teardownAllDoms(); });

const mountRow = (r: ReturnType<typeof rig>) => mountSingle(installed, createElement("div", null, bodyOfSection(featuresCategories(r.a, r.open)[0]!, "tracker-changes")));
const LABEL = "Show what each reply changed";

describe("scene feature switch for change visuals", () => {
  test("a scene with no setting shows it on, with the wireframe's copy; turning it off writes false", async () => {
    const r = rig();
    const m = await mountRow(r);
    expect(m.host.textContent).toContain("Tracker changes appear under the reply that made them.");
    expect(control<HTMLElement>(m.host, LABEL).getAttribute("aria-checked")).toBe("true");
    control<HTMLElement>(m.host, LABEL).click();
    await wait(10);
    expect(r.calls["setScenePrompting"]).toEqual([["c1", { trackerChanges: false }]]);
    m.done();
  });

  test("a scene that turned it off shows it off, and turning it on writes true", async () => {
    const r = rig({ chat: { prompting: { trackerChanges: false } } });
    const m = await mountRow(r);
    expect(control<HTMLElement>(m.host, LABEL).getAttribute("aria-checked")).toBe("false");
    control<HTMLElement>(m.host, LABEL).click();
    await wait(10);
    expect(r.calls["setScenePrompting"]).toEqual([["c1", { trackerChanges: true }]]);
    m.done();
  });
});
