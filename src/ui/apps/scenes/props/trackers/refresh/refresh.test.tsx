/**
 * Refresh from chat history as it mounts: the strip button on a tracker frame (Inventory stands for all of them), its review sheet, Accept with Undo, Discard, a failure, the
 * skipped line, Cancel, and a chat switch; then Refresh Enabled Boards over two boards with progress, Cancel, the combined sheet, Accept all, and a board's own Undo.
 * The scene is a fake that answers setSceneTracker the way the store does and proposeTrackerRefresh from a queue the test controls.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import { refreshSpecOf } from "../../../../../../core/trackers";
import { DEFAULT_INVENTORY, applyInventory, type Inventory } from "../../../../../../core/trackers/inventory";
import { diffModule } from "../../../../../../core/trackers/refresh";
import type { Chat, ChatTrackerPatch, TrackerModule } from "../../../../../../stage/contracts/chat-store";
import type { TrackerRefresh, TrackerRefreshInput } from "../../../../../../studio/scene-tracker-refresh";
import { forgetTrackerStates } from "../tracker-states";
import { heldTrackerApi, type HeldStates } from "../items/held-tracker-api";
import type { AppContext } from "../../../../../app-contract";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { InventoryPanel } from "../inventory/inventory-panel";
import { RefreshAllBox } from "./refresh-all";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8337/", extraGlobals: ["SVGElement", "Event", "HTMLElement", "KeyboardEvent"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } });
  dom = installed.dom;
});
const roots: Root[] = [];
// Unmount every root before the DOM goes, so nothing fires after teardown.
afterAll(async () => {
  const { flushSync } = await import("react-dom");
  for (const r of roots.splice(0)) flushSync(() => r.unmount());
  await installed.teardown();
});

type Answer = TrackerRefresh | Error | { wait: Promise<TrackerRefresh> };
let writes: { module: TrackerModule; patch: ChatTrackerPatch }[] = [];
let asked: TrackerRefreshInput[] = [];
let answers: Answer[] = [];
let chat: Chat;
afterEach(async () => {
  const { flushSync } = await import("react-dom");
  for (const r of roots.splice(0)) flushSync(() => r.unmount());
  dom.window.document.body.replaceChildren();
});
let held: HeldStates = {};
beforeEach(() => { installed.reinstall(); bases.length = 0; writes = []; asked = []; answers = []; held = {}; chat = { id: "c1", activeBranchId: "b1" } as Chat; });

const bases: (unknown | undefined)[] = [];
const tracked = heldTrackerApi(() => held, (module, data, base) => { writes.push({ module, patch: { data } }); bases.push(base); });
const ctx = (): AppContext => ({
  prefs: { get: () => undefined, set: () => undefined },
  pieces: tracked.pieces,
  api: {
    ...tracked.api,
    proposeTrackerRefresh: (input: TrackerRefreshInput, signal?: AbortSignal): Promise<TrackerRefresh> => {
      asked.push(input);
      const next = answers.shift();
      if (next instanceof Error) return Promise.reject(next);
      if (next && "wait" in next) {
        return new Promise((resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")));
          void next.wait.then(resolve);
        });
      }
      return Promise.resolve(next!);
    },
  },
} as unknown as AppContext);

type FlushSync = typeof import("react-dom")["flushSync"];
let root: Root;
let host: HTMLElement;
let flush: FlushSync;
const settle = async (ms = 15): Promise<void> => { await new Promise((r) => setTimeout(r, ms)); flush(() => undefined); };
const body = (): string => dom.window.document.body.textContent ?? "";
const all = (): HTMLButtonElement[] => [...dom.window.document.body.querySelectorAll("button")];
const by = (label: string): HTMLButtonElement | undefined => all().find((b) => b.getAttribute("aria-label") === label || b.title === label || b.textContent?.trim() === label);
const press = async (b: HTMLButtonElement | undefined): Promise<void> => { if (!b) throw new Error("no such button"); flush(() => b.click()); await settle(); };
const part = (name: string): Element | null => dom.window.document.body.querySelector(`[data-part="${name}"]`);

async function mount(node: JSX.Element): Promise<void> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  flush = flushSync;
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  roots.push(root);
  flush(() => root.render(node));
  await settle();
}
const rerender = async (node: JSX.Element): Promise<void> => { flush(() => root.render(node)); await settle(); };

const item = (name: string, over: Record<string, unknown> = {}) => ({ name, description: "", category: "misc" as const, rarity: "common" as const, quantity: 1, ...over });
const stocked: Inventory = applyInventory(DEFAULT_INVENTORY, { kind: "add", item: item("Matches", { quantity: 6 }), id: "m1", at: 1 });
let n = 0;
/** What the server would answer: the module's own next state for `answer`, with its diff. */
function proposal(module: TrackerModule, before: unknown, answer: Record<string, unknown>, chatId = "c1", skipped: TrackerRefresh["skipped"] = []): TrackerRefresh {
  const spec = refreshSpecOf(module)!;
  const proposed = spec.next(before, answer, { id: () => `n${++n}`, now: 9, skipped: [] });
  return { chatId, module, proposed, diff: diffModule(spec, before, proposed), skipped };
}
const seed = (module: TrackerModule, data: unknown): void => { forgetTrackerStates(); held[module] = data as never; };
const panel = (c: Chat = chat): JSX.Element => <InventoryPanel ctx={ctx()} chat={c} onChat={(next) => { chat = next; }} id="props.tracker.inventory" />;
const answer = { items: [item("Matches", { quantity: 2 }), item("Torn page")], currency: 3 };

