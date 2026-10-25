/**
 * The draft tools mounted on the scene page, where RoleCall puts them: the "+" menu's Expand as character (with
 * the inline 1ST / 2ND / 3RD pill), Polish Input and Correct, and the message menu's Writing tools > Expand as
 * character and Correct. Expand fills the composer and never writes the scene; Correct from a message edits
 * that message in place (the shown version, through the scene's edit route). The scripted page is
 * fake-scene-page-rig.ts.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { box, click, endsOnReply, installRigDom, menuRow, mount, resetRig, rig, settle, toolsButton, type, unmount, type FlushSync } from "./fake-scene-page-rig";

beforeAll(installRigDom);
beforeEach(resetRig);

const strip = (): HTMLElement | null => rig.host.querySelector('[data-part="scene.composer.draft"]');
const pill = (label: string): HTMLButtonElement => [...rig.host.querySelectorAll<HTMLButtonElement>(".ds-pill button")].find((b) => b.textContent === label)!;
const moreMenu = (flushSync: FlushSync, messageId: string): void => click(flushSync, rig.host.querySelector(`[data-mid="${messageId}"] [aria-label="More message actions"]`)!);
const itemIn = (messageId: string, label: string): HTMLButtonElement | undefined =>
  [...rig.host.querySelectorAll<HTMLButtonElement>(`[data-mid="${messageId}"] [role="menuitem"]`)].find((b) => b.textContent === label);
const dialog = (): Element | null => rig.dom.window.document.querySelector('[data-part="scene.correct"]');
const dialogButton = (label: string): HTMLButtonElement => [...rig.dom.window.document.querySelectorAll<HTMLButtonElement>('[data-part="scene.correct"] button')].find((b) => b.textContent?.trim() === label)!;

describe("the + menu", () => {
  test("offers Expand as character under Write in character with the pill, Polish Input under Input, and Correct under Change the reply, in RoleCall's words", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    const sections = [...rig.host.querySelectorAll('[data-part="scene.composer.tools"] [role="group"]:not(.ds-pill)')].map((g) => g.getAttribute("aria-label"));
    expect(sections).toEqual(["Change the reply", "Write in character", "Input", "Debug"]);
    expect(menuRow("Expand as character")!.textContent).toContain("turn your outline into a full in-character message");
    expect(menuRow("Polish Input")!.textContent).toContain("spellcheck what you typed");
    expect(menuRow("Correct")!.textContent).toContain("fix last AI message in place");
    expect([...rig.host.querySelectorAll(".ds-pill button")].map((b) => b.textContent)).toEqual(["1ST", "2ND", "3RD"]);
    unmount(flushSync);
  });

  test("a pill segment sends the composer's text as the outline with that perspective, fills the composer, and closes the menu; nothing is sent to the scene", async () => {
    const flushSync = await mount(endsOnReply());
    type(flushSync, "ask about storms");
    click(flushSync, toolsButton()!);
    click(flushSync, pill("3RD"));
    await settle(flushSync);
    expect(rig.drafts).toEqual([{ chatId: "chat1", kind: "impersonate", brief: "ask about storms", perspective: "3rd" }]);
    expect(box().value).toBe("I step into the rain.");
    expect(strip()!.textContent).toContain("Writing as User");
    expect(menuRow("Polish Input")).toBeUndefined();
    expect(rig.sent).toEqual([]);
    expect(rig.turns).toEqual([]);
    expect(rig.edits).toEqual([]);
    unmount(flushSync);
  });

  test("the row itself picks 1st person, and an empty composer is allowed", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Expand as character")!);
    await settle(flushSync);
    expect(rig.drafts).toEqual([{ chatId: "chat1", kind: "impersonate", brief: "", perspective: "1st" }]);
    unmount(flushSync);
  });

  test("Polish Input replaces the text with the polished one and offers Revert", async () => {
    const flushSync = await mount(endsOnReply());
    type(flushSync, "i walks in");
    rig.draftAnswer = "I walk in.";
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Polish Input")!);
    await settle(flushSync);
    expect(rig.drafts).toEqual([{ chatId: "chat1", kind: "polish", text: "i walks in" }]);
    expect(box().value).toBe("I walk in.");
    const revert = [...strip()!.querySelectorAll("button")].find((b) => b.textContent === "Revert")!;
    click(flushSync, revert);
    expect(box().value).toBe("i walks in");
    unmount(flushSync);
  });

  test("Polish Input with nothing typed says so and asks nothing", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Polish Input")!);
    await settle(flushSync);
    expect(rig.drafts).toEqual([]);
    expect(strip()!.textContent).toContain("Type something first to polish.");
    unmount(flushSync);
  });

  test("Correct opens Correction Tools on the last reply; Apply edits that version in place", async () => {
    const flushSync = await mount(endsOnReply());
    click(flushSync, toolsButton()!);
    click(flushSync, menuRow("Correct")!);
    await settle(flushSync);
    expect(dialog()!.textContent).toContain("Correction Tools");
    rig.draftAnswer = "The lamp swung.";
    click(flushSync, dialogButton("Run Spellcheck"));
    await settle(flushSync);
    expect(rig.drafts).toEqual([{ chatId: "chat1", kind: "spellcheck", text: "The lamp swings," }]);
    click(flushSync, dialogButton("Apply"));
    await settle(flushSync);
    expect(rig.edits).toEqual([{ messageId: "m3", swipeId: "m3-s1", content: "The lamp swung.", expectedVersion: 1 }]);
    expect(dialog()).toBeNull();
    unmount(flushSync);
  });
});

describe("the message menu", () => {
  test("Writing tools holds Expand as character on a reply, which opens expand mode without calling the model or using the message", async () => {
    const flushSync = await mount(endsOnReply());
    type(flushSync, "keep me");
    moreMenu(flushSync, "m3");
    click(flushSync, itemIn("m3", "Expand as character")!);
    await settle(flushSync);
    expect(rig.drafts).toEqual([]);
    expect(strip()!.textContent).toContain("Type an outline, then pick a perspective to expand.");
    expect(box().value).toBe("keep me");
    click(flushSync, pill("2ND"));
    await settle(flushSync);
    expect(rig.drafts).toEqual([{ chatId: "chat1", kind: "impersonate", brief: "keep me", perspective: "2nd" }]);
    unmount(flushSync);
  });

  test("a message of yours has no Expand as character, but has Correct", async () => {
    const flushSync = await mount(endsOnReply());
    moreMenu(flushSync, "m2");
    expect(itemIn("m2", "Expand as character")).toBeUndefined();
    expect(itemIn("m2", "Correct")).toBeDefined();
    unmount(flushSync);
  });

  test("Correct on an older reply opens that message and Apply edits that message in place", async () => {
    const flushSync = await mount(endsOnReply());
    moreMenu(flushSync, "m1");
    click(flushSync, itemIn("m1", "Correct")!);
    await settle(flushSync);
    rig.draftAnswer = "Hello there.";
    click(flushSync, dialogButton("Run Spellcheck"));
    await settle(flushSync);
    expect(rig.drafts[0]).toMatchObject({ kind: "spellcheck", text: "Hello." });
    click(flushSync, dialogButton("Apply"));
    await settle(flushSync);
    expect(rig.edits).toEqual([{ messageId: "m1", swipeId: "m1-s1", content: "Hello there.", expectedVersion: 1 }]);
    unmount(flushSync);
  });
});
