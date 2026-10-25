/**
 * The composer's "+" menu on the scene page (rc-parity 03 slice 4): Regenerate and Continue rows that
 * call the same handlers as the bubble's buttons, Ctrl+Shift+R from inside the composer, and the unsent
 * draft kept per scene across a reopen. The scripted page is fake-scene-page-rig.ts.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { box, click, endsOnReply, installRigDom, key, menuRow, mount, msg, props, resetRig, rig, settle, toolsButton, type, unmount } from "./fake-scene-page-rig";

beforeAll(installRigDom);
beforeEach(resetRig);

const chord = (flushSync: Parameters<typeof key>[0], k: string, target: EventTarget) => key(flushSync, k, target, { ctrlKey: true, shiftKey: true });

describe("ScenePage: the composer's + menu", () => {
  test("opens on the tools button with Regenerate and Continue under 'Change the reply', in RoleCall's words", async () => {
    const flushSync = await mount(endsOnReply());
    expect(menuRow("Regenerate")).toBeUndefined();
    click(flushSync, toolsButton()!);
    expect(rig.host.querySelector('[data-part="scene.composer.tools"]')!.textContent).toContain("Change the reply");
    expect(menuRow("Regenerate")!.textContent).toContain("re-roll last AI message");
    expect(menuRow("Continue")!.textContent).toContain("extend last reply");
    unmount(flushSync);
  });

  test("Regenerate asks for a new version of the last reply and closes the menu; Continue extends it", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Regenerate")!);
    await settle(flushSync);
    expect(rig.turns).toEqual([{ kind: "swipe" }]);
    expect(menuRow("Regenerate")).toBeUndefined();
    flushSync(() => rig.endTurn!());
    await settle(flushSync);
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Continue")!);
    await settle(flushSync);
    expect(rig.turns).toEqual([{ kind: "swipe" }, { kind: "continue" }]);
    unmount(flushSync);
  });

  test("every row is disabled, with its reason, while a reply is being written", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Regenerate")!);
    await settle(flushSync);
    click(flushSync, toolsButton()!);
    for (const label of ["Regenerate", "Continue"]) {
      expect(menuRow(label)!.disabled).toBe(true);
      expect(menuRow(label)!.title).toBe("A reply is being written.");
    }
    unmount(flushSync);
  });

  test("on a take with no reply yet, Regenerate answers with RoleCall's line and asks for nothing", async () => {
    const flushSync = await mount([msg("m1", "assistant", "Hello.", 1)]);
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Regenerate")!);
    await settle(flushSync);
    expect(rig.turns).toEqual([]);
    expect(rig.statuses).toEqual(["No AI message yet to re-roll."]);
    unmount(flushSync);
  });
});

describe("ScenePage: Ctrl+Shift+R", () => {
  test("regenerates the last reply from inside the composer, and the browser's reload never sees it", async () => {
    const flushSync = await mount(endsOnReply());
    const e = chord(flushSync, "R", box());
    await settle(flushSync);
    expect(e.defaultPrevented).toBe(true);
    expect(rig.turns).toEqual([{ kind: "swipe" }]);
    unmount(flushSync);
  });

  test("does nothing with no reply to regenerate, or with the + menu open", async () => {
    let flushSync = await mount([msg("m1", "assistant", "Hello.", 1)]);
    chord(flushSync, "R", box());
    await settle(flushSync);
    expect(rig.turns).toEqual([]);
    unmount(flushSync);
    flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    chord(flushSync, "R", box());
    await settle(flushSync);
    expect(rig.turns).toEqual([]);
    unmount(flushSync);
  });
});

describe("ScenePage: the unsent draft", () => {
  test("is kept per scene across a reopen, and cleared once the message goes", async () => {
    let flushSync = await mount(endsOnReply());
    type(flushSync, "half a line");
    unmount(flushSync);
    expect(rig.prefs.get("scenes.draft.chat1")).toBe("half a line");
    flushSync = await mount(endsOnReply());
    expect(box().value).toBe("half a line");
    flushSync(() => props(rig.host.querySelector("form")!)["onSubmit"]!({ preventDefault: () => undefined }));
    await settle(flushSync);
    expect(rig.sent).toEqual(["half a line"]);
    expect(box().value).toBe("");
    expect(rig.prefs.get("scenes.draft.chat1")).toBe("");
    unmount(flushSync);
  });
});