describe("the strip button", () => {
  test("it reads Refresh, carries RoleCall's tooltip and part, and asks for this scene and this module", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer));
    await mount(panel());
    const b = by("Refresh from chat history")!;
    expect(b.textContent).toBe("Refresh");
    expect(b.title).toBe("Refresh from chat history");
    expect(b.getAttribute("data-part")).toBe("props.tracker.refresh");
    await press(b);
    expect(asked).toEqual([{ chatId: "c1", module: "inventory" }]);
  });

  test("while it reads, the button is busy and off, the panel says what it is doing and offers Cancel", async () => {
    seed("inventory", stocked);
    let release!: (p: TrackerRefresh) => void;
    answers.push({ wait: new Promise<TrackerRefresh>((r) => { release = r; }) });
    await mount(panel());
    await press(by("Refresh from chat history"));
    const busy = by("Refreshing Inventory")!;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(body()).toContain("Refreshing Inventory...");
    expect(body()).toContain("Reading the chat for Inventory.");
    expect(by("Cancel")).toBeDefined();
    release(proposal("inventory", stocked, answer));
    await settle();
    expect(part("props.tracker.review")).not.toBeNull();
  });
});

describe("the review sheet", () => {
  test("it lists what was added, changed and removed, and Accept writes the proposed state through apply, with the frame's Undo", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, { items: [item("Torn page")], currency: 3 }));
    await mount(panel());
    await press(by("Refresh from chat history"));
    expect(body()).toContain("Refresh Inventory: review");
    expect(part("props.tracker.review.added")?.textContent).toContain("Torn page");
    expect(part("props.tracker.review.changed")?.textContent).toContain("Currency");
    expect(part("props.tracker.review.removed")?.textContent).toContain("Matches");
    expect(writes).toHaveLength(0);
    await press(by("Accept"));
    expect(writes).toHaveLength(1);
    const kept = writes[0]!.patch.data as unknown as Inventory;
    expect(kept.items.find((i) => i.name === "Matches")?.removedAt).toBe(9);
    expect(kept.items.find((i) => i.name === "Torn page")).toBeDefined();
    expect(part("props.tracker.review")).toBeNull();
    expect(body()).toContain("Refreshed from chat history");
    await press(by("Undo"));
    expect(writes).toHaveLength(2);
    expect(writes[1]!.patch.data).toEqual(stocked as never);
  });

  test("Discard writes nothing and closes the sheet", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer));
    await mount(panel());
    await press(by("Refresh from chat history"));
    await press(by("Discard"));
    expect(part("props.tracker.review")).toBeNull();
    expect(writes).toHaveLength(0);
  });

  test("Try again asks once more with the same window and replaces the proposal", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer), proposal("inventory", stocked, { items: [item("Matches", { quantity: 6 }), item("Lantern")], currency: 0 }));
    await mount(panel());
    await press(by("Refresh from chat history"));
    await press(by("Try again"));
    expect(asked).toHaveLength(2);
    expect(part("props.tracker.review.added")?.textContent).toContain("Lantern");
    expect(part("props.tracker.review.added")?.textContent).not.toContain("Torn page");
  });

  test("an item the model's answer lost is said on the sheet, with its reason", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer, "c1", [{ name: "Ghost", reason: "a field it needs is missing or unreadable" }]));
    await mount(panel());
    await press(by("Refresh from chat history"));
    expect(part("props.tracker.review.skipped")?.textContent).toBe("1 item skipped: Ghost (a field it needs is missing or unreadable)");
  });

  test("an answer that changes nothing shows no sheet, only a line", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, { items: [item("Matches", { quantity: 6 })] }));
    await mount(panel());
    await press(by("Refresh from chat history"));
    expect(part("props.tracker.review")).toBeNull();
    expect(body()).toContain("Inventory already matches the chat.");
  });
});

