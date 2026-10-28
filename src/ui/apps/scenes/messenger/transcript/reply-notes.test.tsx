/**
 * What the Messenger draws under a reply (wireframe premiere/scene-pieces.html, section 3, option D, and 3f): each tracker's changes in its OWN style (chips, card, toast marker, hidden), the scene
 * switch turning all of it off, one read for the whole range and a new one when the take's version moves (a swipe shows that version's changes), the toast only for a reply that just landed live,
 * the chip opening the tracker in the panel, and the out-of-time line from the reply's generation.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { Chat, Generation, Message } from "../../../../../stage/contracts/chat-store";
import type { MessageTrackerChanges, TrackerChanged } from "../../../../../studio/tracker-changes";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import type { AppContext } from "../../../../app-contract";
import { mounted, type Mounted } from "../../props/story-director/fake-director-ui-rig";
import type { Row } from "../../scene-page-types";
import { publishSceneSignals } from "../../scene-signals";
import { PROGRAM_OPEN_EVENT } from "../program-open";
import { takeTrackerOpen, useRequestedTracker } from "../panels/trackers/open-tracker";
import { memoryChatStore } from "../../../../../stage/store/chat-store";
import { trackerSlot } from "../../../../../core/tracker";
import type { TrackerBody } from "../../../../../entities/tracker/schema";
import { trackerChangesBetween } from "../../../../../studio/tracker-changes";
import type { CommittedTurn } from "../../use-scene-turn";
import { useReplyNotes } from "./use-reply-notes";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8352/", extraGlobals: ["SVGElement", "Event", "CustomEvent", "MouseEvent", "KeyboardEvent"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => { installed.reinstall(); rowsNow = ROWS; committedNow = null; });
afterEach(() => { m?.unmount(); m = null; publishSceneSignals("chat1", { version: 0, running: false }); takeTrackerOpen("chat1"); });

/** A message with `versions` swipes, the last one showing; each swipe is named `<id>-s<index>`. */
const msg = (id: string, role: "user" | "assistant", versions = 1): Message => ({ id, role, swipes: Array.from({ length: versions }, (_, i) => ({ id: `${id}-s${i}` })), current: Math.max(0, versions - 1) }) as unknown as Message;
const rowsOf = (m3Versions: number, ...extra: Row[]): Row[] => [{ kind: "msg", m: msg("m1", "assistant"), n: 1 }, { kind: "msg", m: msg("m2", "user"), n: 2 }, { kind: "msg", m: msg("m3", "assistant", m3Versions), n: 3 }, ...extra];
const ROWS: Row[] = rowsOf(1);
/** The rows the page holds now: a test changes them, then publishes the signals so the hook renders again with them. */
let rowsNow: Row[] = ROWS;
/** What the turn's own done or stopped event named, as the page hands it in. */
let committedNow: CommittedTurn | null = null;
const chatOf = (over: Record<string, unknown> = {}): Chat => ({ id: "chat1", activeBranchId: "b1", prompting: { trackers: ["health", "satchel"], ...over } }) as unknown as Chat;

const health = (style: TrackerChanged["style"]): TrackerChanged => ({
  trackerId: "health", name: "Health", style, icon: "lucide:star", bars: { hp: { min: 0, top: 20 } },
  changes: [{ field: "hp", before: 10, after: 7 }, { field: "mood", before: "calm", after: "hurt" }],
});
const satchel = (style: TrackerChanged["style"]): TrackerChanged => ({ trackerId: "satchel", name: "Satchel", style, changes: [{ row: "rope", before: null, after: { qty: 1 }, added: true }] });
const at = (messageId: string, ...trackers: TrackerChanged[]): MessageTrackerChanges => ({ messageId, trackers });

