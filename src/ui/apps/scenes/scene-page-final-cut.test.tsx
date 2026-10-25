/**
 * Final Cut on the scene page: while the passes run before a reply is saved the live reply carries RoleCall's "Final Cut pass...",
 * and it goes when the saved reply replaces it. The scripted page is fake-scene-page-rig.ts.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { click, endsOnReply, installRigDom, mount, resetRig, rig, settle, toolsButton, menuRow, unmount } from "./fake-scene-page-rig";

beforeAll(installRigDom);
beforeEach(resetRig);

describe("ScenePage: a reply in Final Cut", () => {
  test("shows Final Cut pass... after the text arrived and until the turn ends", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Regenerate")!);
    await settle(flushSync);
    flushSync(() => rig.handler!({ type: "start", turnId: "t1", kind: "swipe", messageId: "m3" }));
    flushSync(() => rig.handler!({ type: "text", delta: "The lamp swings, slowly." }));
    expect(rig.host.textContent).not.toContain("Final Cut pass...");
    flushSync(() => rig.handler!({ type: "finalcut", pass: "Editor", index: 0, of: 2 }));
    const status = [...rig.host.querySelectorAll('[role="status"]')].find((e) => e.textContent === "Final Cut pass...")!;
    expect(status).toBeDefined();
    expect(status.getAttribute("title")).toBe("Editor");
    flushSync(() => rig.endTurn!());
    await settle(flushSync);
    expect(rig.host.textContent).not.toContain("Final Cut pass...");
    unmount(flushSync);
  });
});