describe("it fails closed", () => {
  test("a failed ask says why, writes nothing, and offers Try again", async () => {
    seed("inventory", stocked);
    answers.push(new Error("the provider returned a gateway timeout (502)"));
    await mount(panel());
    await press(by("Refresh from chat history"));
    const alert = dom.window.document.querySelector("[role=alert]")!;
    expect(alert.textContent).toContain("Refresh failed. the provider returned a gateway timeout (502)");
    expect(alert.textContent).toContain("Inventory is unchanged.");
    expect(writes).toHaveLength(0);
    expect(by("Try again")).toBeDefined();
  });

  test("Cancel stops the read, says so, and a late answer is ignored", async () => {
    seed("inventory", stocked);
    let release!: (p: TrackerRefresh) => void;
    answers.push({ wait: new Promise<TrackerRefresh>((r) => { release = r; }) });
    await mount(panel());
    await press(by("Refresh from chat history"));
    await press(by("Cancel"));
    expect(body()).toContain("Refresh cancelled. Inventory is unchanged.");
    release(proposal("inventory", stocked, answer));
    await settle();
    expect(part("props.tracker.review")).toBeNull();
    expect(writes).toHaveLength(0);
  });

  test("switching scenes drops a held proposal", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer));
    await mount(panel());
    await press(by("Refresh from chat history"));
    expect(part("props.tracker.review")).not.toBeNull();
    await rerender(panel({ id: "c2" } as Chat));
    expect(part("props.tracker.review")).toBeNull();
    expect(writes).toHaveLength(0);
  });

  test("an answer read for another scene is dropped, and Accept on one that went stale writes nothing", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer, "c9"));
    await mount(panel());
    await press(by("Refresh from chat history"));
    expect(dom.window.document.querySelector("[role=alert]")?.textContent).toContain("read for another scene");
    expect(part("props.tracker.review")).toBeNull();
    answers.push(proposal("inventory", stocked, answer));
    await press(by("Try again"));
    expect(part("props.tracker.review")).not.toBeNull();
    const moved = applyInventory(stocked, { kind: "currency", amount: 77 });
    seed("inventory", moved);
    await rerender(panel({ ...chat }));
    await press(by("Accept"));
    expect(dom.window.document.querySelector("[role=alert]")?.textContent).toContain("changed while it was waiting for review");
    expect(writes).toHaveLength(0);
  });
});

