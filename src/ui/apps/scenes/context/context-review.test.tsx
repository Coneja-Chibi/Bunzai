/** The Review tile on the scene page (rc-parity 08): a paused turn whose dialog was put away comes back from the Context wing, and the turn is answered as before. */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { click, endsOnReply, installRigDom, menuRow, mount, resetRig, rig, settle, toolsButton, unmount } from "../fake-scene-page-rig";
import { INSPECTOR_KEY } from "../inspector-core";

beforeAll(installRigDom);
beforeEach(resetRig);

describe("ScenePage: Context > Review", () => {
  test("Review later puts the dialog behind the pill; Context's Review tile reopens it", async () => {
    rig.prefs.set(INSPECTOR_KEY, true);
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Regenerate")!);
    await settle(flushSync);
    flushSync(() => rig.handler!({ type: "review", turnId: "t1", messages: [{ role: "system", content: "Be Vera." }], tokens: 4 }));
    await settle(flushSync);
    const doc = rig.dom.window.document;
    click(flushSync, [...doc.querySelectorAll<HTMLButtonElement>(".pi-acts button")].find((b) => b.textContent?.includes("Review later"))!);
    expect(doc.querySelector('[data-part="scene.inspector"]')).toBeNull();
    click(flushSync, doc.querySelector('[data-wing="context"]')!);
    await settle(flushSync);
    click(flushSync, [...doc.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Reviewopen review")!);
    expect(doc.querySelector('[data-part="scene.inspector"]')).not.toBeNull();
    expect(doc.querySelector(".cx-toast")).toBeNull();
    unmount(flushSync);
  });
});
