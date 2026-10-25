/**
 * Pop-outs as they mount: the host floats each registered kind once, the slot is the docked spot, and the panel drags, clamps,
 * remembers its place per kind, takes focus on a person's open, docks on Escape and gives focus back.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import type { JSX } from "react";
import type { Root } from "react-dom/client";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../app-contract";
import { installDom, type InstalledDom, flushTasks } from "../../../_shared/test-dom";
import { PopoutHost, PopoutSlot } from "./popout-host";
import type { PopoutKind } from "./popout-kind";
import { PopoutButton } from "./popout-panel";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent", "KeyboardEvent"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const kindOf = (id: string, top?: number): PopoutKind => ({
  id, title: `Panel ${id}`, noun: `Feed ${id}`, icon: "lucide:zap", ...(top === undefined ? {} : { top }),
  render: ({ id: kid, popOut }) => <div className="body">{`content ${kid}`}{popOut && <PopoutButton id={kid} onClick={popOut} />}</div>,
});
const A = kindOf("a");
const B = kindOf("b", 300);
const chat = { id: "c1" } as Chat;

let prefs: Record<string, unknown>;
const ctxOf = (): AppContext => ({ prefs: { get: (k: string) => prefs[k], set: (k: string, v: unknown) => { prefs[k] = v; } } }) as unknown as AppContext;

let root: Root;
let host: HTMLElement;
type FlushSync = typeof import("react-dom")["flushSync"];
let flush: FlushSync;
beforeEach(() => { installed.reinstall(); prefs = {}; });

async function mount(ui: JSX.Element): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  flush = (await import("react-dom")).flushSync;
  host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flush(() => root.render(ui));
  await tick();
}
const tick = async (): Promise<void> => { await flushTasks(); flush(() => undefined); };
const unmount = (): void => { flush(() => root.unmount()); host.remove(); };
const panel = (id: string): HTMLElement | null => host.querySelector(`[data-popout="${id}"]`);
const popBtn = (id: string): HTMLButtonElement => host.querySelector(`button[data-popout-origin="${id}"][aria-label="Pop out"]`) as HTMLButtonElement;
const click = async (el: Element | null): Promise<void> => { flush(() => (el as HTMLElement).click()); await tick(); };
const pointer = async (el: Element, type: string, x: number, y: number): Promise<void> => {
  flush(() => { el.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y })); });
  await tick();
};
const place = (id: string): { x: number; y: number } => ({ x: parseFloat(panel(id)!.style.left), y: parseFloat(panel(id)!.style.top) });

const scene = (kinds: PopoutKind[]): JSX.Element => (
  <>
    {kinds.map((k) => <div key={k.id} className={`slot-${k.id}`}><PopoutSlot kind={k} ctx={ctxOf()} chat={chat} /></div>)}
    <PopoutHost ctx={ctxOf()} chat={chat} kinds={kinds} />
  </>
);

describe("registered kinds", () => {
  test("two kinds give two independent panels, each with its own docked spot", async () => {
    await mount(scene([A, B]));
    expect(panel("a")).toBeNull();
    await click(popBtn("a"));
    expect(panel("a")).not.toBeNull();
    expect(panel("b")).toBeNull();
    expect(host.querySelector(".slot-b")!.textContent).toContain("content b");
    await click(popBtn("b"));
    expect(panel("a")).not.toBeNull();
    expect(panel("b")).not.toBeNull();
    expect(panel("a")!.textContent).toContain("Panel a");
    expect(panel("b")!.textContent).toContain("Panel b");
    expect(place("b").y).toBe(300);
    await click(panel("a")!.querySelector('button[aria-label="Close"]'));
    expect(panel("a")).toBeNull();
    expect(panel("b")).not.toBeNull();
    unmount();
  });

  test("a kind floats once per scene however many places show it", async () => {
    await mount(<><PopoutSlot kind={A} ctx={ctxOf()} chat={chat} /><div className="second"><PopoutSlot kind={A} ctx={ctxOf()} chat={chat} /></div><PopoutHost ctx={ctxOf()} chat={chat} kinds={[A]} /></>);
    await click(host.querySelectorAll('button[aria-label="Pop out"]')[0]!);
    expect(host.querySelectorAll('[data-popout="a"]').length).toBe(1);
    expect(host.textContent!.match(/Feed a is floating/g)!.length).toBe(2);
    unmount();
  });

  test("the docked spot reads RoleCall's placeholder, and Bring back docks the panel", async () => {
    await mount(scene([A]));
    await click(popBtn("a"));
    expect(host.querySelector(".slot-a")!.textContent).toContain("Feed a is floating");
    expect(host.querySelector(".slot-a")!.textContent).not.toContain("content a");
    const back = [...host.querySelectorAll(".slot-a button")].find((b) => b.textContent === "Bring back");
    await click(back!);
    expect(panel("a")).toBeNull();
    expect(host.querySelector(".slot-a")!.textContent).toContain("content a");
    expect(prefs["popout.a"]).toEqual({ open: false });
    unmount();
  });
});

describe("dragging", () => {
  test("follows the pointer, stays inside the view, and is saved only on drop", async () => {
    await mount(scene([A]));
    await click(popBtn("a"));
    const hd = panel("a")!.querySelector(".po-hd")!;
    const start = place("a");
    expect(start).toEqual({ x: dom.window.innerWidth - 380 - 20, y: 100 });
    await pointer(hd, "pointerdown", 500, 200);
    await pointer(hd, "pointermove", 450, 260);
    expect(place("a")).toEqual({ x: start.x - 50, y: 160 });
    expect(prefs["popout.a"]).toEqual({ open: true });
    await pointer(hd, "pointermove", 99999, 99999);
    expect(place("a").x).toBe(dom.window.innerWidth - 380);
    expect(place("a").y).toBe(dom.window.innerHeight);
    await pointer(hd, "pointermove", -99999, -99999);
    expect(place("a")).toEqual({ x: 0, y: 0 });
    await pointer(hd, "pointerup", 0, 0);
    expect(prefs["popout.a"]).toEqual({ open: true, x: 0, y: 0 });
    unmount();
  });

  test("a press on a header button is not a drag", async () => {
    await mount(scene([A]));
    await click(popBtn("a"));
    const dock = panel("a")!.querySelector('button[aria-label="Dock back"]')!;
    await pointer(dock, "pointerdown", 10, 10);
    await pointer(panel("a")!.querySelector(".po-hd")!, "pointermove", 400, 400);
    expect(place("a").y).toBe(100);
    unmount();
  });

  test("each kind remembers its own place, and open state, across a remount", async () => {
    await mount(scene([A, B]));
    await click(popBtn("a"));
    await click(popBtn("b"));
    const hd = panel("a")!.querySelector(".po-hd")!;
    await pointer(hd, "pointerdown", 500, 200);
    await pointer(hd, "pointermove", 420, 230);
    await pointer(hd, "pointerup", 420, 230);
    const moved = place("a");
    unmount();
    await mount(scene([A, B]));
    expect(place("a")).toEqual(moved);
    expect(place("b").y).toBe(300);
    expect(host.querySelector(".slot-a")!.textContent).toContain("Feed a is floating");
    unmount();
  });

  test("a saved place outside a smaller view is pulled back in", async () => {
    prefs["popout.a"] = { open: true, x: 5000, y: 5000 };
    await mount(scene([A]));
    expect(place("a").x).toBe(dom.window.innerWidth - 380);
    unmount();
  });
});

describe("keyboard and focus", () => {
  test("the person's open moves focus in; Escape docks it and focus returns to the docked spot", async () => {
    await mount(scene([A]));
    popBtn("a").focus();
    await click(popBtn("a"));
    expect(panel("a")!.contains(dom.window.document.activeElement)).toBe(true);
    flush(() => { panel("a")!.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await tick();
    expect(panel("a")).toBeNull();
    expect(dom.window.document.activeElement).toBe(popBtn("a"));
    unmount();
  });

  test("Escape from a text box inside the panel is left to the box", async () => {
    const withField: PopoutKind = { ...kindOf("f"), render: () => <input className="field" /> };
    prefs["popout.f"] = { open: true };
    await mount(<PopoutHost ctx={ctxOf()} chat={chat} kinds={[withField]} />);
    const field = host.querySelector(".field")!;
    flush(() => { field.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await tick();
    expect(panel("f")).not.toBeNull();
    unmount();
  });

  test("an open state restored on load does not take focus", async () => {
    prefs["popout.a"] = { open: true };
    await mount(scene([A]));
    expect(panel("a")).not.toBeNull();
    expect(panel("a")!.contains(dom.window.document.activeElement)).toBe(false);
    unmount();
  });
});