describe("Refresh Enabled Boards", () => {
  const boards = [{ module: "inventory" as const, label: "Inventory" }, { module: "resources" as const, label: "Stats" }];
  const resourcesAnswer = (hp = 40) => proposal("resources", undefined, { hp });
  const box = (b = boards, c: Chat = chat): JSX.Element => <RefreshAllBox host={{ ctx: ctx(), chat: c, onChat: (next) => { chat = next; } }} boards={b} />;

  test("with no board on it is off and says why", async () => {
    await mount(box([]));
    expect((by("Refresh Enabled Boards") as HTMLButtonElement).disabled).toBe(true);
    expect(body()).toContain("No board is on. Turn one on to refresh it.");
  });

  test("it reads the boards one after another, showing Refreshing {label} (i/n), then opens one sheet", async () => {
    seed("inventory", stocked);
    let release!: (p: TrackerRefresh) => void;
    answers.push({ wait: new Promise<TrackerRefresh>((r) => { release = r; }) }, resourcesAnswer());
    await mount(box());
    await press(by("Refresh Enabled Boards"));
    expect(body()).toContain("Refreshing Inventory (1/2)");
    expect(dom.window.document.body.querySelector("[role=progressbar]")?.getAttribute("aria-valuemax")).toBe("2");
    expect(asked.map((a) => a.module)).toEqual(["inventory"]);
    release(proposal("inventory", stocked, answer));
    await settle(40);
    expect(asked.map((a) => a.module)).toEqual(["inventory", "resources"]);
    expect(body()).toContain("Refresh Enabled Boards: review");
    expect(writes).toHaveLength(0);
  });

  test("Cancel stops after the board in flight, keeps what was read for review, and says how far it got", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer), { wait: new Promise<TrackerRefresh>(() => undefined) });
    await mount(box());
    await press(by("Refresh Enabled Boards"));
    expect(body()).toContain("Refreshing Stats (2/2)");
    await press(by("Cancel"));
    expect(body()).toContain("Cancelled after 1 of 2.");
    expect(writes).toHaveLength(0);
    await press(by("Review 1"));
    expect(part("props.tracker.review.module.inventory")).not.toBeNull();
  });

  test("Accept all writes every board with changes, a failed board stays failed, and a board's Undo restores it", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer), new Error("rate limited"));
    await mount(box());
    await press(by("Refresh Enabled Boards"));
    await settle(40);
    expect(part("props.tracker.review.module.resources")?.textContent).toContain("Failed");
    expect(part("props.tracker.review.module.resources")?.textContent).toContain("rate limited");
    await press(by("Accept all"));
    expect(writes.map((w) => w.module)).toEqual(["inventory"]);
    expect(part("props.tracker.review.module.inventory")?.textContent).toContain("Accepted");
    await press(by("Undo"));
    expect(writes.at(-1)).toEqual({ module: "inventory", patch: { data: stocked as never } });
    // The restore is the change from what Accept wrote, so a row another writer added after the accept is not overwritten silently.
    expect(bases.at(-1)).toEqual(writes.at(-2)!.patch.data);
  });

  test("a board's own Accept applies that board alone, and a proposal for a tracker that moved is dropped", async () => {
    seed("inventory", stocked);
    answers.push(proposal("inventory", stocked, answer), resourcesAnswer());
    await mount(box());
    await press(by("Refresh Enabled Boards"));
    await settle(40);
    seed("resources", { ...(resourcesAnswer().proposed as object), hp: 1 });
    await rerender(box(boards, chat));
    const accepts = all().filter((b) => b.textContent === "Accept");
    await press(accepts[1]);
    expect(writes).toHaveLength(0);
    expect(part("props.tracker.review.module.resources")?.textContent).toContain("changed while it was reading");
    await press(all().filter((b) => b.textContent === "Accept")[0]);
    expect(writes.map((w) => w.module)).toEqual(["inventory"]);
  });

  test("switching scenes during a run drops it", async () => {
    seed("inventory", stocked);
    answers.push({ wait: new Promise<TrackerRefresh>(() => undefined) });
    await mount(box());
    await press(by("Refresh Enabled Boards"));
    await rerender(box(boards, { id: "c2" } as Chat));
    expect(body()).not.toContain("Refreshing Inventory");
    expect(body()).toContain("Refresh Enabled Boards");
  });
});
