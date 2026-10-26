/**
 * The Branching Tree page (RoleCall app/scenes/branching-tree): the nested list with RoleCall's words, a click that switches the active
 * take and opens it, rename in place, and a delete that is soft (the Trash, with Restore) where RoleCall's is permanent. The api is a
 * stand-in that records what it was asked.
 */
import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { OpenScene, TakeSummary } from "../../../studio/scenes";
import type { TakeComparison } from "../../../studio/scene-take-compare";
import { click, installRigDom, props, rig, settle, type FlushSync } from "./fake-scene-page-rig";
import { BranchTree } from "./scene-tree";

beforeAll(installRigDom);

const take = (id: string, name: string, parent: string | null, extra: Partial<TakeSummary> = {}): TakeSummary => ({
  id, chatId: "chat1", name, parentBranchId: parent, forkMessageId: parent ? "m" : null, forkSwipeId: null, createdAt: Number(id.slice(1)), version: 1, messageCount: 6, forkPosition: parent ? 3 : null, ...extra,
});

let takes: TakeSummary[];
let active: string;
let asked: [string, Record<string, unknown>][];
let restored: [string, string][];
let opened: number;
let leaves: number;
let compared: [string, string][];
let compareResult: TakeComparison;

const scene = (): OpenScene => ({ chat: { id: "chat1", activeBranchId: active }, takes } as unknown as OpenScene);
beforeEach(() => {
  takes = [take("m0", "main", null, { messageCount: 12 }), take("a1", "Take 2", "m0"), take("b2", "Deeper", "a1", { messageCount: 1, forkPosition: null })];
  compared = []; compareResult = { a: { id: "m0", name: "main", messages: 12 }, b: { id: "a1", name: "Take 2", messages: 6 }, shared: 2, rows: [{ a: { id: "x", role: "assistant", text: "The cold came." }, b: { id: "y", role: "assistant", text: "The warm came." } }, { a: null, b: { id: "z", role: "user", text: "Only here." } }], truncated: false };
  active = "m0"; asked = []; restored = []; opened = 0; leaves = 0;
});

const ctx = (): AppContext => ({
  api: {
    openScene: async () => scene(),
    editScene: async (action: string, input: Record<string, unknown>) => {
      asked.push([action, input]);
      if (action === "take") active = String(input["branchId"]);
      if (action === "rename-take") takes = takes.map((t) => (t.id === input["branchId"] ? { ...t, name: String(input["name"]) } : t));
      if (action === "delete-take") takes = takes.filter((t) => t.id !== input["branchId"]);
      return scene();
    },
    restoreSceneGrave: async (kind: string, id: string) => { restored.push([kind, id]); },
    compareTakes: async (_chat: string, a: string, b: string) => {
      compared.push([a, b]);
      return compareResult;
    },
  },
  setStatus: () => undefined,
}) as unknown as AppContext;

async function mount(): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  rig.host = rig.dom.window.document.createElement("div");
  rig.dom.window.document.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  flushSync(() => rig.root.render(createElement(BranchTree, { ctx: ctx(), chatId: "chat1", onBack: () => { leaves++; }, onOpen: () => { opened++; } })));
  await settle(flushSync);
  return flushSync;
}
const text = (): string => rig.host.textContent ?? "";
const rows = (): HTMLElement[] => [...rig.host.querySelectorAll<HTMLElement>(".row")];
const named = (label: string): HTMLButtonElement => [...rig.host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label || b.textContent?.trim() === label)!;
const unmount = (flushSync: FlushSync): void => { flushSync(() => rig.root.unmount()); rig.host.remove(); };

