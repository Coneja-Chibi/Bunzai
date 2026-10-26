/**
 * The Messenger panel frames through their public props: the side panel's width modes and close, the popout's drag clamp and Esc, the context menu's keyboard, select and Esc (and its
 * long-press trigger), and the panel switcher's pressed state and All panels menu. JSDOM lays nothing out, so the popout is given a stated viewport through `bounds`.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type JSX } from "react";
import type { Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import type { MenuEntry } from "./context-menu";

type FlushSync = typeof import("react-dom")["flushSync"];
type Mods = { SidePanel: typeof import("./side-panel")["SidePanel"]; Popout: typeof import("./popout")["Popout"]; clampToViewport: typeof import("./popout")["clampToViewport"];
  ContextMenu: typeof import("./context-menu")["ContextMenu"]; useContextMenuTrigger: typeof import("./context-menu")["useContextMenuTrigger"]; PanelSwitcher: typeof import("./panel-switcher")["PanelSwitcher"] };

let installed: InstalledDom;
let m: Mods;
let flush: FlushSync;
let createRoot: typeof import("react-dom/client")["createRoot"];
let host: HTMLElement;
let root: Root;

beforeAll(async () => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8327/", extraGlobals: ["MouseEvent", "KeyboardEvent", "HTMLButtonElement"] });
  flush = (await import("react-dom")).flushSync;
  createRoot = (await import("react-dom/client")).createRoot;
  m = { ...(await import("./side-panel")), ...(await import("./popout")), ...(await import("./context-menu")), ...(await import("./panel-switcher")) };
});
afterAll(() => installed.teardown());
afterEach(() => { if (root) flush(() => root.unmount()); host?.remove(); });

const render = (node: JSX.Element): void => {
  host = installed.dom.window.document.createElement("div");
  installed.dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flush(() => root.render(node));
};
const doc = (): Document => installed.dom.window.document;
const part = (name: string): HTMLElement => doc().querySelector<HTMLElement>(`[data-part="${name}"]`)!;
const byLabel = (label: string): HTMLElement => doc().querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
const items = (): HTMLElement[] => [...doc().querySelectorAll<HTMLElement>('[role="menu"]:not(.msn-menu-sub) [role="menuitem"]')];
const key = (target: Element, k: string): void => { flush(() => { target.dispatchEvent(new installed.dom.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); }); };
const mouse = (target: EventTarget, type: string, x: number, y: number, extra: MouseEventInit = {}): void => {
  flush(() => { target.dispatchEvent(new installed.dom.window.MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true, ...extra })); });
};
const click = (el: Element): void => { flush(() => (el as HTMLElement).click()); };

describe("SidePanel", () => {
  test("draws Side at the default width and Wide on request, with the title in its header", () => {
    render(createElement(m.SidePanel, { title: "Lorebooks", onClose: () => undefined }, "body text"));
    expect(part("scene.messenger.panel.side").dataset.width).toBe("side");
    expect(part("scene.messenger.panel.header").textContent).toContain("Lorebooks");
    expect(part("scene.messenger.panel.body").textContent).toBe("body text");
    flush(() => root.render(createElement(m.SidePanel, { title: "Lorebooks", width: "wide", onClose: () => undefined })));
    expect(part("scene.messenger.panel.side").dataset.width).toBe("wide");
  });

  test("close, pop out and pin call back; the pin button reports its state", () => {
    const calls: string[] = [];
    render(createElement(m.SidePanel, { title: "Cast", pinned: true, onTogglePin: () => calls.push("pin"), onPopOut: () => calls.push("pop"), onClose: () => calls.push("close") }));
    expect(byLabel("Unpin panel").getAttribute("aria-pressed")).toBe("true");
    click(byLabel("Unpin panel")); click(byLabel("Pop out")); click(byLabel("Close panel"));
    expect(calls).toEqual(["pin", "pop", "close"]);
  });

  test("omits the pin and pop out buttons when no callback is given, and Esc closes", () => {
    let closed = 0;
    render(createElement(m.SidePanel, { title: "Cast", onClose: () => { closed++; } }));
    expect(byLabel("Pin panel")).toBeNull();
    expect(byLabel("Pop out")).toBeNull();
    key(byLabel("Close panel"), "Escape");
    expect(closed).toBe(1);
  });
});

describe("Popout", () => {
  const bounds = (): { w: number; h: number } => ({ w: 800, h: 600 });

  test("clampToViewport keeps a layer inside and pins an oversized one to the top-left", () => {
    expect(m.clampToViewport({ x: -50, y: -9 }, { w: 100, h: 100 }, { w: 800, h: 600 })).toEqual({ x: 0, y: 0 });
    expect(m.clampToViewport({ x: 790, y: 590 }, { w: 100, h: 100 }, { w: 800, h: 600 })).toEqual({ x: 700, y: 500 });
    expect(m.clampToViewport({ x: 30, y: 30 }, { w: 900, h: 700 }, { w: 800, h: 600 })).toEqual({ x: 0, y: 0 });
  });

  test("dragging the header moves the layer and never past the viewport", () => {
    render(createElement(m.Popout, { title: "Trackers", width: 300, initial: { x: 100, y: 100 }, bounds, onClose: () => undefined }, "x"));
    const layer = part("scene.messenger.panel.popout-layer");
    expect(layer.style.left).toBe("100px");
    const head = part("scene.messenger.panel.drag");
    mouse(head, "pointerdown", 150, 120);
    mouse(doc(), "pointermove", 250, 170);
    expect([layer.style.left, layer.style.top]).toEqual(["200px", "150px"]);
    mouse(doc(), "pointermove", 5000, 5000);
    expect([layer.style.left, layer.style.top]).toEqual(["500px", "600px"]);
    mouse(doc(), "pointermove", -5000, -5000);
    expect([layer.style.left, layer.style.top]).toEqual(["0px", "0px"]);
    mouse(doc(), "pointerup", 0, 0);
    mouse(doc(), "pointermove", 300, 300);
    expect(layer.style.left).toBe("0px");
  });

  test("a press on the close button does not start a drag, and close and Esc both close", () => {
    let closed = 0;
    render(createElement(m.Popout, { title: "Trackers", width: 300, initial: { x: 100, y: 100 }, bounds, onClose: () => { closed++; } }));
    const layer = part("scene.messenger.panel.popout-layer");
    mouse(byLabel("Close popout"), "pointerdown", 10, 10);
    mouse(doc(), "pointermove", 400, 400);
    expect(layer.style.left).toBe("100px");
    click(byLabel("Close popout"));
    key(doc().body, "Escape");
    expect(closed).toBe(2);
  });
});

describe("ContextMenu", () => {
  const spy = (): { picked: string[]; entries: MenuEntry[] } => {
    const picked: string[] = [];
    const entries: MenuEntry[] = [
      { id: "edit", label: "Edit message", onSelect: () => picked.push("edit") },
      { id: "sep1", separator: true },
      { id: "tools", label: "Writing tools", submenu: [{ id: "shorter", label: "Make shorter", onSelect: () => picked.push("shorter") }] },
      { id: "delete", label: "Delete", danger: true, onSelect: () => picked.push("delete") },
    ];
    return { picked, entries };
  };
  const bounds = (): { w: number; h: number } => ({ w: 1000, h: 800 });

  test("opens at the pointer, focuses the first item and draws a separator", () => {
    const { entries } = spy();
    render(createElement(m.ContextMenu, { items: entries, at: { x: 40, y: 60 }, bounds, onClose: () => undefined }));
    const box = part("scene.messenger.menu.context");
    expect([box.style.left, box.style.top]).toEqual(["40px", "60px"]);
    expect(items().map((i) => i.textContent)).toEqual(["Edit message", "Writing tools>", "Delete"]);
    expect(doc().querySelector('[role="separator"]')).not.toBeNull();
    expect(doc().activeElement).toBe(items()[0]!);
  });

  test("arrows move focus and wrap, Enter selects and closes", () => {
    const { entries, picked } = spy();
    let closed = 0;
    render(createElement(m.ContextMenu, { items: entries, at: { x: 0, y: 0 }, bounds, onClose: () => { closed++; } }));
    key(doc().activeElement!, "ArrowDown");
    expect(doc().activeElement).toBe(items()[1]!);
    key(doc().activeElement!, "ArrowDown");
    key(doc().activeElement!, "ArrowDown");
    expect(doc().activeElement).toBe(items()[0]!);
    key(doc().activeElement!, "ArrowUp");
    expect(doc().activeElement).toBe(items()[2]!);
    key(doc().activeElement!, "Home");
    key(doc().activeElement!, "Enter");
    expect(picked).toEqual(["edit"]);
    expect(closed).toBe(1);
  });

  test("Right opens a submenu and Left or Esc returns to its parent without closing the menu", () => {
    const { entries, picked } = spy();
    let closed = 0;
    render(createElement(m.ContextMenu, { items: entries, at: { x: 0, y: 0 }, bounds, onClose: () => { closed++; } }));
    key(doc().activeElement!, "ArrowDown");
    key(doc().activeElement!, "ArrowRight");
    const sub = part("scene.messenger.menu.submenu");
    expect(sub.getAttribute("aria-label")).toBe("Writing tools");
    expect(doc().activeElement).toBe(sub.querySelector('[role="menuitem"]'));
    key(doc().activeElement!, "ArrowLeft");
    expect(part("scene.messenger.menu.submenu")).toBeNull();
    expect(doc().activeElement).toBe(items()[1]!);
    key(doc().activeElement!, "ArrowRight");
    key(doc().activeElement!, "Escape");
    expect(part("scene.messenger.menu.submenu")).toBeNull();
    expect(closed).toBe(0);
    key(doc().activeElement!, "ArrowRight");
    key(doc().activeElement!, "Enter");
    expect(picked).toEqual(["shorter"]);
    expect(closed).toBe(1);
  });

  test("Esc and a press outside close it, a click on an item selects it", () => {
    const { entries, picked } = spy();
    let closed = 0;
    render(createElement(m.ContextMenu, { items: entries, at: { x: 0, y: 0 }, bounds, onClose: () => { closed++; } }));
    key(doc().activeElement!, "Escape");
    expect(closed).toBe(1);
    mouse(doc().body, "pointerdown", 900, 700);
    expect(closed).toBe(2);
    mouse(items()[0]!, "pointerdown", 1, 1);
    expect(closed).toBe(2);
    click(items()[2]!);
    expect(picked).toEqual(["delete"]);
  });

  test("stays inside the viewport when the pointer is near an edge", () => {
    const { entries } = spy();
    render(createElement(m.ContextMenu, { items: entries, at: { x: 990, y: 790 }, bounds, onClose: () => undefined }));
    const box = part("scene.messenger.menu.context");
    expect(Number.parseInt(box.style.left, 10)).toBeLessThanOrEqual(1000 - 260);
  });
});

describe("useContextMenuTrigger", () => {
  function Target({ holdMs }: { holdMs: number }): JSX.Element {
    const t = m.useContextMenuTrigger(holdMs);
    return <div data-testid="t" {...t.bind}>{t.at ? `open ${t.at.x},${t.at.y}` : "closed"}</div>;
  }
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

  test("right click opens at the pointer", () => {
    render(createElement(Target, { holdMs: 20 }));
    const t = doc().querySelector<HTMLElement>('[data-testid="t"]')!;
    mouse(t, "contextmenu", 12, 34);
    expect(t.textContent).toBe("open 12,34");
  });

  test("a held touch opens it, a moved or released touch does not", async () => {
    render(createElement(Target, { holdMs: 15 }));
    const t = doc().querySelector<HTMLElement>('[data-testid="t"]')!;
    const asTouch = (type: string, x: number, y: number): void => {
      const ev = new installed.dom.window.MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
      Object.defineProperty(ev, "pointerType", { value: "touch" });
      flush(() => { t.dispatchEvent(ev); });
    };
    asTouch("pointerdown", 5, 5); asTouch("pointerup", 5, 5);
    await wait(40);
    expect(t.textContent).toBe("closed");
    asTouch("pointerdown", 5, 5); asTouch("pointermove", 60, 5);
    await wait(40);
    expect(t.textContent).toBe("closed");
    asTouch("pointerdown", 7, 9);
    await wait(40);
    flush(() => undefined);
    expect(t.textContent).toBe("open 7,9");
  });
});

describe("PanelSwitcher", () => {
  const panels = [
    { id: "booth", label: "Control Booth", icon: "lucide:sliders-horizontal" as const, pinned: true, kind: "Side" },
    { id: "lore", label: "Lorebooks", icon: "lucide:book-open" as const, pinned: true, kind: "Side" },
    { id: "regex", label: "Regex Workshop", icon: "lucide:puzzle" as const, kind: "Layer" },
  ];

  test("draws only pinned panels as buttons and presses the open one", () => {
    render(createElement(m.PanelSwitcher, { panels, openId: "lore", onOpen: () => undefined, onClose: () => undefined }));
    expect(byLabel("Control Booth").getAttribute("aria-pressed")).toBe("false");
    expect(byLabel("Lorebooks").getAttribute("aria-pressed")).toBe("true");
    expect(byLabel("Regex Workshop")).toBeNull();
  });

  test("clicking another panel opens it and clicking the open one closes it", () => {
    const calls: string[] = [];
    render(createElement(m.PanelSwitcher, { panels, openId: "lore", onOpen: (id: string) => calls.push(`open ${id}`), onClose: () => calls.push("close") }));
    click(byLabel("Control Booth"));
    click(byLabel("Lorebooks"));
    expect(calls).toEqual(["open booth", "close"]);
  });

  test("All panels lists every panel, opens one on Enter and returns focus to the grid button on Esc", () => {
    const calls: string[] = [];
    render(createElement(m.PanelSwitcher, { panels, openId: null, onOpen: (id: string) => calls.push(id), onClose: () => undefined }));
    const grid = byLabel("All panels") as HTMLElement;
    expect(grid.getAttribute("aria-expanded")).toBe("false");
    click(grid);
    expect(grid.getAttribute("aria-expanded")).toBe("true");
    expect(items().map((i) => i.textContent)).toEqual(["Control BoothSide", "LorebooksSide", "Regex WorkshopLayer"]);
    key(doc().activeElement!, "Escape");
    expect(part("scene.messenger.panel.all-menu")).toBeNull();
    expect(doc().activeElement).toBe(grid);
    click(grid);
    expect(doc().activeElement).toBe(part("scene.messenger.panel.find"));
    key(doc().activeElement!, "ArrowDown");
    key(doc().activeElement!, "ArrowDown");
    key(doc().activeElement!, "ArrowDown");
    key(doc().activeElement!, "Enter");
    expect(calls).toEqual(["regex"]);
    expect(part("scene.messenger.panel.all-menu")).toBeNull();
  });

  const wings = [
    { id: "booth", label: "Control Booth", icon: "lucide:sliders-horizontal" as const, pinned: true, kind: "Side", group: "Scene" },
    { id: "lore", label: "Lorebooks", icon: "lucide:book-open" as const, kind: "Side", group: "World" },
    { id: "compendium", label: "Compendium", icon: "lucide:library-big" as const, kind: "Layer", group: "World" },
    { id: "regex", label: "Regex Workshop", icon: "lucide:regex" as const, kind: "Layer", group: "Final Cut" },
  ];
  const groups = (): string[] => [...doc().querySelectorAll<HTMLElement>('[data-part="scene.messenger.panel.group"]')].map((g) => g.textContent ?? "");
  const type = (box: HTMLElement, value: string): void => {
    flush(() => {
      Object.getOwnPropertyDescriptor(installed.dom.window.HTMLInputElement.prototype, "value")!.set!.call(box, value);
      box.dispatchEvent(new installed.dom.window.Event("input", { bubbles: true }));
    });
  };
  const bare = { openId: null, onOpen: () => undefined, onClose: () => undefined };

  test("All panels groups panels by wing in the order given", () => {
    render(createElement(m.PanelSwitcher, { panels: wings, ...bare }));
    click(byLabel("All panels"));
    expect(groups()).toEqual(["Scene", "World", "Final Cut"]);
    expect(items().map((i) => i.textContent)).toEqual(["Control BoothSide", "LorebooksSide", "CompendiumLayer", "Regex WorkshopLayer"]);
  });

  test("the find box filters by name, wing or kind and says so when nothing matches", () => {
    render(createElement(m.PanelSwitcher, { panels: wings, ...bare }));
    click(byLabel("All panels"));
    const box = part("scene.messenger.panel.find");
    type(box, "comp");
    expect(items().map((i) => i.textContent)).toEqual(["CompendiumLayer"]);
    expect(groups()).toEqual(["World"]);
    type(box, "layer");
    expect(items().map((i) => i.textContent)).toEqual(["CompendiumLayer", "Regex WorkshopLayer"]);
    type(box, "final cut");
    expect(items().map((i) => i.textContent)).toEqual(["Regex WorkshopLayer"]);
    type(box, "zzz");
    expect(items()).toHaveLength(0);
    expect(part("scene.messenger.panel.none").textContent).toContain("No panel matches");
  });

  test("the star pins or unpins without opening the panel or closing the menu", () => {
    const calls: string[] = [];
    render(createElement(m.PanelSwitcher, { panels: wings, ...bare, onOpen: (id: string) => calls.push(`open ${id}`), onTogglePin: (id: string) => calls.push(`pin ${id}`) }));
    click(byLabel("All panels"));
    expect(byLabel("Unpin Control Booth").getAttribute("aria-checked")).toBe("true");
    expect(byLabel("Pin Lorebooks").getAttribute("aria-checked")).toBe("false");
    click(byLabel("Pin Lorebooks"));
    click(byLabel("Unpin Control Booth"));
    expect(calls).toEqual(["pin lore", "pin booth"]);
    expect(part("scene.messenger.panel.all-menu")).not.toBeNull();
  });

  test("no stars are drawn when pinning is not wired", () => {
    render(createElement(m.PanelSwitcher, { panels: wings, ...bare }));
    click(byLabel("All panels"));
    expect(doc().querySelector('[data-part="scene.messenger.panel.star"]')).toBeNull();
  });

  test("Right arrow moves from a row to its star, Left returns, Enter on the star pins", () => {
    const calls: string[] = [];
    render(createElement(m.PanelSwitcher, { panels: wings, ...bare, onOpen: (id: string) => calls.push(`open ${id}`), onTogglePin: (id: string) => calls.push(`pin ${id}`) }));
    click(byLabel("All panels"));
    key(doc().activeElement!, "ArrowDown");
    expect(doc().activeElement).toBe(items()[0]!);
    key(doc().activeElement!, "ArrowRight");
    expect(doc().activeElement).toBe(byLabel("Unpin Control Booth"));
    key(doc().activeElement!, "ArrowLeft");
    expect(doc().activeElement).toBe(items()[0]!);
    key(doc().activeElement!, "ArrowRight");
    key(doc().activeElement!, "Enter");
    expect(calls).toEqual(["pin booth"]);
  });

  test("Esc from the find box closes the menu and returns focus to the grid button", () => {
    render(createElement(m.PanelSwitcher, { panels: wings, ...bare }));
    const grid = byLabel("All panels");
    click(grid);
    key(part("scene.messenger.panel.find"), "Escape");
    expect(part("scene.messenger.panel.all-menu")).toBeNull();
    expect(doc().activeElement).toBe(grid);
  });

  test("reopening the menu starts with an empty find box", () => {
    render(createElement(m.PanelSwitcher, { panels: wings, ...bare }));
    click(byLabel("All panels"));
    type(part("scene.messenger.panel.find"), "comp");
    click(byLabel("All panels"));
    click(byLabel("All panels"));
    expect((part("scene.messenger.panel.find") as HTMLInputElement).value).toBe("");
  });
});
