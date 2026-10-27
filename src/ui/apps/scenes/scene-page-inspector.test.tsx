/**
 * The Prompt Inspector on the scene page (rc-parity 03 F16, slice 8): the "+" menu's Debug row flips the one
 * per-user pref and stays open; with it on, a turn asks the server to pause; the paused request shows in a
 * dialog with the exact messages; Send answers with the changed ones; Review later (or the X) dismisses the
 * dialog and keeps the turn paused behind RoleCall's "Turn paused for Prompt Inspector" pill, which reopens it;
 * Stop turn answers cancel; with it off, a turn asks for no pause. The scripted page is fake-scene-page-rig.ts.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { click, endsOnReply, installRigDom, menuRow, mount, props, resetRig, rig, settle, toolsButton, unmount, type FlushSync } from "./fake-scene-page-rig";
import { INSPECTOR_KEY } from "./inspector-core";

beforeAll(installRigDom);
beforeEach(resetRig);

const dialog = (): HTMLElement | null => rig.dom.window.document.querySelector('[data-part="scene.inspector"]');
const button = (label: string): HTMLButtonElement => [...dialog()!.querySelectorAll<HTMLButtonElement>(".pi-acts button")].find((b) => b.textContent?.includes(label))!;
const regenerate = async (flushSync: FlushSync): Promise<void> => {
  click(flushSync, toolsButton()!);
  click(flushSync, menuRow("Regenerate")!);
  await settle(flushSync);
};
const pill = (): HTMLButtonElement | null => rig.dom.window.document.querySelector(".pi-paused [data-control='button']");
const pause = async (flushSync: FlushSync): Promise<void> => {
  flushSync(() => rig.handler!({ type: "review", turnId: "t1", messages: [{ role: "system", content: "Be Vera." }, { role: "user", content: "Hi Vera." }], tokens: 12 }));
  await settle(flushSync);
};

describe("ScenePage: the Prompt Inspector", () => {
  test("the Debug row reads the pref, flips it, and leaves the menu open to show the new state", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    expect(menuRow("Prompt Inspector: Off")).toBeDefined();
    click(flushSync, menuRow("Prompt Inspector: Off")!);
    expect(rig.prefs.get(INSPECTOR_KEY)).toBe(true);
    expect(menuRow("Prompt Inspector: On")).toBeDefined();
    click(flushSync, menuRow("Prompt Inspector: On")!);
    expect(rig.prefs.get(INSPECTOR_KEY)).toBe(false);
    unmount(flushSync);
  });

  test("a switch flipped elsewhere (the Messenger settings) shows when the menu opens, and the row then flips what is stored", async () => {
    const flushSync = await mount(endsOnReply());
    rig.prefs.set(INSPECTOR_KEY, true);
    click(flushSync, toolsButton()!);
    expect(menuRow("Prompt Inspector: On")).toBeDefined();
    rig.prefs.set(INSPECTOR_KEY, false);
    click(flushSync, menuRow("Prompt Inspector: On")!);
    expect(rig.prefs.get(INSPECTOR_KEY)).toBe(true);
    unmount(flushSync);
  });

  test("off means a turn asks for no pause; on means it asks for one, whatever kind of turn it is", async () => {
    const flushSync = await mount(endsOnReply());
    await regenerate(flushSync);
    expect(rig.turns).toEqual([{ kind: "swipe" }]);
    rig.endTurn!();
    await settle(flushSync);
    rig.prefs.set(INSPECTOR_KEY, true);
    await regenerate(flushSync);
    expect(rig.turns.at(-1)).toEqual({ kind: "swipe", inspect: true });
    unmount(flushSync);
  });

  test("a paused turn shows the exact request; Send with no change answers send with no edits", async () => {
    rig.prefs.set(INSPECTOR_KEY, true);
    const flushSync = await mount(endsOnReply());
    await regenerate(flushSync);
    expect(dialog()).toBeNull();
    await pause(flushSync);
    expect(dialog()!.textContent).toContain("Prompt Inspector");
    expect(dialog()!.textContent).toContain("about 12 tokens");
    expect([...dialog()!.querySelectorAll("textarea")].map((t) => t.value)).toEqual(["Be Vera.", "Hi Vera."]);
    click(flushSync, button("Send"));
    await settle(flushSync);
    expect(rig.answers).toEqual([{ kind: "send", edits: {} }]);
    expect(dialog()).toBeNull();
    unmount(flushSync);
  });

  test("an edited message goes back by position and the button says so", async () => {
    rig.prefs.set(INSPECTOR_KEY, true);
    const flushSync = await mount(endsOnReply());
    await regenerate(flushSync);
    await pause(flushSync);
    flushSync(() => props(dialog()!.querySelectorAll("textarea")[1]!)["onChange"]!({ target: { value: "Hi again, Vera." } }));
    expect(button("Edit and send")).toBeDefined();
    click(flushSync, button("Edit and send"));
    await settle(flushSync);
    expect(rig.answers).toEqual([{ kind: "send", edits: { 1: "Hi again, Vera." } }]);
    unmount(flushSync);
  });

  test("Review later dismisses the dialog and keeps the turn paused; the pill reopens it with its edits", async () => {
    rig.prefs.set(INSPECTOR_KEY, true);
    const flushSync = await mount(endsOnReply());
    await regenerate(flushSync);
    await pause(flushSync);
    flushSync(() => props(dialog()!.querySelectorAll("textarea")[1]!)["onChange"]!({ target: { value: "Edited." } }));
    click(flushSync, button("Review later"));
    await settle(flushSync);
    expect(dialog()).toBeNull();
    expect(rig.answers).toEqual([]);
    expect(pill()!.textContent).toBe("Turn paused for Prompt Inspector");
    click(flushSync, pill()!);
    expect(pill()).toBeNull();
    expect(dialog()!.querySelectorAll("textarea")[1]!.value).toBe("Edited.");
    expect(rig.answers).toEqual([]);
    unmount(flushSync);
  });

  test("the X dismisses the same way", async () => {
    rig.prefs.set(INSPECTOR_KEY, true);
    const flushSync = await mount(endsOnReply());
    await regenerate(flushSync);
    await pause(flushSync);
    click(flushSync, dialog()!.querySelector('[aria-label="Close Prompt Inspector"]')!);
    expect(dialog()).toBeNull();
    expect(pill()).not.toBeNull();
    expect(rig.answers).toEqual([]);
    unmount(flushSync);
  });

  test("Stop turn answers cancel and closes everything", async () => {
    rig.prefs.set(INSPECTOR_KEY, true);
    const flushSync = await mount(endsOnReply());
    await regenerate(flushSync);
    await pause(flushSync);
    click(flushSync, button("Stop turn"));
    await settle(flushSync);
    expect(rig.answers).toEqual([{ kind: "cancel" }]);
    expect(dialog()).toBeNull();
    expect(pill()).toBeNull();
    unmount(flushSync);
  });

  test("a turn that ends while the review is dismissed takes the pill with it", async () => {
    rig.prefs.set(INSPECTOR_KEY, true);
    const flushSync = await mount(endsOnReply());
    await regenerate(flushSync);
    await pause(flushSync);
    click(flushSync, button("Review later"));
    flushSync(() => rig.handler!({ type: "stopped", message: null }));
    await settle(flushSync);
    expect(pill()).toBeNull();
    unmount(flushSync);
  });
});

describe("ScenePage: the Prompt Inspector with tools", () => {
  test("the tool definitions follow the messages, read-only, and never go back as edits", async () => {
    rig.prefs.set(INSPECTOR_KEY, true);
    const flushSync = await mount(endsOnReply());
    await regenerate(flushSync);
    flushSync(() => rig.handler!({ type: "review", turnId: "t1", messages: [{ role: "user", content: "Hi Vera." }], tokens: 4, tools: [{ name: "explore_lorebook", description: "Look something up.", parameters: { type: "object" } }] }));
    await settle(flushSync);
    const box = dialog()!.querySelector<HTMLTextAreaElement>('[data-part="scene.inspector.tool"] textarea')!;
    expect(dialog()!.querySelector('[data-part="scene.inspector.tool"] span')!.textContent).toBe("tool: explore_lorebook");
    expect(box.readOnly).toBe(true);
    expect(box.value).toContain("Look something up.");
    click(flushSync, button("Send"));
    await settle(flushSync);
    expect(rig.answers).toEqual([{ kind: "send", edits: {} }]);
    unmount(flushSync);
  });
});