describe("the Branching Tree", () => {
  test("says RoleCall's words and nests each take under the one it forked from, 40px per level, with where it forked", async () => {
    const flushSync = await mount();
    expect(text()).toContain("Branching Tree");
    expect(text()).toContain("Full conversation timeline with all branches");
    expect(rows().map((r) => r.querySelector("b")!.textContent)).toEqual(["Main Timeline", "Take 2", "Deeper"]);
    expect(rows()[0]!.textContent).toContain("Main");
    expect(rows()[0]!.textContent).toContain("12 messages");
    expect(rows()[1]!.textContent).toContain("6 messages · Branched at msg 3");
    expect(rows()[2]!.textContent).toContain("1 message");
    expect(rows().map((r) => r.style.marginLeft)).toEqual(["0px", "40px", "80px"]);
    expect(rows()[0]!.querySelector('[aria-label^="Delete"]')).toBeNull();
    unmount(flushSync);
  });

  test("a click switches the active take and opens it; the take already open just opens", async () => {
    const flushSync = await mount();
    click(flushSync, rows()[1]!.querySelector("[data-control='row']")!);
    await settle(flushSync);
    expect(asked).toEqual([["take", { chatId: "chat1", branchId: "a1" }]]);
    expect(opened).toBe(1);
    click(flushSync, rows()[1]!.querySelector("[data-control='row']")!);
    await settle(flushSync);
    expect(asked).toHaveLength(1);
    expect(opened).toBe(2);
    unmount(flushSync);
  });

  test("rename happens in place and saves on Enter; an unchanged or empty name asks nothing", async () => {
    const flushSync = await mount();
    click(flushSync, named("Rename Take 2"));
    const input = rig.host.querySelector<HTMLInputElement>(".rename")!;
    flushSync(() => props(input)["onChange"]!({ target: { value: "The quiet one" } }));
    flushSync(() => props(input)["onKeyDown"]!({ key: "Enter", nativeEvent: new rig.dom.window.KeyboardEvent("keydown", { key: "Enter" }) }));
    await settle(flushSync);
    expect(asked).toEqual([["rename-take", { chatId: "chat1", branchId: "a1", name: "The quiet one" }]]);
    expect(text()).toContain("The quiet one");
    click(flushSync, named("Rename The quiet one"));
    flushSync(() => props(rig.host.querySelector(".rename")!)["onBlur"]!({}));
    await settle(flushSync);
    expect(asked).toHaveLength(1);
    unmount(flushSync);
  });

  test("delete asks first, then sends the take to the Trash (never for good) and offers Restore", async () => {
    const flushSync = await mount();
    click(flushSync, named("Delete Deeper"));
    expect(rig.dom.window.document.body.textContent).toContain("go to the Trash. You can restore it for 3 days.");
    expect(asked).toEqual([]);
    click(flushSync, [...rig.dom.window.document.querySelectorAll("button")].find((b) => b.textContent === "Delete take")!);
    await settle(flushSync);
    expect(asked).toEqual([["delete-take", { chatId: "chat1", branchId: "b2" }]]);
    expect(text()).toContain("Deeper is in the Trash for 3 days.");
    expect(rows().map((r) => r.querySelector("b")!.textContent)).toEqual(["Main Timeline", "Take 2"]);
    click(flushSync, named("Restore"));
    await settle(flushSync);
    expect(restored).toEqual([["take", "b2"]]);
    unmount(flushSync);
  });

  test("Back leaves for the scene", async () => {
    const flushSync = await mount();
    click(flushSync, named("Back to Scene"));
    expect(leaves).toBe(1);
    unmount(flushSync);
  });
});

describe("Compare takes", () => {
  test("pick one take, then another: the dialog shows what they share and where they differ, word by word; nothing is switched or written", async () => {
    const flushSync = await mount();
    click(flushSync, named("Compare main"));
    expect(text()).toContain("Comparing main. Pick another take.");
    expect(named("Compare main").getAttribute("aria-pressed")).toBe("true");
    click(flushSync, named("Compare Take 2"));
    await settle(flushSync);
    expect(compared).toEqual([["m0", "a1"]]);
    const dialog = rig.dom.window.document.querySelector("[data-part='scene.tree.compare']")!;
    expect(dialog.textContent).toContain("Compare takes");
    expect(dialog.textContent).toContain("2 messages in common");
    expect(dialog.querySelector(".tc-a del")!.textContent).toBe("cold");
    expect(dialog.querySelector(".tc-b ins")!.textContent).toBe("warm");
    expect(dialog.textContent).toContain("No message");
    expect(dialog.textContent).toContain("Only here.");
    expect(asked).toEqual([]);
    unmount(flushSync);
  });
  test("the same take twice cancels the pick, and a comparison that cannot load says why", async () => {
    const flushSync = await mount();
    click(flushSync, named("Compare main"));
    click(flushSync, named("Compare main"));
    expect(text()).not.toContain("Pick another take.");
    const bad = ctx();
    (bad.api as unknown as { compareTakes(): Promise<never> }).compareTakes = async () => { throw new Error("that take is gone"); };
    flushSync(() => rig.root.render(createElement(BranchTree, { ctx: bad, chatId: "chat1", onBack: () => undefined, onOpen: () => undefined })));
    await settle(flushSync);
    click(flushSync, named("Compare main"));
    click(flushSync, named("Compare Take 2"));
    await settle(flushSync);
    expect(rig.dom.window.document.querySelector("[data-part='scene.tree.compare'] [role=alert]")!.textContent).toBe("that take is gone");
    unmount(flushSync);
  });
});
