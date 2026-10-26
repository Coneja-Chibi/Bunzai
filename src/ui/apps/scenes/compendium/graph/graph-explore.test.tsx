/**
 * The Cross-Reference Graph explorer as it mounts (RoleCall `GraphExploreModal.tsx`): a node per typed entry, a click that only
 * selects, OPEN IN CODEX that opens the entry, the filters (eleven types, five connection kinds, orphans), search, pan and zoom, and
 * the layout that runs once per book revision however the view is driven. The Dashboard cell that opens it is covered last.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import type { LorebookEntry } from "../../../../../entities/lorebook/schema";
import { typedEntry } from "../../../../../core/compendium/fixture-book";
import { teardownAllDoms } from "../../../../_shared/test-dom";
import { bodyOf, installLoreDom, rig, settle, type FlushSync } from "../../fake-lore-rig";
import { buildModel, type BookModel } from "../compendium-core";
import { CrossRefCell } from "../cells/cell-graph";
import { createLayoutCache, settleLayout } from "./graph-core";
import { GraphExploreModal } from "./graph-explore";

const entries = (): LorebookEntry[] => [
  typedEntry("mira", "Mira Vance", "character", { relationships: [{ with: "Dov Ketter", nature: "ally" }], affiliations: [{ org: "Lantern Guild" }], current_state: { location: "The Quay" } }),
  typedEntry("dov", "Dov Ketter", "character", { relationships: [{ with: "Mira Vance" }] }),
  typedEntry("guild", "Lantern Guild", "organization", { leader: "Mira Vance" }),
  typedEntry("quay", "The Quay", "location", {}),
  typedEntry("kraken", "Old Kraken", "creature", { known_locations: ["The Quay"] }),
  typedEntry("lone", "Lone Rock", "location", {}),
];
const modelOf = (list = entries()): BookModel => buildModel(bodyOf("The Drowned Coast", list));

let flushSync: FlushSync;
let opened: string[] = [];
let closed = 0;
let layouts = 0;
const layoutOf = createLayoutCache((g) => { layouts += 1; return settleLayout(g); });
const doc = (): Document => rig.dom.window.document;
const dq = (sel: string): HTMLElement | null => doc().querySelector<HTMLElement>(sel);
const dqa = (sel: string): HTMLElement[] => [...doc().querySelectorAll<HTMLElement>(sel)];
const node = (id: string): HTMLElement | null => dq(`[data-node="${id}"]`);
const nodeIds = (): string[] => dqa("[data-node]").map((n) => n.getAttribute("data-node")!).sort();
const btn = (label: string): HTMLElement => dqa("button").find((b) => (b.textContent ?? "").trim().toLowerCase().startsWith(label.toLowerCase()))!;
const place = (id: string): string => node(id)!.getAttribute("transform")!;
const vp = (): { x: number; y: number; k: number } => { const m = /translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)/.exec(dq(".vp")!.getAttribute("transform")!)!; return { x: +m[1]!, y: +m[2]!, k: +m[3]! }; };
async function click(el: Element | null | undefined): Promise<void> { flushSync(() => { el!.dispatchEvent(new rig.dom.window.MouseEvent("click", { bubbles: true, cancelable: true })); }); await settle(flushSync); }
async function fire(el: Element, type: string, init: Record<string, number> = {}): Promise<void> { flushSync(() => { el.dispatchEvent(new rig.dom.window.MouseEvent(type, { bubbles: true, cancelable: true, ...init })); }); await settle(flushSync); }
async function wheel(deltaY: number, clientX: number, clientY: number): Promise<void> {
  flushSync(() => { const e = new rig.dom.window.Event("wheel", { bubbles: true, cancelable: true }); Object.assign(e, { deltaY, clientX, clientY }); dq(".gx-stage")!.dispatchEvent(e); });
  await settle(flushSync);
}

async function mount(m: BookModel): Promise<void> {
  const { createRoot } = await import("react-dom/client");
  rig.host = doc().createElement("div");
  doc().body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  flushSync(() => rig.root.render(createElement(GraphExploreModal, { m, layoutOf, onOpen: (id: string) => opened.push(id), onClose: () => { closed += 1; } })));
  await settle(flushSync);
}

beforeAll(async () => { installLoreDom(); flushSync = (await import("react-dom")).flushSync; });
afterAll(async () => { await teardownAllDoms(); });
beforeEach(() => { rig.installed?.reinstall(); opened = []; closed = 0; layouts = 0; });
afterEach(() => { flushSync(() => rig.root.unmount()); rig.host.remove(); });

describe("the explorer", () => {
  test("draws a node for every typed entry, creatures included, with the header, filters and status bar of RoleCall's modal", async () => {
    await mount(modelOf());
    expect(nodeIds()).toEqual(["dov", "guild", "kraken", "lone", "mira", "quay"]);
    expect(dq(".gx-hd")!.textContent).toContain("Lorebook");
    expect(dq(".gx-hd")!.textContent).toContain("The Drowned Coast");
    expect(dq(".gx-hd")!.textContent).toContain("Cross-Reference Graph");
    expect(dqa(".gx-side [data-control=chip]").map((b) => b.textContent!.replace(/\d+$/, ""))).toEqual(["Cast", "Places", "Items", "Orgs", "Events", "Plots", "Threats", "Worldbuilding", "Summaries", "Powers", "Creatures", "Relationships", "Affiliations", "Location Links", "Participation", "In Summaries", "Show orphaned nodes", "Show edge labels"]);
    expect(dq(".gx-status")!.textContent).toContain("GRAPH 6 NODES");
    expect(dq(".gx-status")!.textContent).toContain("VISIBLE 6 NODES");
    expect(dq(".gx-status")!.textContent).toContain("SCROLL TO ZOOM");
    expect(node("mira")!.textContent).toContain("MV");
  });

  test("a click only selects: the detail panel shows its counts and connections, and OPEN IN CODEX opens the entry", async () => {
    await mount(modelOf());
    expect(dq(".gx-detail")).toBeNull();
    await click(node("mira"));
    const d = dq(".gx-detail")!;
    expect(d.textContent).toContain("Mira Vance");
    expect(d.textContent).toContain("character");
    expect(d.textContent).toContain("Total connections");
    expect(d.textContent).toContain("Dov Ketter");
    expect(d.textContent).toContain("Lantern Guild");
    expect(dq(".gx-status")!.textContent).toContain("SELECTED Mira Vance");
    expect(opened).toEqual([]);
    expect(closed).toBe(0);
    await click(btn("Open in codex"));
    expect(opened).toEqual(["mira"]);
  });

  test("a name in Connected to selects that node, and a click on the empty graph deselects", async () => {
    await mount(modelOf());
    await click(node("mira"));
    await click(dqa(".gx-detail .conn button").find((b) => b.textContent!.includes("Dov Ketter")));
    expect(dq(".gx-detail h4")!.textContent).toBe("Dov Ketter");
    await fire(dq(".gx-svg")!, "pointerdown", { clientX: 5, clientY: 5 });
    await fire(dq(".gx-svg")!, "pointerup", { clientX: 5, clientY: 5 });
    expect(dq(".gx-detail")).toBeNull();
  });

  test("hovering a node lights it and its neighbours and dims the rest", async () => {
    await mount(modelOf());
    await fire(node("mira")!, "pointerover");
    expect(nodeIds().filter((id) => node(id)!.classList.contains("dim"))).toEqual(["kraken", "lone"]);
    await fire(node("mira")!, "pointerout");
    expect(dqa(".gn.dim")).toHaveLength(0);
  });

  test("Esc, BACK and CLOSE close it", async () => {
    await mount(modelOf());
    await click(btn("← back"));
    await click(btn("close"));
    expect(closed).toBe(2);
    flushSync(() => { dq('[role="dialog"]')!.dispatchEvent(new rig.dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    await settle(flushSync);
    expect(closed).toBe(3);
  });
});

describe("filters and search", () => {
  test("a type off hides its nodes without moving the others, and nothing is laid out again", async () => {
    await mount(modelOf());
    const before = { mira: place("mira"), guild: place("guild"), dov: place("dov") };
    await click(btn("Places"));
    expect(nodeIds()).toEqual(["dov", "guild", "kraken", "mira"]);
    expect({ mira: place("mira"), guild: place("guild"), dov: place("dov") }).toEqual(before);
    expect(dq(".gx-status")!.textContent).toContain("VISIBLE 4 NODES");
    await click(btn("Places"));
    expect(nodeIds()).toHaveLength(6);
    expect(layouts).toBe(1);
  });

  test("creatures are offered, unlike RoleCall, whose modal never lists them", async () => {
    await mount(modelOf());
    await click(btn("Creatures"));
    expect(node("kraken")).toBeNull();
  });

  test("a connection kind off hides its links, orphans off hides unlinked nodes, and the empty result says so", async () => {
    await mount(modelOf());
    const links = (): number => dqa(".ln").length;
    const all = links();
    await click(btn("Relationships"));
    expect(links()).toBeLessThan(all);
    await click(btn("Show orphaned nodes"));
    expect(node("lone")).toBeNull();
    for (const l of ["Cast", "Places", "Items", "Orgs", "Events", "Plots", "Threats", "Worldbuilding", "Summaries", "Powers", "Creatures"]) await click(btn(l));
    expect(dq(".gx-none")!.textContent).toBe("No nodes match the current filters.");
  });

  test("search counts matches and rings them", async () => {
    await mount(modelOf());
    const input = dq('input[aria-label="Find entry"]') as HTMLInputElement;
    expect(dq(".gx-side .hint")!.textContent).toContain("gojo");
    const { props } = await import("../../fake-lore-rig");
    flushSync(() => props(input)["onChange"]!({ target: { value: "quay" } }));
    await settle(flushSync);
    expect(dq(".gx-side .hint")!.textContent).toBe("1 match");
    expect(node("quay")!.classList.contains("hit")).toBe(true);
    expect(node("mira")!.classList.contains("hit")).toBe(false);
  });
});

describe("camera", () => {
  test("starts fitted; the wheel zooms about the pointer; dragging the background pans; FIT returns", async () => {
    await mount(modelOf());
    const start = vp();
    expect(start.k).toBeGreaterThan(0.2);
    await wheel(-200, 500, 350);
    const zoomed = vp();
    expect(zoomed.k).toBeGreaterThan(start.k);
    expect((500 - zoomed.x) / zoomed.k).toBeCloseTo((500 - start.x) / start.k, 4);
    await fire(dq(".gx-svg")!, "pointerdown", { clientX: 100, clientY: 100 });
    await fire(dq(".gx-svg")!, "pointermove", { clientX: 160, clientY: 130 });
    await fire(dq(".gx-svg")!, "pointerup", { clientX: 160, clientY: 130 });
    expect(vp().x).toBeCloseTo(zoomed.x + 60, 4);
    expect(vp().y).toBeCloseTo(zoomed.y + 30, 4);
    await click(btn("fit"));
    expect(vp()).toEqual(start);
  });

  test("a drag that pans does not deselect, and + and - step the zoom by RoleCall's 1.3", async () => {
    await mount(modelOf());
    await click(node("mira"));
    await fire(dq(".gx-svg")!, "pointerdown", { clientX: 100, clientY: 100 });
    await fire(dq(".gx-svg")!, "pointermove", { clientX: 140, clientY: 100 });
    await fire(dq(".gx-svg")!, "pointerup", { clientX: 140, clientY: 100 });
    expect(dq(".gx-detail")).not.toBeNull();
    await click(dq('button[aria-label="Zoom out"]'));
    const k = vp().k;
    await click(dq('button[aria-label="Zoom in"]'));
    expect(vp().k).toBeCloseTo(k * 1.3, 6);
    await click(dq('button[aria-label="Zoom out"]'));
    expect(vp().k).toBeCloseTo(k, 6);
    expect(dq(".gx-status")!.textContent).toContain(`ZOOM ${Math.round(k * 100)}%`);
  });

  test("panning and zooming never redraw the nodes", async () => {
    await mount(modelOf());
    const mira = node("mira");
    await wheel(-100, 400, 300);
    await click(dq('button[aria-label="Zoom in"]'));
    expect(node("mira")).toBe(mira);
  });
});

describe("dragging a node (RoleCall enableNodeDrag; session only, no persistence)", () => {
  const xy = (id: string): { x: number; y: number } => { const m = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(place(id))!; return { x: +m[1]!, y: +m[2]! }; };
  async function drag(id: string, dx: number, dy: number): Promise<void> {
    await fire(node(id)!, "pointerdown", { clientX: 300, clientY: 300 });
    await fire(node(id)!, "pointermove", { clientX: 300 + dx / 2, clientY: 300 + dy / 2 });
    await fire(node(id)!, "pointermove", { clientX: 300 + dx, clientY: 300 + dy });
    await fire(node(id)!, "pointerup", { clientX: 300 + dx, clientY: 300 + dy });
  }

  test("moves only that node, by the pointer's travel at the current zoom, drags its links with it, and lays nothing out again", async () => {
    await mount(modelOf());
    const before = Object.fromEntries(nodeIds().map((id) => [id, place(id)]));
    const mira = xy("mira");
    const view = vp();
    await drag("mira", 60, 30);
    expect(xy("mira").x).toBeCloseTo(mira.x + 60 / view.k, 4);
    expect(xy("mira").y).toBeCloseTo(mira.y + 30 / view.k, 4);
    for (const id of nodeIds().filter((n) => n !== "mira")) expect(place(id)).toBe(before[id]!);
    expect(vp()).toEqual(view);
    expect(layouts).toBe(1);
    const ends = dqa(".ln line").flatMap((l) => [[l.getAttribute("x1"), l.getAttribute("y1")], [l.getAttribute("x2"), l.getAttribute("y2")]]);
    expect(ends.some(([x, y]) => Math.abs(+x! - xy("mira").x) < 1e-6 && Math.abs(+y! - xy("mira").y) < 1e-6)).toBe(true);
    expect(ends.some(([x, y]) => Math.abs(+x! - mira.x) < 1e-6 && Math.abs(+y! - mira.y) < 1e-6)).toBe(false);
  });

  test("a drag does not select the node and does not pan; a click without travel still selects", async () => {
    await mount(modelOf());
    const view = vp();
    await drag("dov", 40, 0);
    await click(node("dov"));
    expect(dq(".gx-detail")).toBeNull();
    expect(vp()).toEqual(view);
    await fire(node("dov")!, "pointerdown", { clientX: 10, clientY: 10 });
    await fire(node("dov")!, "pointerup", { clientX: 10, clientY: 10 });
    await click(node("dov"));
    expect(dq(".gx-detail h4")!.textContent).toBe("Dov Ketter");
  });

  test("the moved node stays put through filters; it is released on drop (not pinned), so a second drag starts from where it was left", async () => {
    await mount(modelOf());
    await drag("quay", 50, 50);
    const left = place("quay");
    await click(btn("Orgs"));
    await click(btn("Orgs"));
    expect(place("quay")).toBe(left);
    const at = xy("quay");
    const k = vp().k;
    await drag("quay", -20, 10);
    expect(xy("quay").x).toBeCloseTo(at.x - 20 / k, 4);
    expect(layouts).toBe(1);
  });

  test("nothing is saved: opening the explorer again shows the settled layout", async () => {
    const m = modelOf();
    await mount(m);
    const settled = place("mira");
    await drag("mira", 80, 80);
    expect(place("mira")).not.toBe(settled);
    flushSync(() => rig.root.unmount());
    rig.host.remove();
    await mount(m);
    expect(place("mira")).toBe(settled);
  });

  test("a node is reachable by keyboard: it takes focus and Enter or Space selects it", async () => {
    await mount(modelOf());
    expect(node("mira")!.getAttribute("tabindex")).toBe("0");
    flushSync(() => { node("mira")!.dispatchEvent(new rig.dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); });
    await settle(flushSync);
    expect(dq(".gx-detail h4")!.textContent).toBe("Mira Vance");
    flushSync(() => { node("dov")!.dispatchEvent(new rig.dom.window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })); });
    await settle(flushSync);
    expect(dq(".gx-detail h4")!.textContent).toBe("Dov Ketter");
  });
});

describe("one layout per book revision", () => {
  test("opening again on the same model, filtering and searching lay out once; a new revision's model lays out again", async () => {
    const m = modelOf();
    await mount(m);
    await click(btn("Orgs"));
    flushSync(() => rig.root.unmount());
    rig.host.remove();
    await mount(m);
    expect(layouts).toBe(1);
    flushSync(() => rig.root.unmount());
    rig.host.remove();
    await mount(modelOf());
    expect(layouts).toBe(2);
  });
});

describe("the Dashboard cell", () => {
  test("says 'tap to explore', opens the explorer on a click, and opening an entry there closes it and opens the page", async () => {
    const { createRoot } = await import("react-dom/client");
    rig.host = doc().createElement("div");
    doc().body.appendChild(rig.host);
    rig.root = createRoot(rig.host);
    const m = modelOf();
    flushSync(() => rig.root.render(createElement(CrossRefCell, { m, onOpen: (id: string) => opened.push(id) })));
    await settle(flushSync);
    expect(rig.host.textContent).toContain(`${m.graph.edges.length} cross-references`);
    expect(rig.host.textContent).toContain("tap to explore");
    expect(rig.host.textContent).toContain("VIEW CROSS-REFERENCES");
    expect(dq(".cp-gx")).toBeNull();
    await click(rig.host.querySelector(".cp-gwrap"));
    expect(dq(".cp-gx")).not.toBeNull();
    await click(node("guild"));
    await click(btn("Open in codex"));
    expect(opened).toEqual(["guild"]);
    expect(dq(".cp-gx")).toBeNull();
  });

  test("with no cross-references it still opens, and says so", async () => {
    const { createRoot } = await import("react-dom/client");
    rig.host = doc().createElement("div");
    doc().body.appendChild(rig.host);
    rig.root = createRoot(rig.host);
    flushSync(() => rig.root.render(createElement(CrossRefCell, { m: modelOf([]), onOpen: () => undefined })));
    await settle(flushSync);
    expect(rig.host.textContent).toContain("No cross-references yet.");
    await click(rig.host.querySelector(".cp-gbtn button"));
    expect(dq(".gx-none")!.textContent).toBe("No nodes match the current filters.");
  });
});
