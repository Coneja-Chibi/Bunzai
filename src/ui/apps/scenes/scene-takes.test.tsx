/**
 * The take pill and its menu (RoleCall's BranchIndicator): the pill's count and sentence, the Parent Branch and Alternate Takes sections with
 * sub-takes nested under the current take, `msg N` in a row's second line, and the "View Full Branching Tree" link.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { TakeSummary } from "../../../studio/scenes";
import { click, installRigDom, rig, type FlushSync } from "./fake-scene-page-rig";
import { TakesControl } from "./scene-takes";

beforeAll(installRigDom);

const take = (id: string, name: string, parent: string | null, extra: Partial<TakeSummary> = {}): TakeSummary => ({
  id, chatId: "c", name, parentBranchId: parent, forkMessageId: parent ? "m" : null, forkSwipeId: null, createdAt: Number(id.slice(1)) * 86_400_000, version: 1, messageCount: 5, forkPosition: parent ? 4 : null, ...extra,
});
const ALL = [take("m0", "main", null), take("a1", "Take 2", "m0"), take("a2", "Take 3", "m0"), take("b3", "Deep", "a1"), take("c4", "Deeper", "b3")];

async function mount(activeId: string, open: boolean, tree?: () => void, takes: TakeSummary[] = ALL): Promise<FlushSync> {
  const { flushSync } = await import("react-dom");
  rig.host = rig.dom.window.document.createElement("div");
  rig.dom.window.document.body.appendChild(rig.host);
  rig.root = createRoot(rig.host);
  flushSync(() => rig.root.render(createElement(TakesControl, { takes, activeId, open, onToggle: () => undefined, onSwitch: () => undefined, onRename: () => undefined, onDelete: () => undefined, ...(tree ? { onTree: tree } : {}) })));
  return flushSync;
}
const unmount = (flushSync: FlushSync): void => { flushSync(() => rig.root.unmount()); rig.host.remove(); };
const pill = (): HTMLElement => rig.host.querySelector("[data-part='scene.takes.toggle']")!;

describe("the take pill", () => {
  test("on the original it reads Director's Cut with a count and RoleCall's sentence", async () => {
    const flushSync = await mount("m0", false);
    expect(pill().textContent).toContain("Director's Cut");
    expect(pill().querySelector(".cnt")!.textContent).toBe("3");
    expect(pill().getAttribute("aria-label")).toBe("You are on the Director's Cut, the main take. 2 other takes to switch to.");
    expect(pill().getAttribute("title")).toBe(pill().getAttribute("aria-label"));
    unmount(flushSync);
  });

  test("with no other take it says how to make one, and shows no count", async () => {
    const flushSync = await mount("m0", false, undefined, [ALL[0]!]);
    expect(pill().getAttribute("aria-label")).toBe("You are on the Director's Cut, the main take. Branch from any message to make another one.");
    expect(pill().querySelector(".cnt")).toBeNull();
    unmount(flushSync);
  });

  test("on a take it reads the take's name and says it is an alternate", async () => {
    const flushSync = await mount("a2", false);
    expect(pill().textContent).toContain("Take 3");
    expect(pill().getAttribute("aria-label")).toBe("You are on Take 3, an alternate take. 2 other takes to switch to.");
    unmount(flushSync);
  });
});

describe("the take menu", () => {
  test("lists Original Take, the alternates with date, msg N and message count, and the tree link", async () => {
    let went = 0;
    const flushSync = await mount("m0", true, () => { went++; });
    const text = rig.host.textContent ?? "";
    expect(text).toContain("Scene Takes");
    expect(text).toContain("Switch between alternate versions");
    expect(text).toContain("Original Take");
    expect(text).toContain("Alternate Takes");
    expect(text).toContain("msg 4");
    expect(text).toContain("5 msgs");
    expect(text).not.toContain("Parent Branch");
    click(flushSync, rig.host.querySelector(".foot [data-control='row']")!);
    expect(went).toBe(1);
    expect(rig.host.querySelector(".foot [data-control='row']")!.textContent).toContain("View Full Branching Tree");
    unmount(flushSync);
  });

  test("without a tree page there is no link, only the hint", async () => {
    const flushSync = await mount("m0", true);
    expect(rig.host.querySelector(".foot [data-control='row']")).toBeNull();
    expect(rig.host.textContent).toContain("Create new takes with Branch from here on any message");
    unmount(flushSync);
  });

  test("on a deeper take it shows the Parent Branch and nests that take's own sub-takes under it", async () => {
    const flushSync = await mount("b3", true);
    const text = rig.host.textContent ?? "";
    expect(text).toContain("Parent Branch");
    const sections = [...rig.host.querySelectorAll(".sep")].map((s) => s.textContent);
    expect(sections).toEqual(["Parent Branch", "Alternate Takes"]);
    const rows = [...rig.host.querySelectorAll(".pad.list .take")];
    expect(rows.map((r) => r.querySelector("[data-slot='label']")!.textContent)).toEqual(["Deep", "Deeper"]);
    expect(rows[1]!.className).toContain("sub");
    unmount(flushSync);
  });
});
