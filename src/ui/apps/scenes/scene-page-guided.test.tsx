/**
 * Guided re-roll on the scene page (rc-parity 03 slice 5): the "+" menu row and the message menu's
 * "Guided re-roll" / "Edit guided re-roll" put the composer in steering mode (RoleCall's ribbon, helper,
 * Cancel, Esc, placeholder and re-roll send); the next send is the instruction for a new version of the
 * last reply, empty meaning a plain re-roll; only the take's last reply can be steered. The scripted page is
 * fake-scene-page-rig.ts.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { box, click, endsOnReply, endsOnYou, installRigDom, key, menuRow, mount, props, resetRig, rig, settle, toolsButton, type, unmount, type FlushSync } from "./fake-scene-page-rig";

beforeAll(installRigDom);
beforeEach(resetRig);

const BRANCH_REQUIRED = "That reply has later messages beneath it. Create a branch from that point before using Guided Swipe so the existing timeline stays intact.";
const ribbon = (): HTMLElement | null => rig.host.querySelector('[data-part="scene.composer.steering"]');
const sendButton = (): HTMLButtonElement => rig.host.querySelector('.cap button[type="submit"]')!;
const submit = async (flushSync: FlushSync): Promise<void> => {
  flushSync(() => props(rig.host.querySelector("form")!)["onSubmit"]!({ preventDefault: () => undefined }));
  await settle(flushSync);
};
const moreMenu = (flushSync: FlushSync, messageId: string): void => {
  const more = rig.host.querySelector(`[data-mid="${messageId}"] [aria-label="More message actions"]`)!;
  click(flushSync, more);
};
const steerFromMenu = (flushSync: FlushSync): void => {
  click(flushSync, toolsButton()!);
  click(flushSync, menuRow("Guided re-roll")!);
};

describe("ScenePage: steering the composer for a guided re-roll", () => {
  test("the + menu's Guided re-roll shows RoleCall's ribbon and helper, its placeholder, and a re-roll send that needs no text", async () => {
    const flushSync = await mount(endsOnReply());
    expect(ribbon()).toBeNull();
    steerFromMenu(flushSync);
    expect(ribbon()!.textContent).toContain("Steering Vera's last reply");
    expect(ribbon()!.textContent).toContain("Your next send becomes the regen instruction. Empty = re-roll without instruction.");
    expect(ribbon()!.textContent).toContain("Cancel");
    expect(box().placeholder).toBe("Tell the AI how to retake the message, or hit send with no text to re-roll without instruction…");
    expect(sendButton().getAttribute("aria-label")).toBe("Regenerate");
    expect(sendButton().disabled).toBe(false);
    expect(menuRow("Guided re-roll")).toBeUndefined();
    unmount(flushSync);
  });

  test("sending asks for a new version with the instruction, trimmed, and leaves steering", async () => {
    const flushSync = await mount(endsOnReply());
    steerFromMenu(flushSync);
    type(flushSync, "  Make her colder.  ");
    await submit(flushSync);
    expect(rig.turns).toEqual([{ kind: "swipe", guidance: "Make her colder." }]);
    expect(ribbon()).toBeNull();
    expect(rig.sent).toEqual([]);
    unmount(flushSync);
  });

  test("sending with no text is a plain re-roll: no guidance goes with the turn", async () => {
    const flushSync = await mount(endsOnReply());
    steerFromMenu(flushSync);
    await submit(flushSync);
    expect(rig.turns).toEqual([{ kind: "swipe" }]);
    unmount(flushSync);
  });

  test("Esc in the box and the ribbon's Cancel leave steering without asking for anything, and the half-typed draft is still there", async () => {
    const flushSync = await mount(endsOnReply());
    type(flushSync, "my next line");
    steerFromMenu(flushSync);
    expect(box().value).toBe("");
    type(flushSync, "make her colder");
    const esc = key(flushSync, "Escape", box());
    expect(esc.defaultPrevented).toBe(true);
    expect(ribbon()).toBeNull();
    expect(box().value).toBe("my next line");
    steerFromMenu(flushSync);
    click(flushSync, [...ribbon()!.querySelectorAll("button")].find((b) => b.textContent?.includes("Cancel"))!);
    expect(ribbon()).toBeNull();
    expect(box().value).toBe("my next line");
    expect(rig.turns).toEqual([]);
    expect(rig.sent).toEqual([]);
    unmount(flushSync);
  });

  test("Enter sends the instruction, not a message; a regular message is still sent when not steering", async () => {
    const flushSync = await mount(endsOnReply());
    steerFromMenu(flushSync);
    type(flushSync, "Shorter.");
    key(flushSync, "Enter", box());
    await settle(flushSync);
    expect(rig.turns).toEqual([{ kind: "swipe", guidance: "Shorter." }]);
    expect(rig.sent).toEqual([]);
    unmount(flushSync);
  });

  test("a guided re-roll that fails retries with the same instruction", async () => {
    const flushSync = await mount(endsOnReply());
    steerFromMenu(flushSync);
    type(flushSync, "Make her colder.");
    await submit(flushSync);
    flushSync(() => rig.handler!({ type: "failed", category: "api_error", code: "backend_error", message: "the provider hung up", draft: "" }));
    flushSync(() => rig.endTurn!());
    await settle(flushSync);
    const retry = [...rig.host.querySelectorAll("button")].find((b) => b.textContent === "Retry")!;
    click(flushSync, retry);
    await settle(flushSync);
    expect(rig.turns).toEqual([{ kind: "swipe", guidance: "Make her colder." }, { kind: "swipe", guidance: "Make her colder." }]);
    unmount(flushSync);
  });

  test("with no reply past the greeting the menu row answers RoleCall's line and does not steer", async () => {
    const flushSync = await mount(endsOnReply().slice(0, 1));
    steerFromMenu(flushSync);
    expect(ribbon()).toBeNull();
    expect(rig.statuses).toEqual(["No AI message yet to re-roll."]);
    unmount(flushSync);
  });
});

describe("ScenePage: the message menu's Writing tools", () => {
  test("the last reply's More menu offers Guided re-roll, which steers the composer", async () => {
    const flushSync = await mount(endsOnReply());
    moreMenu(flushSync, "m3");
    const row = menuRow("Guided re-roll")!;
    expect(rig.host.querySelector('[role="menu"]')!.textContent).toContain("Writing tools");
    click(flushSync, row);
    expect(ribbon()!.textContent).toContain("Steering Vera's last reply");
    expect(box().value).toBe("");
    unmount(flushSync);
  });

  test("a version that was guided offers Edit guided re-roll, with the old instruction ready to change", async () => {
    const flushSync = await mount(endsOnReply("Make her colder."));
    moreMenu(flushSync, "m3");
    expect(menuRow("Guided re-roll")).toBeUndefined();
    click(flushSync, menuRow("Edit guided re-roll")!);
    expect(ribbon()).not.toBeNull();
    expect(box().value).toBe("Make her colder.");
    await submit(flushSync);
    expect(rig.turns).toEqual([{ kind: "swipe", guidance: "Make her colder." }]);
    unmount(flushSync);
  });

  test("a reply with messages beneath it is refused with RoleCall's Branch Required line, and nothing steers", async () => {
    const flushSync = await mount(endsOnYou());
    moreMenu(flushSync, "m3");
    click(flushSync, menuRow("Guided re-roll")!);
    expect(ribbon()).toBeNull();
    expect(rig.statuses).toEqual([BRANCH_REQUIRED]);
    expect(rig.turns).toEqual([]);
    unmount(flushSync);
  });

  test("the opening greeting has no Writing tools", async () => {
    const flushSync = await mount(endsOnReply());
    moreMenu(flushSync, "m1");
    expect(rig.host.querySelector('[role="menu"]')).not.toBeNull();
    expect(menuRow("Guided re-roll")).toBeUndefined();
    unmount(flushSync);
  });
});
