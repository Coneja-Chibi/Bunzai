/**
 * How the library trackers in the Trackers panel stay true: they read again when a swipe or a regenerate lands on a REAL store (the page publishes the take's version, scene-signals.ts, since the
 * chat's `updatedAt` moves for neither), a slow read never overwrites a newer edit, the controls wait while a reply is being written, a bar writes once on release, a fractional bar is typed, and
 * the failures of linking and of New tracker are said in words.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { trackerSlot } from "../../../../../../core/tracker";
import type { TrackerBody } from "../../../../../../entities/tracker/schema";
import { memoryChatStore } from "../../../../../../stage/store/chat-store";
import { sceneTrackers, type SceneTrackers } from "../../../../../../studio/scene-trackers";
import { installDom, type InstalledDom } from "../../../../../_shared/test-dom";
import { mounted, type Mounted } from "../../../props/story-director/fake-director-ui-rig";
import { publishSceneSignals } from "../../../scene-signals";
import { chat, health, setup, trackersAt, type Rig } from "./fake-library-rig";
import { WAITING } from "./use-library-trackers";
import { MessengerTrackersPanel } from "./trackers-panel";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8342/", extraGlobals: ["SVGElement", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement", "HTMLElement"], globals: { requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(cb, 0) } }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; publishSceneSignals("chat1", { version: 0, running: false }); });

const part = (name: string, key?: string): HTMLElement | null => m!.host.querySelector<HTMLElement>(`[data-part="${name}"]${key === undefined ? "" : `[data-field="${key}"]`}`);
const press = async (name: string): Promise<void> => { await m!.click(part(name)); };
const mount = async (r: Rig, linked = ["health"]): Promise<void> => {
  m = await mounted(dom, <MessengerTrackersPanel ctx={r.rig.ctx} chat={chat(linked)} id="messenger.trackers" ids={[]} />);
  await m.until(() => part("scene.messenger.trackers.library.health") !== null);
};
const hpShown = (): string => part("scene.messenger.trackers.library.health")?.querySelector(".msn-lib-v")?.textContent ?? "";

describe("staying true after the take moves", () => {
  test("a swipe and a regenerate on a real store reach the cards, though the chat's updatedAt moves for neither", async () => {
    const chats = memoryChatStore(() => 1_000);
    const made = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } });
    await chats.setPrompting(made.id, { trackers: ["health"] });
    const branch = made.activeBranchId;
    await chats.appendMessage(branch, { role: "user", content: "hi" });
    const slot = trackerSlot("health", health);
    const turn = async (target: Parameters<typeof chats.beginTurn>[1], hp: number) => {
      const open = await chats.beginTurn(branch, target);
      await chats.saveCheckpoint(open!.id, { content: "t", deltas: [{ slot, path: ["hp"], value: hp, at: 1 }] });
      return (await chats.commitTurn(open!.id, { content: "t" }))!;
    };
    const reply = await turn({ kind: "reply" }, 7);
    const held = (await chats.getChat(made.id))!;
    /** What the page holds as `scene.branchVersion` after it reads the scene again: the store's own version. */
    const publish = async (): Promise<void> => {
      const version = (await chats.readMessagesBefore(branch, { limit: 1, liveOnly: true })).branchVersion!;
      m!.flush(() => publishSceneSignals(made.id, { version, running: false }));
      await m!.tick();
    };
    const r = setup();
    Object.assign(r.rig.ctx.api, { getSceneTrackers: async () => (await sceneTrackers(chats, async (id) => (id === "health" ? health : null), (await chats.getChat(made.id))!))! });
    m = await mounted(dom, <MessengerTrackersPanel ctx={r.rig.ctx} chat={held} id="messenger.trackers" ids={[]} />);
    await m.until(() => hpShown() === "7/20");

    await turn({ kind: "swipe", messageId: reply.id }, 3); // a regenerate: a new version of the reply, now shown
    expect((await chats.getChat(made.id))!.updatedAt).toBe(held.updatedAt);
    await publish();
    await m.until(() => hpShown() === "3/20");

    await chats.selectSwipe(reply.id, 0); // a swipe back to the first version
    expect((await chats.getChat(made.id))!.updatedAt).toBe(held.updatedAt);
    await publish();
    await m.until(() => hpShown() === "7/20");
  });

  test("a read that started before an edit, or before a newer read, never overwrites it", async () => {
    const r = setup();
    const pending: ((data: SceneTrackers) => void)[] = [];
    let first = true;
    Object.assign(r.rig.ctx.api, { getSceneTrackers: () => (first ? ((first = false), Promise.resolve(trackersAt(7))) : new Promise<SceneTrackers>((resolve) => { pending.push(resolve); })) });
    await mount(r);
    await press("scene.messenger.trackers.library.open.health");
    m!.flush(() => publishSceneSignals("chat1", { version: 1, running: false })); // a slow read begins
    await m!.tick();
    expect(pending).toHaveLength(1);
    r.answer = trackersAt(12); // the person edits while it is out
    const input = part("scene.messenger.trackers.edit", "gold")!.querySelector("input")!;
    await m!.type(input, "5");
    m!.flush(() => input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await m!.tick();
    expect(r.edits).toHaveLength(1);
    pending[0]!(trackersAt(7)); // the slow read lands, older than the edit
    await m!.tick();
    await m!.click(m!.button("Back to trackers"));
    expect(pending).toHaveLength(2); // the dropped read is replaced by one fresh read, started after the edit
    pending[1]!(trackersAt(12));
    await m!.tick();
    expect(hpShown()).toBe("12/20");
    // and of two reads, only the newer is heard
    m!.flush(() => publishSceneSignals("chat1", { version: 2, running: false }));
    m!.flush(() => publishSceneSignals("chat1", { version: 3, running: false }));
    await m!.tick();
    expect(pending).toHaveLength(4);
    pending[3]!(trackersAt(15));
    await m!.tick();
    pending[2]!(trackersAt(1));
    await m!.tick();
    expect(hpShown()).toBe("15/20");
  });
});

