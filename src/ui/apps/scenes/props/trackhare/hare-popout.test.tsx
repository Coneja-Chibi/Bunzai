/**
 * TrackHare's lore trace as a registered pop-out kind: the Prop declares it, the host offers it only while TrackHare is on, the
 * popover carries the Pop out button and reads "Lore trace is floating" with Bring back while it floats, and the floating panel shows
 * the latest reply's trace by itself (its own version, with the popover shut) beside another kind's panel.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../../app-contract";
import type { SceneTrace } from "../../../../app-contract-scenes";
import { installDom, type InstalledDom, flushTasks } from "../../../../_shared/test-dom";
import { popoutKindsFor } from "../../popout/popout-core";
import { PopoutHost } from "../../popout/popout-host";
import type { PopoutKind } from "../../popout/popout-kind";
import { HareStage } from "./hare-stage";
import { trackHareProp } from "./index";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const trace: SceneTrace = {
  reply: { messageId: "m14", swipeId: "s1", number: 14, model: "m", take: "Director's Cut" }, blocks: [], window: { context: 32000, reply: 1200, stated: true }, trimmed: 0, rawAvailable: true, replies: [],
  lore: { injected: [{ bookId: "b1", entryId: "e1", bookName: "Keeper's Log", title: "The lighthouse", reason: "constant", matched: [], tokens: 120, place: "World", loop: 0 }], cut: [], missed: [{ bookId: "b1", entryId: "e9", bookName: "Keeper's Log", title: "Shipwrecks", reason: "budget", why: "over budget" }], chains: [], totalTokens: 120, share: 8000, seed: 1 },
  recall: { status: "recalled", calls: 1, cached: false, alreadyPlaced: 0, cut: [], injected: [{ bookId: "b1", entryId: "e2", bookName: "Keeper's Log", title: "Mira", tokens: 9, reason: "On the quay" }] },
};
const chat = { id: "chat1", activeBranchId: "b1", updatedAt: 1 } as Chat;
let prefs: Record<string, unknown>;
const ctxOf = (): AppContext => ({ api: { getSceneTrace: async () => trace }, prefs: { get: (k: string) => prefs[k], set: (k: string, v: unknown) => { prefs[k] = v; } } }) as unknown as AppContext;

let root: Root;
let host: HTMLElement;
let flush: typeof import("react-dom")["flushSync"];
beforeEach(() => { installed.reinstall(); prefs = {}; });
const tick = async (): Promise<void> => { await flushTasks(); flush(() => undefined); };
async function mount(ui: JSX.Element): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  flush = (await import("react-dom")).flushSync;
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flush(() => root.render(ui));
  await tick();
}
const unmount = (): void => { flush(() => root.unmount()); host.remove(); };
const click = async (el: Element | null | undefined): Promise<void> => { flush(() => (el as HTMLElement).click()); await tick(); };
const byLabel = (label: string): HTMLButtonElement | undefined => [...host.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === label);
const panel = (id: string): HTMLElement | null => host.querySelector(`[data-popout="${id}"]`);

const stage = (kinds: PopoutKind[]): JSX.Element => (
  <>
    <div className="stage"><HareStage ctx={ctxOf()} chat={chat} /></div>
    <PopoutHost ctx={ctxOf()} chat={chat} kinds={kinds} />
  </>
);

describe("TrackHare's pop-out", () => {
  test("the prop declares one kind, offered only while TrackHare is on", () => {
    expect(trackHareProp.popouts?.map((k) => k.id)).toEqual(["trackhare.trace"]);
    expect(popoutKindsFor([], [trackHareProp], []).map((k) => k.id)).toEqual([]);
    expect(popoutKindsFor([], [trackHareProp], ["trackhare"]).map((k) => k.id)).toEqual(["trackhare.trace"]);
  });

  test("the popover pops the trace out; the popover then reads the placeholder and Bring back restores it", async () => {
    await mount(stage(trackHareProp.popouts!));
    await click(host.querySelector(".hare-btn"));
    expect(host.querySelector(".hare-pop")!.textContent).toContain("The lighthouse");
    await click(byLabel("Pop out"));
    const floating = panel("trackhare.trace")!;
    expect(floating.textContent).toContain("TrackHare");
    expect(floating.textContent).toContain("The lighthouse");
    expect(floating.textContent).toContain("Recalled by the Compendium");
    expect(floating.textContent).toContain("Reply #14");
    expect(floating.querySelector('button[aria-label="Pop out"]')).toBeNull();
    expect(host.querySelector(".hare-pop")!.textContent).toContain("Lore trace is floating");
    expect(host.querySelector(".hare-pop")!.textContent).not.toContain("The lighthouse");
    await click([...host.querySelectorAll(".hare-pop button")].find((b) => b.textContent === "Bring back"));
    expect(panel("trackhare.trace")).toBeNull();
    expect(host.querySelector(".hare-pop")!.textContent).toContain("The lighthouse");
    unmount();
  });

  test("a floating trace stays up with the popover shut and follows the viewer's TrackHare options", async () => {
    prefs["popout.trackhare.trace"] = { open: true };
    prefs["trackhare.misses"] = true;
    await mount(<PopoutHost ctx={ctxOf()} chat={chat} kinds={trackHareProp.popouts!} />);
    expect(panel("trackhare.trace")!.textContent).toContain("The lighthouse");
    await click([...panel("trackhare.trace")!.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes("fire")));
    expect(panel("trackhare.trace")!.textContent).toContain("over budget");
    unmount();
  });

  test("it floats beside another kind's panel at its own place", async () => {
    const other: PopoutKind = { id: "other", title: "Other", noun: "Other", icon: "lucide:zap", render: () => <p>other body</p> };
    prefs["popout.trackhare.trace"] = { open: true };
    prefs["popout.other"] = { open: true };
    await mount(<PopoutHost ctx={ctxOf()} chat={chat} kinds={[other, ...trackHareProp.popouts!]} />);
    expect(panel("other")).not.toBeNull();
    expect(panel("trackhare.trace")).not.toBeNull();
    expect(panel("other")!.style.top).not.toBe(panel("trackhare.trace")!.style.top);
    unmount();
  });
});
