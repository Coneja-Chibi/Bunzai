/**
 * The automatic tracker update controls (plan 17) in every state: the Story Director settings block (the switch on and off, Every N replies, the list of trackers switched on in the scene with
 * their own switch, number and Use default, Model calls per reply), the Control Booth's switch and one line, and a tracker's read-only menu line with its way to the settings. Each control
 * sends its own patch, a number is clamped to its range, a refused write says so, and the Auto-retry row stays when the switch is off.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Chat, ChatTrackerEntry, TrackerModule } from "../../../../../stage/contracts/chat-store";
import { resolveDirector } from "../../../../../core/director/settings";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import { useStageOpen } from "../../use-stage-open";
import { TrackerFrame } from "../trackers/tracker-frame";
import type { TrackerView } from "../trackers/use-tracker";
import { DIRECTOR_SETTINGS_OPEN_EVENT } from "./director-live";
import { DirectorBooth } from "./director-booth";
import { DirectorSettings } from "./director-settings";
import { CHAT, fakeDirector, mounted, panelOf, type Mounted } from "./fake-director-ui-rig";

let installed: InstalledDom;
let dom: JSDOM;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement"] }); dom = installed.dom; });
afterAll(() => installed.teardown());
let m: Mounted | null = null;
beforeEach(() => installed.reinstall());
afterEach(() => { m?.unmount(); m = null; });
const text = (): string => m!.host.textContent ?? "";

const chat = { ...CHAT, connection: { id: "c1", model: "claude" }, props: { on: ["story-director", "tracker-inventory", "tracker-resources", "tracker-party", "tracker-battle", "tracker-quests"] } } as Chat;
const settingsOf = (over: Partial<ReturnType<typeof resolveDirector>> = {}) => ({ ...resolveDirector({}), ...over });
const input = (label: string): HTMLInputElement => m!.host.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
const EVERY = "Every N replies, default for all trackers";
async function commit(label: string, value: string): Promise<void> {
  const el = input(label);
  await m!.type(el, value);
  m!.flush(() => el.dispatchEvent(new dom.window.Event("focusout", { bubbles: true })));
  await m!.tick();
}
async function block(over: Partial<ReturnType<typeof resolveDirector>> = {}, trackers: Chat["trackers"] = {}, c: Chat = chat) {
  const rig = fakeDirector(panelOf({ settings: settingsOf(over) }));
  rig.sceneChat = { ...CHAT, trackers } as Chat;
  m = await mounted(dom, <DirectorSettings ctx={rig.ctx} chat={{ ...c, trackers }} />);
  return rig;
}
const rowOf = (module: string): Element => m!.host.querySelector(`[data-part="props.story-director.auto-update.row.${module}"]`)!;

describe("the Story Director settings block, switch on", () => {
  test("the switch, Every N replies, the list of trackers on in the scene, the call budget, then Temperature and Auto-retry", async () => {
    await block();
    expect(m!.button("Update trackers automatically")?.getAttribute("aria-checked")).toBe("true");
    expect(input(EVERY).value).toBe("1");
    expect(text()).toContain("The default for every tracker below. Change a row to give that tracker its own number.");
    expect(text()).toContain("Trackers in this scene");
    const rows = [...m!.host.querySelectorAll('[data-part^="props.story-director.auto-update.row."]')].map((r) => r.getAttribute("data-part")!.split(".").pop());
    expect(rows).toEqual(["resources", "battle", "party", "inventory"]);
    expect(rowOf("quests")).toBeNull();
    expect(input("Model calls per reply").value).toBe("1");
    expect(text()).toContain("up to");
    expect(text()).toContain("More calls let it handle many trackers and retry a bad answer. Each call costs tokens.");
    expect(input("DM Temperature").value).toBe("0.7");
    expect(m!.button("Disable auto-retry invalid tool responses")).toBeDefined();
    for (const old of ["Default AI Awareness", "Max Tool Rounds", "DM Updates"]) expect(text()).not.toContain(old);
    for (const part of ["props.story-director.auto-update", "props.story-director.auto-update.list", "props.story-director.auto-update.calls"]) expect(m!.host.querySelector(`[data-part="${part}"]`)).not.toBeNull();
  });

  test("the switch sends autoUpdate; off hides everything but the switch, its line, Temperature and the Auto-retry row", async () => {
    const rig = await block();
    await m!.click(m!.button("Update trackers automatically"));
    expect(rig.patches).toEqual([{ autoUpdate: false }]);
    expect(text()).toContain("Trackers change only when you edit or Refresh them.");
    for (const gone of ["Trackers in this scene", "Model calls per reply", "The default for every tracker below."]) expect(text()).not.toContain(gone);
    expect(m!.host.querySelector('[data-part="props.story-director.auto-update.list"]')).toBeNull();
    expect(input("DM Temperature")).not.toBeNull();
    expect(m!.button("Disable auto-retry invalid tool responses")).toBeDefined();
    await m!.click(m!.button("Update trackers automatically"));
    expect(rig.patches.at(-1)).toEqual({ autoUpdate: true });
    expect(text()).toContain("Trackers in this scene");
  });

  test("the default number is clamped 1 to 99 and the steps move it", async () => {
    const rig = await block({ every: 3 });
    await commit(EVERY, "0");
    await commit(EVERY, "250");
    await m!.click(m!.button(`Fewer: ${EVERY}`));
    expect(rig.patches[0]).toEqual({ every: 1 });
    expect(rig.patches[1]).toEqual({ every: 99 });
    expect(rig.patches[2]).toEqual({ every: 98 });
  });

  test("at 1 the step down is off, and the unit reads reply", async () => {
    await block({ every: 1 });
    expect(m!.button(`Fewer: ${EVERY}`)?.disabled).toBe(true);
    const def = m!.host.querySelector(".def")!.textContent!;
    expect(def).toContain("reply");
    expect(def).not.toContain("replies");
  });

  test("model calls per reply is clamped 1 to 5", async () => {
    const rig = await block({ callsPerReply: 2 });
    await commit("Model calls per reply", "9");
    await commit("Model calls per reply", "0");
    expect(rig.patches).toEqual([{ callsPerReply: 5 }, { callsPerReply: 1 }]);
  });
});

describe("the tracker list", () => {
  test("a row starts at the default; typing a different number gives that tracker its own, the same number clears it", async () => {
    const rig = await block({ every: 2 });
    expect(input("Inventory, every N replies").value).toBe("2");
    expect(text()).not.toContain("Use default");
    await commit("Inventory, every N replies", "5");
    expect(rig.tracked).toEqual([{ module: "inventory", patch: { auto: { every: 5 } } }]);
    expect(input("Inventory, every N replies").value).toBe("5");
    await commit("Inventory, every N replies", "2");
    expect(rig.tracked.at(-1)).toEqual({ module: "inventory", patch: { auto: null } });
  });

  test("a row whose number differs shows Use default, which clears it; one that matches does not", async () => {
    const rig = await block({ every: 2 }, { party: { auto: { every: 5 } }, inventory: { auto: { every: 2 } } });
    expect(input("Party, every N replies").value).toBe("5");
    expect([...m!.host.querySelectorAll(".ds-trow button")].filter((b) => b.textContent === "Use default").length).toBe(1);
    await m!.click(m!.button("Use default"));
    expect(rig.tracked).toEqual([{ module: "party", patch: { auto: null } }]);
    expect(input("Party, every N replies").value).toBe("2");
    expect(m!.button("Use default")).toBeUndefined();
  });

  test("a row's switch turns that tracker off (its number is greyed out and kept) and back on", async () => {
    const rig = await block({ every: 2 }, { party: { auto: { every: 4 } } });
    await m!.click(m!.button("Party automatic updates"));
    expect(rig.tracked.at(-1)).toEqual({ module: "party", patch: { auto: { on: false, every: 4 } } });
    expect(rowOf("party").className).toContain("off");
    expect((rowOf("party").querySelector("input") as HTMLInputElement).disabled).toBe(true);
    expect(rowOf("party").querySelector(".linkish")).toBeNull();
    await m!.click(m!.button("Party automatic updates"));
    expect(rig.tracked.at(-1)).toEqual({ module: "party", patch: { auto: { every: 4 } } });
    expect(rowOf("party").className).not.toContain("off");
  });

  test("a switched-off tracker with no number of its own stores only on:false, and switching on clears it", async () => {
    const rig = await block({}, {});
    await m!.click(m!.button("Inventory automatic updates"));
    expect(rig.tracked).toEqual([{ module: "inventory", patch: { auto: { on: false } } }]);
    await m!.click(m!.button("Inventory automatic updates"));
    expect(rig.tracked.at(-1)).toEqual({ module: "inventory", patch: { auto: null } });
  });

  test("no tracker on in the scene says so", async () => {
    await block({}, {}, { ...chat, props: { on: ["story-director"] } } as Chat);
    expect(text()).toContain("No tracker is switched on in this scene.");
  });

  test("a refused write says so and changes nothing shown", async () => {
    const rig = await block();
    rig.failNext = true;
    await m!.click(m!.button("Inventory automatic updates"));
    expect(text()).toContain("Story Director could not be updated.");
    expect(rowOf("inventory").className).not.toContain("off");
  });
});

describe("the Control Booth", () => {
  const booth = async (over: Partial<ReturnType<typeof resolveDirector>> = {}) => {
    const rig = fakeDirector(panelOf({ settings: settingsOf(over) }));
    m = await mounted(dom, <DirectorBooth ctx={rig.ctx} chat={chat} busy={false} onProps={() => undefined} />);
    return rig;
  };

  test("it has the switch and one quiet line with the default number and the way to the settings; no list and no call budget", async () => {
    const rig = await booth({ every: 2 });
    expect(m!.button("Update trackers automatically")?.getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("Every 2 replies.");
    expect(m!.button("Change in Story Director")).toBeDefined();
    for (const gone of ["Trackers in this scene", "Model calls per reply"]) expect(text()).not.toContain(gone);
    expect(input("DM Temperature")).not.toBeNull();
    expect(m!.button("Disable auto-retry invalid tool responses")).toBeDefined();
    await m!.click(m!.button("Update trackers automatically"));
    expect(rig.patches).toEqual([{ autoUpdate: false }]);
    expect(text()).toContain("Trackers change only when you edit or Refresh them.");
    expect(m!.host.querySelector('[data-part="scene.booth.narrator.auto-update"]')).not.toBeNull();
  });

  test("one reply reads 'Every reply', and the link asks the page to open the Story Director settings", async () => {
    await booth({ every: 1 });
    expect(text()).toContain("Every reply.");
    let asked = 0;
    const on = (): void => { asked++; };
    dom.window.addEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, on);
    await m!.click(m!.button("Change in Story Director"));
    dom.window.removeEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, on);
    expect(asked).toBe(1);
  });
});

describe("a tracker's menu", () => {
  async function menu(over: Partial<ReturnType<typeof resolveDirector>>, auto: ChatTrackerEntry["auto"], opts: { on?: boolean; module?: TrackerModule } = {}) {
    const rig = fakeDirector(panelOf({ on: opts.on ?? true, settings: settingsOf(over) }));
    const view = { module: opts.module ?? "inventory", context: "always", setContext: () => undefined, error: null, undo: null, apply: () => undefined, stored: auto ? { auto } : undefined, host: { ctx: rig.ctx, chat: CHAT } } as unknown as TrackerView<unknown>;
    m = await mounted(dom, <TrackerFrame label="Inventory" title="Inventory" description="What she carries." icon="lucide:box" tone="var(--deck-lorebook)" tokens={0} view={view} onClear={() => undefined}><p>body</p></TrackerFrame>);
    await m!.click(m!.button("Panel AI settings"));
  }
  const line = (): Element | null => m!.host.querySelector('[data-part="props.tracker.auto-update"]');

  test("it says how often, from the scene's number or the tracker's own, as text with no control", async () => {
    await menu({ every: 2 }, undefined);
    expect(line()?.textContent).toContain("Updates automatically every 2 replies");
    expect(line()?.className).not.toContain("dim");
    expect(line()?.querySelector("input")).toBeNull();
    expect(m!.host.querySelector('input[aria-label="DM Updates"]')).toBeNull();
    m!.unmount();
    await menu({ every: 2 }, { every: 5 });
    expect(line()?.textContent).toContain("Updates automatically every 5 replies");
    m!.unmount();
    await menu({ every: 1 }, undefined);
    expect(line()?.textContent).toContain("Updates automatically every reply");
  });

  test("off for this tracker, the switch off, or the Story Director off each read their own line, dimmed", async () => {
    await menu({}, { on: false });
    expect(line()?.textContent).toContain("Not updated automatically");
    expect(line()?.className).toContain("dim");
    m!.unmount();
    await menu({ autoUpdate: false }, undefined);
    expect(line()?.textContent).toContain("Not updated automatically");
    m!.unmount();
    await menu({}, undefined, { on: false });
    expect(line()?.textContent).toContain("Story Director is off");
    expect(line()?.className).toContain("dim");
  });

  test("Change in Story Director opens the settings; AI Context stays; a module the Director does not update has no line", async () => {
    await menu({}, undefined);
    expect(text()).toContain("AI Context");
    let asked = 0;
    const on = (): void => { asked++; };
    dom.window.addEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, on);
    await m!.click(m!.button("Change in Story Director"));
    dom.window.removeEventListener(DIRECTOR_SETTINGS_OPEN_EVENT, on);
    expect(asked).toBe(1);
    m!.unmount();
    await menu({}, undefined, { module: "quests" });
    expect(line()).toBeNull();
  });
});

describe("the page's door", () => {
  function Probe({ open }: { open(wing: string): void }): JSX.Element { useStageOpen(open); return <i />; }
  test("the settings request opens the Props wing", async () => {
    const opened: string[] = [];
    m = await mounted(dom, <Probe open={(w) => opened.push(w)} />);
    m!.flush(() => dom.window.dispatchEvent(new dom.window.Event(DIRECTOR_SETTINGS_OPEN_EVENT)));
    expect(opened).toEqual(["props"]);
  });
});
