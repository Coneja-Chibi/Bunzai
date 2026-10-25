/** The Stage wing's Appearance tab: RoleCall's controls and copy, each one writing its preference, Reset returning the one default. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { useState } from "react";
import type { JSDOM } from "jsdom";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { LOOK_DEFAULTS, LOOK_KEYS, readLook } from "./stage-look-core";
import { AUTO_OPEN_KEY, CAP_LONG_KEY } from "./scene-reasoning-core";
import { SHOW_TIMESTAMPS_KEY } from "./scene-meta-core";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/", extraGlobals: ["MouseEvent", "Event", "HTMLInputElement"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

interface Mounted { host: HTMLElement; store: Record<string, unknown>; writes: [string, unknown][]; done(): void; flush(fn: () => void): void }
async function mount(initial: Record<string, unknown> = {}, scene = true): Promise<Mounted> {
  const [{ flushSync }, { createRoot }, { StageAppearance }] = await Promise.all([import("react-dom"), import("react-dom/client"), import("./stage-appearance")]);
  const store: Record<string, unknown> = { ...initial };
  const writes: [string, unknown][] = [];
  const Harness = () => {
    const [, tick] = useState(0);
    return <StageAppearance prefs={{ get: (k) => store[k] }} onSet={(k, v) => { writes.push([k, v]); store[k] = v; tick((n) => n + 1); }}
      {...(scene ? { colors: { character: "#008080" }, backdrop: <div className="bd-row">Backdrop row</div> } : {})} />;
  };
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<Harness />));
  return { host, store, writes, flush: (fn) => flushSync(fn), done: () => { flushSync(() => root.unmount()); host.remove(); } };
}
const act = (m: Mounted, title: string): HTMLElement => [...m.host.querySelectorAll<HTMLElement>(".sa-act")].find((a) => a.getAttribute("aria-label") === title)!;
const click = (m: Mounted, el: Element): void => m.flush(() => (el as HTMLElement).click());
const byText = (root: ParentNode, selector: string, text: string): HTMLElement => [...root.querySelectorAll<HTMLElement>(selector)].find((e) => e.textContent?.startsWith(text))!;
const slider = (root: ParentNode, label: string): HTMLInputElement => root.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
function drag(m: Mounted, input: HTMLInputElement, value: number): void {
  const set = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value")!.set!;
  set.call(input, String(value));
  m.flush(() => input.dispatchEvent(new dom.window.Event("input", { bubbles: true })));
}
const sw = (root: ParentNode, name: string): HTMLButtonElement => root.querySelector<HTMLButtonElement>(`button[role=switch][aria-label$="${name.toLowerCase()}"]`)!;

describe("Appearance tab: shell", () => {
  test("RoleCall's hero, the Chat Theme cards and the five acts in order", async () => {
    const m = await mount();
    expect(m.host.querySelector(".hero .eb")?.textContent).toBe("Scene presentation");
    expect(m.host.querySelector(".hero h2")?.textContent).toBe("Appearance");
    expect(m.host.querySelector(".hero p")?.textContent).toBe("Tune how the scene looks: message style, layout, typography, backgrounds, and accent colors for this chat.");
    expect([...m.host.querySelectorAll(".sa-card b")].map((b) => b.textContent)).toEqual(["Basic", "Full Stage", "Immersive"]);
    expect([...m.host.querySelectorAll(".sa-card small")].map((b) => b.textContent)).toEqual(["Just the chat and one settings button.", "Wings, tools, and production controls.", "Cinematic overlays, letterboxed."]);
    expect([...m.host.querySelectorAll(".sa-act .ttl")].map((t) => t.textContent)).toEqual(["The Message", "The Type", "The Stage", "Motion & Signals", "Chrome & Device"]);
    m.done();
  });
  test("with no scene open the Stage act has nothing to hold and is not drawn", async () => {
    const m = await mount({}, false);
    expect([...m.host.querySelectorAll(".sa-act .ttl")].map((t) => t.textContent)).toEqual(["The Message", "The Type", "Motion & Signals", "Chrome & Device"]);
    m.done();
  });
  test("a theme card writes the Chat Theme and marks itself", async () => {
    const m = await mount();
    expect(byText(m.host, ".sa-card", "Full Stage").getAttribute("aria-pressed")).toBe("true");
    click(m, byText(m.host, ".sa-card", "Immersive"));
    click(m, byText(m.host, ".sa-card", "Basic"));
    expect(m.writes).toEqual([[LOOK_KEYS.chatTheme, "immersive"], [LOOK_KEYS.chatTheme, "basic"]]);
    expect(byText(m.host, ".sa-card", "Basic").getAttribute("aria-pressed")).toBe("true");
    m.done();
  });
  test("an act folds to a one-line status and the fold is saved per user", async () => {
    const m = await mount({ [LOOK_KEYS.size]: 18, [LOOK_KEYS.font]: "lexend" });
    expect(act(m, "The Type").querySelector(".st")).toBeNull();
    click(m, act(m, "The Type").querySelector("button")!);
    expect(m.writes.at(-1)).toEqual([LOOK_KEYS.acts, ["type"]]);
    expect(act(m, "The Type").querySelector(".st")?.textContent).toBe("18px · Lexend");
    expect(act(m, "The Type").querySelector(".sa-body")).toBeNull();
    click(m, act(m, "Motion & Signals").querySelector("button")!);
    expect(act(m, "Motion & Signals").querySelector(".st")?.textContent).toBe("Smart scroll");
    click(m, act(m, "The Type").querySelector("button")!);
    expect(act(m, "The Type").querySelector(".sa-body")).not.toBeNull();
    expect(m.store[LOOK_KEYS.acts]).toEqual(["motion"]);
    m.done();
  });
});

describe("Appearance tab: The Message", () => {
  test("opacity and spacing sliders carry RoleCall's copy and write their preference; Reset returns the default", async () => {
    const m = await mount();
    const a = act(m, "The Message");
    expect(a.textContent).toContain("Controls how see-through message bubbles and borders are (100% = default)");
    expect(a.textContent).toContain("Extra vertical space between messages (0 = default spacing)");
    expect(a.textContent).toContain("100%");
    expect(a.textContent).toContain("0px");
    expect(a.querySelector(".sa-reset")).toBeNull();
    drag(m, slider(a, "Message Bubble Opacity"), 0.5);
    drag(m, slider(a, "Message Spacing"), 12);
    expect(m.writes).toEqual([[LOOK_KEYS.opacity, 0.5], [LOOK_KEYS.gap, 12]]);
    expect(a.textContent).toContain("50%");
    expect(a.textContent).toContain("12px");
    for (const r of [...a.querySelectorAll(".sa-reset")]) click(m, r);
    expect(m.writes.slice(2)).toEqual([[LOOK_KEYS.opacity, null], [LOOK_KEYS.gap, null]]);
    expect(readLook({ get: (k) => m.store[k] })).toEqual(LOOK_DEFAULTS);
    m.done();
  });
  test("Show Avatars and Show Timestamps are switches; timestamps keep their existing preference", async () => {
    const m = await mount();
    const a = act(m, "The Message");
    expect(sw(a, "Show Avatars").getAttribute("aria-checked")).toBe("true");
    click(m, sw(a, "Show Avatars"));
    click(m, sw(a, "Show Timestamps"));
    expect(m.writes).toEqual([[LOOK_KEYS.avatars, false], [SHOW_TIMESTAMPS_KEY, false]]);
    expect(sw(a, "Show Avatars").getAttribute("aria-checked")).toBe("false");
    m.done();
  });
  test("the closed status names the theme's message and layout variants, not a picker RoleCall had", async () => {
    const m = await mount();
    click(m, act(m, "The Message").querySelector("button")!);
    expect(act(m, "The Message").querySelector(".st")?.textContent).toBe("Default · Default");
    expect(m.host.textContent).not.toContain("Bubble Style");
    expect(m.host.textContent).not.toContain("Grouped Alignment");
    m.done();
  });
});

describe("Appearance tab: The Type", () => {
  test("text size and line spacing sliders", async () => {
    const m = await mount();
    const a = act(m, "The Type");
    expect(a.textContent).toContain("Message text size only.");
    expect(a.textContent).toContain("Controls spacing between lines of text (1.0 = tight, 2.0 = spacious)");
    expect(a.textContent).toContain("16px");
    expect(a.textContent).toContain("1.6x");
    drag(m, slider(a, "Message Text Size"), 20);
    drag(m, slider(a, "Line Spacing"), 2);
    expect(m.writes).toEqual([[LOOK_KEYS.size, 20], [LOOK_KEYS.lineHeight, 2]]);
    m.done();
  });
  test("seven faces, each set in its own face with a sample line and RoleCall's notes", async () => {
    const m = await mount();
    const cards = [...act(m, "The Type").querySelectorAll<HTMLElement>(".sa-font")];
    expect(cards.map((c) => c.querySelector(".nm")?.textContent)).toEqual(["Sans (Default)", "OpenDyslexic", "Lexend", "Atkinson Hyperlegible", "Serif", "Editorial", "Monospace"]);
    expect(cards.map((c) => c.querySelector(".nt")?.textContent ?? "")).toEqual(["", "Dyslexia-friendly", "Easy reading", "High legibility", "", "", ""]);
    expect(cards.every((c) => c.querySelector("small")?.textContent === "The quick brown fox")).toBe(true);
    expect(cards[2]!.style.fontFamily).toContain("Lexend");
    expect(cards[0]!.getAttribute("aria-pressed")).toBe("true");
    click(m, cards[2]!);
    expect(m.writes).toEqual([[LOOK_KEYS.font, "lexend"]]);
    expect(act(m, "The Type").querySelectorAll(".sa-font")[2]!.getAttribute("aria-pressed")).toBe("true");
    m.done();
  });
  test("three text colours read Auto until set, then show the colour and a Reset that writes null", async () => {
    const m = await mount({ [LOOK_KEYS.colorChar]: "#aabbcc" });
    const rows = [...act(m, "The Type").querySelectorAll<HTMLElement>(".sa-color")];
    expect(rows.map((r) => r.querySelector(".cp")?.textContent)).toEqual(["Character", "User", "Dialogue"]);
    expect(rows.map((r) => r.querySelector(".hx")?.textContent)).toEqual(["#aabbcc", "Auto", "Auto"]);
    expect(rows.map((r) => r.querySelector(".sa-reset") !== null)).toEqual([true, false, false]);
    expect(act(m, "The Type").textContent).toContain("Character and user colors set narration. Dialogue changes quoted character speech; reset it to use accent and per-speaker colors.");
    click(m, rows[0]!.querySelector(".sa-reset")!);
    expect(m.writes).toEqual([[LOOK_KEYS.colorChar, null]]);
    expect([...act(m, "The Type").querySelectorAll(".sa-color .hx")].map((h) => h.textContent)).toEqual(["Auto", "Auto", "Auto"]);
    m.done();
  });
  test("a custom colour is committed whole through the house colour picker, and the Dialogue picker starts at the scene accent", async () => {
    const m = await mount();
    const dialogue = [...act(m, "The Type").querySelectorAll<HTMLElement>(".sa-color")][2]!;
    const tile = dialogue.querySelector<HTMLElement>('button[title="Custom color"]')!;
    expect(tile.style.background).toContain("rgb(0, 128, 128)");
    m.done();
  });
});

describe("Appearance tab: Motion & Signals and Chrome & Device", () => {
  test("Auto-Scroll tiles carry RoleCall's live help", async () => {
    const m = await mount();
    const a = act(m, "Motion & Signals");
    expect(a.textContent).toContain("Scroll only when near bottom");
    click(m, byText(a, ".sa-tile", "Always"));
    expect(act(m, "Motion & Signals").textContent).toContain("Always scroll to new messages");
    click(m, byText(act(m, "Motion & Signals"), ".sa-tile", "Never"));
    expect(act(m, "Motion & Signals").textContent).toContain("Never auto-scroll, show indicator");
    expect(m.writes).toEqual([[LOOK_KEYS.autoScroll, "always"], [LOOK_KEYS.autoScroll, "never"]]);
    m.done();
  });
  test("the five signal switches write their preferences, reasoning through its own existing keys", async () => {
    const m = await mount();
    const a = act(m, "Motion & Signals");
    expect(["Typing Indicator", "Streaming Fade-In", "Response Chime", "Auto-Open Reasoning", "Cap long reasoning"].map((n) => sw(a, n).getAttribute("aria-checked"))).toEqual(["true", "true", "false", "true", "false"]);
    for (const n of ["Typing Indicator", "Streaming Fade-In", "Response Chime", "Auto-Open Reasoning", "Cap long reasoning"]) click(m, sw(a, n));
    expect(m.writes).toEqual([[LOOK_KEYS.typing, false], [LOOK_KEYS.fadeIn, false], [LOOK_KEYS.chime, true], [AUTO_OPEN_KEY, false], [CAP_LONG_KEY, true]]);
    m.done();
  });
  test("compact mode, collapsed wings with their edge style, and wing labels", async () => {
    const m = await mount();
    const a = act(m, "Chrome & Device");
    expect(a.querySelector(".sa-edge")).toBeNull();
    click(m, sw(a, "Compact Mode"));
    click(m, sw(a, "Collapse Wing Panels"));
    const edge = act(m, "Chrome & Device").querySelector<HTMLElement>(".sa-edge")!;
    expect(edge.textContent).toContain("Edge Indicator Style");
    expect([...edge.querySelectorAll(".sa-tile")].map((t) => t.textContent)).toEqual(["SingleClean glow line", "SegmentedEach panel has its own color segment"]);
    click(m, byText(edge, ".sa-tile", "Segmented"));
    click(m, sw(act(m, "Chrome & Device"), "Show Wing Labels on Hover"));
    expect(m.writes).toEqual([[LOOK_KEYS.compact, true], [LOOK_KEYS.collapse, true], [LOOK_KEYS.collapseStyle, "segmented"], [LOOK_KEYS.labels, false]]);
    m.done();
  });
  test("RoleCall's dead or foreign controls are not drawn", async () => {
    const m = await mount();
    for (const gone of ["Grouped Alignment", "Composer Debug Tools", "Phone Controls", "Chat Input Resize", "Header Size", "Saving..."]) expect(m.host.textContent).not.toContain(gone);
    m.done();
  });
  test("every preference round-trips: after resetting what was set, the look is the defaults", async () => {
    const m = await mount();
    drag(m, slider(act(m, "The Type"), "Message Text Size"), 22);
    click(m, byText(act(m, "The Type"), ".sa-font", "Serif"));
    for (const r of [...m.host.querySelectorAll(".sa-reset")]) click(m, r);
    click(m, byText(act(m, "The Type"), ".sa-font", "Sans"));
    m.flush(() => undefined);
    m.store[LOOK_KEYS.font] = null;
    expect(readLook({ get: (k) => m.store[k] })).toEqual(LOOK_DEFAULTS);
    m.done();
  });
});