const FAIL: MessageTrackerChanges[] = [];
interface Rig { gate: { hold: Promise<void> | null }; ctx: AppContext; reads: [string, string, string | undefined][]; answer: { value: MessageTrackerChanges[] }; inspected: number[]; opened: string[] }
function rig(initial: MessageTrackerChanges[]): Rig {
  const reads: Rig["reads"] = [];
  const answer = { value: initial };
  const gate: Rig["gate"] = { hold: null };
  const ctx = { api: { getTrackerChanges: async (b: string, from: string, to?: string) => {
    reads.push([b, from, to ?? ""] as never);
    const out = answer.value;
    if (gate.hold) await gate.hold;
    if (out === FAIL) throw new Error("the read failed");
    return { messages: out };
  } } } as unknown as AppContext;
  return { gate, ctx, reads, answer, inspected: [], opened: [] };
}

function Harness({ r, chat, gens = {}, on = true, show = true }: { r: Rig; chat: Chat; gens?: Record<string, Generation>; on?: boolean; show?: boolean }) {
  const notes = useReplyNotes({ ctx: r.ctx, chatId: "chat1", chat, committed: committedNow, rows: rowsNow, on, onInspect: () => r.inspected.push(1) });
  const asked = useRequestedTracker("chat1");
  return (
    <div>
      {rowsNow.map((row) => row.kind === "msg" && <div key={row.m.id} data-msg={row.m.id}>{notes.foot(row.m.id, gens[row.m.id], show && row.m.role === "assistant", null)}</div>)}
      {notes.toast}
      <i data-asked={asked ?? ""} />
    </div>
  );
}
const slot = (id: string): HTMLElement => m!.host.querySelector<HTMLElement>(`[data-msg="${id}"]`)!;
const mountIt = async (r: Rig, chat = chatOf(), props: Partial<Parameters<typeof Harness>[0]> = {}): Promise<void> => { m = await mounted(dom, <Harness r={r} chat={chat} {...props} />); await m.tick(); await m.tick(); };
const publish = async (version: number, running = false): Promise<void> => { m!.flush(() => publishSceneSignals("chat1", { version, running })); await m!.tick(); await m!.tick(); };