describe("an edit that overlaps a swipe", () => {
  test("a read dropped because of an edit is followed by a fresh read, so what is shown is a read that started after the last write", async () => {
    const r = setup();
    const reads: ((data: SceneTrackers) => void)[] = [];
    let first = true;
    Object.assign(r.rig.ctx.api, { getSceneTrackers: () => (first ? ((first = false), Promise.resolve(trackersAt(7))) : new Promise<SceneTrackers>((resolve) => { reads.push(resolve); })) });
    let landEdit!: () => void;
    Object.assign(r.rig.ctx.api, { editSceneTracker: () => new Promise<SceneTrackers>((resolve) => { landEdit = () => resolve(trackersAt(7)); }) });
    await mount(r);
    await press("scene.messenger.trackers.library.open.health");
    const input = part("scene.messenger.trackers.edit", "gold")!.querySelector("input")!;
    await m!.type(input, "5");
    m!.flush(() => input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await m!.tick(); // the edit is out: the server has it
    m!.flush(() => publishSceneSignals("chat1", { version: 9, running: false })); // a swipe: a read starts while the edit is still out
    await m!.tick();
    expect(reads).toHaveLength(1);
    landEdit(); // the edit settles with pre-swipe values
    await m!.tick();
    reads[0]!(trackersAt(3)); // the read that began before the edit landed arrives: dropped
    await m!.tick();
    expect(reads).toHaveLength(2); // one fresh read is owed and made
    reads[1]!(trackersAt(3));
    await m!.tick();
    await m!.click(m!.button("Back to trackers"));
    expect(hpShown()).toBe("3/20");
  });
});

describe("while a reply is being written", () => {
  test("the edit controls are disabled with a plain line saying so, nothing is sent, and they wake when the reply lands", async () => {
    const r = setup();
    await mount(r);
    await press("scene.messenger.trackers.library.open.health");
    m!.flush(() => publishSceneSignals("chat1", { version: 0, running: true }));
    await m!.tick();
    expect(part("scene.messenger.trackers.library.waiting")!.textContent).toBe(WAITING);
    expect(part("scene.messenger.trackers.edit", "gold")!.hasAttribute("disabled")).toBe(true);
    expect(r.edits).toEqual([]);
    m!.flush(() => publishSceneSignals("chat1", { version: 0, running: false }));
    await m!.tick();
    expect(part("scene.messenger.trackers.library.waiting")).toBeNull();
    expect(part("scene.messenger.trackers.edit", "gold")!.hasAttribute("disabled")).toBe(false);
  });
});

describe("a bar", () => {
  const range = (): HTMLInputElement => part("scene.messenger.trackers.edit", "hp")!.querySelector<HTMLInputElement>("input[type=range]")!;

  test("follows the hand while it is dragged and writes once, on release, with the last value", async () => {
    const r = setup();
    await mount(r);
    await press("scene.messenger.trackers.library.open.health");
    m!.flush(() => range().dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })));
    for (const v of ["8", "9", "10", "11"]) await m!.type(range(), v);
    expect(range().value).toBe("11"); // it moved with the hand
    expect(r.edits).toEqual([]); // and wrote nothing
    m!.flush(() => range().dispatchEvent(new dom.window.Event("pointerup", { bubbles: true })));
    await m!.tick();
    expect(r.edits.map((e) => e.update)).toEqual([{ set: { hp: 11 } }]);
  });

  test("a drag cancelled by a touch scroll, or ended by losing focus, writes the shown value as a release does", async () => {
    for (const ending of ["pointercancel", "blur"]) {
      const r = setup();
      await mount(r);
      await press("scene.messenger.trackers.library.open.health");
      m!.flush(() => range().dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })));
      await m!.type(range(), "14");
      expect(r.edits).toEqual([]);
      m!.flush(() => range().dispatchEvent(new dom.window.Event(ending === "blur" ? "focusout" : ending, { bubbles: true })));
      await m!.tick();
      expect(r.edits.map((e) => e.update), ending).toEqual([{ set: { hp: 14 } }]);
      m!.unmount();
      m = null;
    }
  });

  test("a drag that ends with nothing moved writes nothing and leaves the bar where it was", async () => {
    const r = setup();
    await mount(r);
    await press("scene.messenger.trackers.library.open.health");
    m!.flush(() => range().dispatchEvent(new dom.window.Event("pointerdown", { bubbles: true })));
    m!.flush(() => range().dispatchEvent(new dom.window.Event("pointercancel", { bubbles: true })));
    await m!.tick();
    expect(r.edits).toEqual([]);
    expect(range().value).toBe("7");
  });

  test("a key step or a typed value writes when it is made", async () => {
    const r = setup();
    await mount(r);
    await press("scene.messenger.trackers.library.open.health");
    await m!.type(range(), "9");
    expect(r.edits.map((e) => e.update)).toEqual([{ set: { hp: 9 } }]);
  });

  test("over fractions is typed, not dragged, so any value can be set", async () => {
    const r = setup();
    const fractional: TrackerBody = { name: "Mana", description: "", layout: "record", note: "", fields: [{ name: "mana", description: "", type: "number", min: 0, max: 2.5, default: 1 }] };
    Object.assign(r.rig.ctx.api, { getSceneTrackers: async () => ({ ...trackersAt(), trackers: [{ id: "health", body: fractional, value: { mana: 1.25 }, last: null }] }) });
    await mount(r);
    await press("scene.messenger.trackers.library.open.health");
    const field = part("scene.messenger.trackers.edit", "mana")!;
    expect(field.querySelector("input[type=range]")).toBeNull();
    const input = field.querySelector("input")!;
    await m!.type(input, "0.37");
    m!.flush(() => input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    await m!.tick();
    expect(r.edits.map((e) => e.update)).toEqual([{ set: { mana: 0.37 } }]);
  });
});

