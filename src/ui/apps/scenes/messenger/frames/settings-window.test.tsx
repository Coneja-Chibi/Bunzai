/**
 * The scoped settings layer (settings-window.tsx) and its row primitives (settings-rows.tsx): the nav renders the data, a category expands in place to its sections, a section click marks
 * it current and scrolls the page, a row can push a deeper page and the back arrow pops it, Escape and the close circle close the layer, and every row primitive reports its change.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { createElement, type JSX } from "react";
import type { Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../../../_shared/test-dom";
import type { SettingsScope, SettingsWindowProps } from "./settings-window";

type FlushSync = typeof import("react-dom")["flushSync"];
let installed: InstalledDom;
let mod: typeof import("./settings-window");
let rows: typeof import("./settings-rows");
beforeAll(async () => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8327/", observers: true, extraGlobals: ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "SVGElement", "Event", "KeyboardEvent", "getComputedStyle"] });
  mod = await import("./settings-window");
  rows = await import("./settings-rows");
});
afterAll(() => installed.teardown());

const rig = { host: null as unknown as HTMLElement, root: null as unknown as Root, flush: null as unknown as FlushSync };
async function mount(node: JSX.Element): Promise<void> {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  rig.flush = flushSync;
  rig.host = installed.dom.window.document.createElement("div");
  installed.dom.window.document.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  flushSync(() => rig.root.render(node));
}
afterEach(() => { if (rig.host?.isConnected) { rig.flush(() => rig.root.unmount()); rig.host.remove(); } });

const nth = <T,>(xs: readonly T[], i: number): T => { const x = xs[i]; if (x === undefined) throw new Error(`no item ${i}`); return x; };
const all = (sel: string): HTMLElement[] => [...rig.host.querySelectorAll<HTMLElement>(sel)];
const part = (name: string): HTMLElement[] => all(`[data-part="${name}"]`);
const one = (name: string): HTMLElement => { const hit = part(name); if (hit.length !== 1) throw new Error(`${hit.length} of ${name}`); return nth(hit, 0); };
const text = (els: HTMLElement[]): string[] => els.map((e) => e.textContent?.trim() ?? "");
const click = (el: Element): void => { rig.flush(() => (el as HTMLElement).click()); };
const key = (k: string): void => { rig.flush(() => { installed.dom.window.document.dispatchEvent(new installed.dom.window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); }); };
const S = "scene.messenger.settings";

function DrillBody(): JSX.Element {
  const nav = mod.useSettingsNav();
  return <rows.DrillRow label="Models" value="142 available" onOpen={() => nav.open("models")} />;
}
const scope: SettingsScope = {
  id: "user", title: "Chibee", kind: "You", edit: { label: "Edit profile", onClick: () => undefined },
  categories: [
    { id: "profile", label: "My profile", icon: "lucide:user", sections: [{ id: "persona", title: "Persona", description: "Who you play.", body: <p>persona body</p> }, { id: "others", title: "Other personas", body: <p>others body</p> }] },
    { id: "conn", label: "AI connection", icon: "lucide:settings", group: "Experience", sections: [{ id: "provider", title: "Provider", body: <DrillBody /> }, { id: "keys", title: "Keys", body: <p>keys body</p> }] },
  ],
};
const deepPages: Record<string, { title: string; sections: { id: string; title: string; body: JSX.Element }[] }> = {
  models: { title: "Models list", sections: [{ id: "fav", title: "Favorites", body: <p>favorites body</p> }] },
};
const view = (over: Partial<SettingsWindowProps> = {}): JSX.Element =>
  createElement(mod.SettingsWindow, { scope, onClose: () => undefined, resolveDeep: (id: string) => deepPages[id], ...over });

describe("settings window", () => {
  test("renders the scope header, the categories and the first category's blocks", async () => {
    await mount(view());
    expect(text(part(`${S}.category`))).toEqual(["My profile", "AI connection"]);
    expect(one(`${S}.scope`).textContent).toContain("Chibee");
    expect(text(part(`${S}.section`).map((s) => s.querySelector("h2") as HTMLElement))).toEqual(["Persona", "Other personas"]);
    expect(all(".msn-st-cap").map((c) => c.textContent)).toEqual(["Experience"]);
    expect(nth(part(`${S}.category`), 0).getAttribute("aria-current")).toBe("page");
  });

  test("the scope's edit link is drawn only when given", async () => {
    await mount(view({ scope: { ...scope, edit: undefined } }));
    expect(part(`${S}.edit`)).toHaveLength(0);
  });

  test("a category expands in place to its sections and the others stay collapsed", async () => {
    await mount(view());
    expect(text(part(`${S}.nav-section`))).toEqual(["Persona", "Other personas"]);
    click(nth(part(`${S}.category`), 1));
    expect(text(part(`${S}.nav-section`))).toEqual(["Provider", "Keys"]);
    expect(text(part(`${S}.section`).map((s) => s.querySelector("h2") as HTMLElement))).toEqual(["Provider", "Keys"]);
    expect(nth(part(`${S}.category`), 1).getAttribute("aria-current")).toBe("page");
  });

  test("clicking a section marks it current and scrolls the page to it", async () => {
    const calls: unknown[] = [];
    (installed.dom.window.HTMLElement.prototype as unknown as { scrollTo: (o: unknown) => void }).scrollTo = (o) => { calls.push(o); };
    await mount(view());
    const first = nth(part(`${S}.nav-section`), 0);
    const second = nth(part(`${S}.nav-section`), 1);
    expect(first.getAttribute("aria-current")).toBe("true");
    click(second);
    expect(second.getAttribute("aria-current")).toBe("true");
    expect(first.getAttribute("aria-current")).toBeNull();
    expect(calls.some((c) => typeof (c as { top?: number }).top === "number" && (c as { behavior?: string }).behavior !== undefined)).toBe(true);
  });

  test("a drill row pushes a deeper page, back pops it, and the stack is reported", async () => {
    const stacks: (readonly string[])[] = [];
    await mount(view({ initialCategory: "conn", onDeepChange: (s) => { stacks.push(s); } }));
    click(one(`${S}.row.drill`));
    expect(one(`${S}.top`).textContent).toContain("Provider");
    expect(rig.host.querySelector("h2.msn-st-h1")?.textContent).toBe("Models list");
    expect(rig.host.textContent).toContain("favorites body");
    expect(part(`${S}.chip`)).toHaveLength(0);
    click(one(`${S}.back`));
    expect(part(`${S}.back`)).toHaveLength(0);
    expect(rig.host.textContent).toContain("keys body");
    expect(stacks.map((s) => s.join(">"))).toEqual(["", "models", ""]);
  });

  test("a drill row with no page behind it does nothing", async () => {
    await mount(view({ initialCategory: "conn", resolveDeep: () => null }));
    click(one(`${S}.row.drill`));
    expect(part(`${S}.back`)).toHaveLength(0);
  });

  const find = (): HTMLInputElement => one(`${S}.search`) as HTMLInputElement;
  const type = (value: string): void => {
    rig.flush(() => {
      Object.getOwnPropertyDescriptor(installed.dom.window.HTMLInputElement.prototype, "value")!.set!.call(find(), value);
      find().dispatchEvent(new installed.dom.window.Event("input", { bubbles: true }));
    });
  };
  const withWords: SettingsScope = { ...scope, categories: scope.categories.map((c) => c.id === "conn" ? { ...c, sections: c.sections.map((s) => s.id === "keys" ? { ...s, keywords: ["api key", "token"] } : s) } : c) };

  test("the search box lists matching sections with their category and swaps out the nav", async () => {
    await mount(view({ scope: withWords }));
    expect(part(`${S}.category`)).toHaveLength(2);
    type("token");
    expect(part(`${S}.category`)).toHaveLength(0);
    expect(text(part(`${S}.result`))).toEqual(["KeysAI connection"]);
    type("zzz");
    expect(part(`${S}.result`)).toHaveLength(0);
    expect(one(`${S}.search-none`).textContent).toContain("No setting matches");
    type("");
    expect(part(`${S}.category`)).toHaveLength(2);
  });

  test("choosing a result opens its category, marks the section and scrolls to it", async () => {
    const calls: unknown[] = [];
    (installed.dom.window.HTMLElement.prototype as unknown as { scrollTo: (o: unknown) => void }).scrollTo = (o) => { calls.push(o); };
    await mount(view({ scope: withWords }));
    type("api key");
    click(one(`${S}.result`));
    expect(find().value).toBe("");
    expect(nth(part(`${S}.category`), 1).getAttribute("aria-current")).toBe("page");
    expect(text(part(`${S}.nav-section`).filter((e) => e.getAttribute("aria-current") === "true"))).toEqual(["Keys"]);
    expect(calls.some((c) => typeof (c as { top?: number }).top === "number" && (c as { behavior?: string }).behavior !== undefined)).toBe(true);
  });

  test("Escape clears a typed search first and only then closes the layer", async () => {
    let closed = 0;
    await mount(view({ onClose: () => { closed++; } }));
    type("per");
    rig.flush(() => { find().dispatchEvent(new installed.dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    expect(find().value).toBe("");
    expect(closed).toBe(0);
    key("Escape");
    expect(closed).toBe(1);
  });

  test("Backspace goes up one deeper page, and does nothing at the top or while typing", async () => {
    await mount(view({ initialCategory: "conn" }));
    key("Backspace");
    expect(part(`${S}.back`)).toHaveLength(0);
    click(one(`${S}.row.drill`));
    expect(one(`${S}.back`)).toBeTruthy();
    rig.flush(() => { find().focus(); });
    rig.flush(() => { find().dispatchEvent(new installed.dom.window.KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true })); });
    expect(one(`${S}.back`)).toBeTruthy();
    rig.flush(() => { find().blur(); });
    key("Backspace");
    expect(part(`${S}.back`)).toHaveLength(0);
    expect(rig.host.textContent).toContain("keys body");
  });

  test("Escape and the close circle close the layer", async () => {
    let closed = 0;
    await mount(view({ onClose: () => { closed++; } }));
    expect(one("scene.messenger.layer").getAttribute("role")).toBe("dialog");
    key("Escape");
    expect(closed).toBe(1);
    click(one("scene.messenger.layer.close"));
    expect(closed).toBe(2);
  });
});

describe("row primitives", () => {
  const opts = [{ value: "a", label: "Alpha", description: "first" }, { value: "b", label: "Beta", description: "second" }];
  const change = (el: HTMLElement, value: string): void => {
    const proto = el instanceof installed.dom.window.HTMLTextAreaElement ? installed.dom.window.HTMLTextAreaElement.prototype : el instanceof installed.dom.window.HTMLSelectElement ? installed.dom.window.HTMLSelectElement.prototype : installed.dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    rig.flush(() => { el.dispatchEvent(new installed.dom.window.Event(el instanceof installed.dom.window.HTMLSelectElement ? "change" : "input", { bubbles: true })); });
  };

  test("toggle row reports the flipped value", async () => {
    const seen: boolean[] = [];
    await mount(<rows.ToggleRow label="Chime" on={false} onChange={(v) => seen.push(v)} />);
    click(one(`${S}.row.toggle.switch`));
    expect(seen).toEqual([true]);
  });

  test("action row shows its value and reports the click", async () => {
    let n = 0;
    await mount(<rows.ActionRow label="Name" value="Mina" action="Edit" onAction={() => { n++; }} />);
    expect(rig.host.textContent).toContain("Mina");
    click(one(`${S}.row.action.button`));
    expect(n).toBe(1);
  });

  test("drill row reports the open", async () => {
    let n = 0;
    await mount(<rows.DrillRow label="Models" value="142" onOpen={() => { n++; }} />);
    click(one(`${S}.row.drill`));
    expect(n).toBe(1);
  });

  test("select row reports the chosen value", async () => {
    const seen: string[] = [];
    await mount(<rows.SelectRow label="Provider" value="a" options={opts} onChange={(v) => seen.push(v)} />);
    change(rig.host.querySelector("select")!, "b");
    expect(seen).toEqual(["b"]);
  });

  test("segmented row reports the chosen value", async () => {
    const seen: string[] = [];
    await mount(<rows.SegmentedRow label="Tempo" value="a" options={opts} onChange={(v) => seen.push(v)} />);
    click(nth(all('[data-part="scene.messenger.settings.row.segmented.group"] button'), 1));
    expect(seen).toEqual(["b"]);
  });

  test("slider row reports a number", async () => {
    const seen: number[] = [];
    await mount(<rows.SliderRow label="Opacity" value={10} min={0} max={100} unit="%" onChange={(v) => seen.push(v)} />);
    expect(rig.host.textContent).toContain("10%");
    change(rig.host.querySelector("input")!, "42");
    expect(seen).toEqual([42]);
  });

  test("number row reports a number and ignores an empty box", async () => {
    const seen: number[] = [];
    await mount(<rows.NumberRow label="Depth" value={4} onChange={(v) => seen.push(v)} />);
    const input = rig.host.querySelector("input")!;
    change(input, "7");
    change(input, "");
    expect(seen).toEqual([7]);
  });

  test("text area row reports the text", async () => {
    const seen: string[] = [];
    await mount(<rows.TextAreaRow label="Note" value="" onChange={(v) => seen.push(v)} />);
    change(rig.host.querySelector("textarea")!, "hello");
    expect(seen).toEqual(["hello"]);
  });

  test("radio cards mark the chosen one and report a pick", async () => {
    const seen: string[] = [];
    await mount(<rows.RadioCards label="Layout" value="a" options={opts} onChange={(v) => seen.push(v)} />);
    const cards = part(`${S}.row.radios.option`);
    expect(cards.map((c) => c.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    click(nth(cards, 1));
    expect(seen).toEqual(["b"]);
  });

  test("pair row reports each side on its own", async () => {
    const a: string[] = [];
    const b: string[] = [];
    await mount(<rows.PairRow a={{ label: "Model", value: "a", options: opts, onChange: (v) => a.push(v) }} b={{ label: "Fallback", value: "a", options: opts, onChange: (v) => b.push(v) }} />);
    const left = nth(all("select"), 0);
    const right = nth(all("select"), 1);
    change(right, "b");
    change(left, "b");
    expect({ a, b }).toEqual({ a: ["b"], b: ["b"] });
  });
});