describe("each tracker chooses how its changes show", () => {
  test("chips: one badge per changed line, a bar and a colored delta for a number with a top, the new value for a choice", async () => {
    const r = rig([at("m1", health("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    const chips = [...slot("m1").querySelectorAll('[data-part="scene.messenger.change.chip"]')];
    expect(chips.map((c) => c.textContent)).toEqual(["hp7/20-3", "hurt"]);
    expect(chips[0]!.querySelector('[data-dir="down"]')).not.toBeNull();
    expect(chips[0]!.querySelector(".msn-rc-bar")).not.toBeNull();
    expect(slot("m1").querySelector('[data-part="scene.messenger.change.card"]')).toBeNull();
  });

  test("card: a card per tracker with the new value and the old one under it", async () => {
    const r = rig([at("m3", health("card"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    const card = slot("m3").querySelector('[data-part="scene.messenger.change.card"]')!;
    expect(card.textContent).toContain("Health");
    expect(card.textContent).toContain("7/20");
    expect(card.textContent).toContain("was 10");
    expect(card.textContent).toContain("hurt");
    expect(card.textContent).toContain("was calm");
    expect(slot("m3").querySelector('[data-part="scene.messenger.change.chip"]')).toBeNull();
  });

  test("toast: only a small marker on the reply, and no notice just because the scene loaded", async () => {
    const r = rig([at("m3", health("toast"), satchel("toast"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    expect(slot("m3").querySelector('[data-part="scene.messenger.change.marker"]')!.textContent).toContain("3 changes");
    expect(m!.host.querySelector(".edittoast")).toBeNull();
  });

  test("hidden: nothing is drawn; a mixed reply draws each tracker its own way", async () => {
    const r = rig([at("m1", health("hidden")), at("m3", health("card"), satchel("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    expect(slot("m1").innerHTML).toBe("");
    expect(slot("m3").querySelectorAll('[data-part="scene.messenger.change.card"]')).toHaveLength(1);
    expect(slot("m3").querySelectorAll('[data-part="scene.messenger.change.chip"]')).toHaveLength(1);
  });

  test("nothing draws under a message that is not shown as a finished reply", async () => {
    const r = rig([at("m3", health("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r, chatOf(), { show: false });
    expect(slot("m3").innerHTML).toBe("");
  });
});

describe("the scene's switch and what is read", () => {
  test("switched off, nothing draws and nothing is read; so too with no library tracker linked and outside the Messenger", async () => {
    for (const [chat, on] of [[chatOf({ trackerChanges: false }), true], [chatOf({ trackers: [] }), true], [chatOf(), false]] as const) {
      const r = rig([at("m3", health("chips"))]);
      publishSceneSignals("chat1", { version: 1, running: false });
      await mountIt(r, chat, { on });
      expect(slot("m3").innerHTML).toBe("");
      expect(r.reads).toEqual([]);
      m!.unmount(); m = null;
    }
  });

  test("one read for the whole range of messages the page holds, not one per message", async () => {
    const r = rig([at("m1", health("chips")), at("m3", satchel("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    expect(r.reads).toEqual([["b1", "m1", "m3"]]);
  });

  test("a swipe moves the take's version: the changes are read again and the shown version's replace the old ones", async () => {
    const r = rig([at("m3", health("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    expect(slot("m3").textContent).toContain("7/20");
    r.answer.value = [at("m3", satchel("chips"))];
    await publish(2);
    expect(r.reads).toHaveLength(2);
    expect(slot("m3").textContent).toContain("rope");
    expect(slot("m3").textContent).not.toContain("7/20");
  });

  test("the blocks already drawn stay while the next read is out, then the new read replaces them", async () => {
    const r = rig([at("m3", health("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    expect(slot("m3").textContent).toContain("7/20");
    let release = (): void => undefined;
    r.gate.hold = new Promise<void>((go) => { release = go; });
    r.answer.value = [at("m3", satchel("chips"))];
    await publish(2);
    expect(r.reads).toHaveLength(2);
    expect(slot("m3").textContent).toContain("7/20"); // the old block is not blanked while the read is out
    release();
    r.gate.hold = null;
    await m!.tick();
    await m!.tick();
    expect(slot("m3").textContent).toContain("rope");
    expect(slot("m3").textContent).not.toContain("7/20");
  });

  test("nothing is read while a reply is streaming", async () => {
    const r = rig([at("m3", health("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: true });
    await mountIt(r);
    expect(r.reads).toEqual([]);
  });
});

const toast = (): Element | null => m!.host.querySelector(".edittoast");
const committedAt = (id: string, swipes: number, kind: CommittedTurn["kind"] = "reply"): CommittedTurn => ({ kind, messageId: id, swipeId: `${id}-s${swipes - 1}` });
/** One turn as the page sees it: the signals while it runs, then the rows its save left, what its event named, and the version it ended on. */
const turn = async (after: Row[], committed: CommittedTurn | null, endVersion: number, startVersion = 1): Promise<void> => {
  committedNow = null;
  await publish(startVersion, true);
  rowsNow = after;
  committedNow = committed;
  await publish(endVersion, false);
};

describe("the toast", () => {
  test("a reply that lands live shows it once; a later swipe between saved versions does not; the marker shows it again", async () => {
    const r = rig([at("m3", health("toast"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    rowsNow = rowsOf(0);
    await mountIt(r);
    expect(toast()).toBeNull();
    await turn(rowsOf(1), committedAt("m3", 1), 2);
    expect(toast()!.textContent).toContain("Reply 3 changed hp 10 → 7 and mood calm → hurt.");
    m!.flush(() => (m!.host.querySelector(".edittoast button") as HTMLElement).click());
    await m!.tick();
    expect(toast()).toBeNull();
    await publish(3);
    expect(toast()).toBeNull();
    await m!.click(m!.host.querySelector('[data-part="scene.messenger.change.marker"]'));
    expect(toast()).not.toBeNull();
  });

  test("a regenerate adds a version to the tip reply: the turn names the new swipe and it fires", async () => {
    const r = rig([at("m3", health("toast"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    await turn(rowsOf(2), committedAt("m3", 2, "swipe"), 2);
    expect(toast()).not.toBeNull();
  });

  test("a Stop that kept a partial reply committed it, so it fires too", async () => {
    const r = rig([at("m3", health("toast"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    rowsNow = rowsOf(0);
    await mountIt(r);
    await turn(rowsOf(1), committedAt("m3", 1), 2);
    expect(toast()).not.toBeNull();
  });

  test("the save reaching the page after the turn went idle still fires it once", async () => {
    const r = rig([at("m3", health("toast"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    rowsNow = rowsOf(0);
    await mountIt(r);
    await publish(1, true);
    committedNow = committedAt("m3", 1);
    await publish(1, false);
    expect(toast()).toBeNull();
    rowsNow = rowsOf(1);
    await publish(2, false);
    expect(toast()).not.toBeNull();
  });

  test("a live reply whose changes are not toast style shows no notice", async () => {
    const r = rig([at("m3", health("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    rowsNow = rowsOf(0);
    await mountIt(r);
    await turn(rowsOf(1), committedAt("m3", 1), 2);
    expect(toast()).toBeNull();
  });

  describe("only a reply the turn itself committed toasts", () => {
    test("a turn that saved nothing, then the person cuts the tip so an older reply becomes the tip: no toast for the old reply", async () => {
      const r = rig([at("m1", health("toast")), at("m3", health("toast"))]);
      publishSceneSignals("chat1", { version: 1, running: false });
      await mountIt(r);
      await turn(ROWS, null, 1); // Prompt Inspector stop, Stop or a failure before save, dropTurn
      expect(toast()).toBeNull();
      rowsNow = [ROWS[0]!]; // the person cut the tip: m1 is now the tip
      await publish(2);
      expect(toast()).toBeNull();
      expect(slot("m1").querySelector('[data-part="scene.messenger.change.marker"]')).not.toBeNull(); // its marker is there to open by hand
    });

    test("a turn that saved nothing: a later swipe or edit does not toast", async () => {
      const r = rig([at("m3", health("toast"))]);
      publishSceneSignals("chat1", { version: 1, running: false });
      await mountIt(r);
      await turn(ROWS, null, 1);
      await publish(2);
      await publish(3);
      expect(toast()).toBeNull();
    });

    test("a turn that failed after the person's message was saved: the version moved, but no reply was committed", async () => {
      const r = rig([at("m3", health("toast"))]);
      publishSceneSignals("chat1", { version: 1, running: false });
      await mountIt(r);
      const withUser = rowsOf(1, { kind: "msg", m: msg("m4", "user"), n: 4 });
      await turn(withUser, null, 2);
      rowsNow = ROWS;
      await publish(3);
      expect(toast()).toBeNull();
    });

    test("a committed turn whose message is no longer the tip when the read lands does not toast, and does not wait to toast later", async () => {
      const r = rig([at("m1", health("toast")), at("m3", health("toast"))]);
      publishSceneSignals("chat1", { version: 1, running: false });
      await mountIt(r);
      await turn([ROWS[0]!], committedAt("m3", 1), 2); // m3 landed, then was cut before the page read: m1 is the tip
      expect(toast()).toBeNull();
      rowsNow = ROWS;
      await publish(3);
      expect(toast()).toBeNull();
    });

    test("a read that fails settles it: the next version move does not toast", async () => {
      const r = rig(FAIL);
      publishSceneSignals("chat1", { version: 1, running: false });
      rowsNow = rowsOf(0);
      await mountIt(r);
      await turn(rowsOf(1), committedAt("m3", 1), 2);
      expect(toast()).toBeNull();
      r.answer.value = [at("m3", health("toast"))];
      rowsNow = rowsOf(1);
      await publish(3);
      expect(toast()).toBeNull();
    });
  });

  describe("a turn that ended while no changes were read is settled", () => {
    test.each([
      ["Full Chat (not the Messenger)", chatOf(), false, chatOf(), true],
      ["the scene switch off", chatOf({ trackerChanges: false }), true, chatOf(), true],
      ["no tracker linked", chatOf({ trackers: [] }), true, chatOf(), true],
    ] as const)("%s: turning it on later never toasts a reply that landed earlier", async (_name, first, firstOn, then, thenOn) => {
      const r = rig([at("m3", health("toast"))]);
      publishSceneSignals("chat1", { version: 1, running: false });
      rowsNow = rowsOf(0);
      await mountIt(r, first, { on: firstOn });
      await turn(rowsOf(1), committedAt("m3", 1), 2);
      expect(r.reads).toEqual([]);
      await m!.rerender(<Harness r={r} chat={then} on={thenOn} />);
      await m!.tick();
      await publish(3);
      expect(r.reads.length).toBeGreaterThan(0);
      expect(slot("m3").querySelector('[data-part="scene.messenger.change.marker"]')).not.toBeNull();
      expect(toast()).toBeNull();
    });
  });

  describe("a continue", () => {
    test("whose changes are the same with the keys in another order is the same change: no toast", async () => {
      const same: TrackerChanged = { ...health("toast"), changes: [{ field: "hp", before: 10, after: 7 }] };
      const r = rig([at("m3", same)]);
      publishSceneSignals("chat1", { version: 1, running: false });
      await mountIt(r);
      r.answer.value = [at("m3", { changes: [{ after: 7, before: 10, field: "hp" }], bars: { hp: { top: 20, min: 0 } }, icon: "lucide:star", style: "toast", name: "Health", trackerId: "health" } as TrackerChanged)];
      await turn(ROWS, committedAt("m3", 1, "continue"), 2);
      expect(toast()).toBeNull();
    });

    test("that changed a toast-style tracker toasts, though the tip's message and version are the same", async () => {
      const r = rig([at("m3", health("toast"))]);
      publishSceneSignals("chat1", { version: 1, running: false });
      await mountIt(r);
      r.answer.value = [at("m3", { ...health("toast"), changes: [{ field: "hp", before: 10, after: 5 }] })];
      await turn(ROWS, committedAt("m3", 1, "continue"), 2);
      expect(toast()!.textContent).toContain("hp 10 → 5");
    });

    test("that changed nothing in the toast trackers does not toast", async () => {
      const r = rig([at("m3", health("toast"))]);
      publishSceneSignals("chat1", { version: 1, running: false });
      await mountIt(r);
      await turn(ROWS, committedAt("m3", 1, "continue"), 2);
      expect(toast()).toBeNull();
    });
  });
});

describe("opening a tracker from a chip", () => {
  test("a click asks the Messenger for the Trackers program and leaves the tracker for the panel", async () => {
    const r = rig([at("m3", health("chips"))]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r);
    const heard: string[] = [];
    const listener = (e: Event): void => { heard.push((e as CustomEvent<{ program: string }>).detail.program); };
    window.addEventListener(PROGRAM_OPEN_EVENT, listener);
    await m!.click(slot("m3").querySelector('[data-part="scene.messenger.change.chip"]'));
    window.removeEventListener(PROGRAM_OPEN_EVENT, listener);
    expect(heard).toEqual(["trackers"]);
    expect(m!.host.querySelector("[data-asked]")!.getAttribute("data-asked")).toBe("health");
  });
});

describe("the out-of-time line", () => {
  const gens = { m3: { outOfTime: [{ macro: "tally" }] } as Generation };

  test("a reply whose prompt ran out of time says which macro, and Prompt Inspector opens the inspector", async () => {
    const r = rig([]);
    publishSceneSignals("chat1", { version: 1, running: false });
    await mountIt(r, chatOf(), { gens });
    const line = slot("m3").querySelector('[data-part="scene.messenger.out-of-time"]')!;
    expect(line.textContent).toContain("1 macro ran out of time building this prompt ({{tally}}).");
    await m!.click(m!.button("Prompt Inspector"));
    expect(r.inspected).toHaveLength(1);
    expect(slot("m1").querySelector('[data-part="scene.messenger.out-of-time"]')).toBeNull();
  });

  test("it does not depend on the change switch, and is not drawn for a reply that is not shown as finished", async () => {
    const r = rig([]);
    await mountIt(r, chatOf({ trackerChanges: false }), { gens });
    expect(slot("m3").querySelector('[data-part="scene.messenger.out-of-time"]')).not.toBeNull();
    m!.unmount(); m = null;
    await mountIt(rig([]), chatOf(), { gens, show: false });
    expect(slot("m3").querySelector('[data-part="scene.messenger.out-of-time"]')).toBeNull();
  });
});

describe("swiping a saved reply to another version", () => {
  test("a real selectSwipe moves the take's version and the other version's changes replace the shown ones", async () => {
    const body: TrackerBody = { name: "Health", description: "", layout: "record", note: "", style: undefined, fields: [{ name: "hp", description: "", type: "number", min: 0, max: 20, default: 20 }] } as unknown as TrackerBody;
    const chats = memoryChatStore(() => 1_000);
    const made = await chats.createChat({ title: "Night", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: { kind: "character", id: "vera", body: { identity: { name: "Vera" } } } } });
    await chats.setPrompting(made.id, { trackers: ["health"] });
    const branch = made.activeBranchId;
    const user = (await chats.appendMessage(branch, { role: "user", content: "hi" }))!;
    const turn = async (target: Parameters<typeof chats.beginTurn>[1], hp: number) => {
      const open = await chats.beginTurn(branch, target);
      await chats.saveCheckpoint(open!.id, { content: "t", deltas: [{ slot: trackerSlot("health", body), path: ["hp"], value: hp, at: 1 }] });
      return (await chats.commitTurn(open!.id, { content: "t" }))!;
    };
    const reply = await turn({ kind: "reply" }, 7);
    await turn({ kind: "swipe", messageId: reply.id }, 3);
    const versionNow = async (): Promise<number> => (await chats.readMessagesBefore(branch, { limit: 1, liveOnly: true })).branchVersion!;
    const held = (await chats.getChat(made.id))!;
    const rows: Row[] = [{ kind: "msg", m: msg(user.id, "user"), n: 1 }, { kind: "msg", m: msg(reply.id, "assistant"), n: 2 }];
    const ctx = { api: { getTrackerChanges: async (b: string, from: string, to?: string) => ({ messages: (await trackerChangesBetween(chats, async () => body, b, from, to))! }) } } as unknown as AppContext;
    function Real() {
      const notes = useReplyNotes({ ctx, chatId: made.id, chat: held, committed: null, rows, on: true, onInspect: () => undefined });
      return <div data-reply>{notes.foot(reply.id, undefined, true, null)}</div>;
    }
    publishSceneSignals(made.id, { version: await versionNow(), running: false });
    m = await mounted(dom, <Real />);
    await m.until(() => m!.host.querySelector("[data-reply]")!.textContent!.includes("3/20"));
    await chats.selectSwipe(reply.id, 0);
    const v = await versionNow();
    m.flush(() => publishSceneSignals(made.id, { version: v, running: false }));
    await m.until(() => m!.host.querySelector("[data-reply]")!.textContent!.includes("7/20"));
    expect(m.host.querySelector("[data-reply]")!.textContent).not.toContain("3/20");
    publishSceneSignals(made.id, { version: 0, running: false });
  });
});