describe("the pick pane's failures", () => {
  const openPick = async (r: Rig): Promise<void> => {
    await mount(r);
    await press("scene.messenger.trackers.pick.open");
    await m!.until(() => part("scene.messenger.trackers.pick.hull") !== null);
  };

  test("a link that cannot be saved is said in words and the list stays as it was", async () => {
    const r = setup();
    Object.assign(r.rig.ctx.api, { setScenePrompting: async () => { throw new Error("The scene could not be saved."); } });
    await openPick(r);
    await press("scene.messenger.trackers.pick.hull");
    await m!.until(() => m!.host.querySelector("[role=alert]") !== null);
    expect(m!.host.querySelector("[role=alert]")!.textContent).toBe("The scene could not be saved.");
    expect(part("scene.messenger.trackers.pick.hull")!.getAttribute("aria-pressed")).toBe("false");
    expect(part("scene.messenger.trackers.pick.hull")!.hasAttribute("disabled")).toBe(false); // free to try again
  });

  test("a New tracker that cannot be made is said in words and opens nothing", async () => {
    const r = setup();
    Object.assign(r.rig.ctx.api, { saveEntity: async () => { throw new Error("The library refused it."); } });
    await openPick(r);
    await m!.click(m!.button("New tracker"));
    await m!.until(() => m!.host.querySelector("[role=alert]") !== null);
    expect(m!.host.querySelector("[role=alert]")!.textContent).toBe("The library refused it.");
    expect(r.opened).toEqual([]);
    expect(r.apps).toEqual([]);
  });
});

describe("the summary", () => {
  test("counts only the trackers that draw: one the server left out is not counted", async () => {
    const r = setup();
    Object.assign(r.rig.ctx.api, { getSceneTrackers: async () => trackersAt() }); // two linked below, both draw
    m = await mounted(dom, <MessengerTrackersPanel ctx={r.rig.ctx} chat={chat(["health", "satchel", "gone"])} id="messenger.trackers" ids={[]} />);
    await m.until(() => part("scene.messenger.trackers.library.health") !== null);
    expect(part("scene.messenger.trackers.summary")!.textContent).toContain("2 on");
  });
});
