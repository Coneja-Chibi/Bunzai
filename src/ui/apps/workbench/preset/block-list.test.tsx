/**
 * Feature coverage for the virtualized BlockList: category/tree grouping
 * survives flattening into virtual rows, reorder addresses blocks by id (never a filtered-list
 * index), and every rendered row carries its aria position cues. The perf claims (DOM bound,
 * one-row re-render) live in block-list.perf.test.tsx; this file is correctness, not speed.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act, useState, type JSX } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { PresetGroup, PresetPrompt } from "../../../../entities/preset";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8475/",
    pretendToBeVisual: true,
    boundGlobals: ["getComputedStyle"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", {
    configurable: true, get(this: HTMLElement) { return this.className === "list" ? 1024 : 300; },
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", {
    configurable: true, get(this: HTMLElement) { return this.className === "list" ? 720 : 52; },
  });
});
afterAll(() => installed.teardown());

const classNames = new Proxy({}, { get: (_t, property) => String(property) });
mock.module("./preset.module.css", () => ({ default: classNames }));
mock.module("./row.module.css", () => ({ default: classNames }));

function block(id: string, over: Partial<PresetPrompt> = {}): PresetPrompt {
  return {
    id, name: id, content: `content for ${id}`, role: "system", enabled: true, systemPrompt: false,
    marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false,
    ...over,
  };
}

async function mount(el: JSX.Element): Promise<{ host: HTMLElement; root: Root }> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  return { host, root };
}

describe("BlockList: category/tree grouping", () => {
  test("a nested category renders its header before its children, indented by depth", async () => {
    const { BlockList } = await import("./block-list");
    const groups: PresetGroup[] = [
      { id: "top", name: "Top", order: 0 },
      { id: "child", name: "Child", parentGroupId: "top", order: 0 },
    ];
    const blocks = [block("loose"), block("a", { groupId: "top" }), block("b", { groupId: "child" })];
    const { host, root } = await mount(
      <BlockList
        blocks={blocks} groups={groups} collapsedGroups={new Set()} onToggleGroup={() => {}}
        totalBlocks={blocks.length} tab="all" query="" onClearQuery={() => {}} onShowAll={() => {}}
        selectedId={null} selectedChecks={new Set()} expandedIds={new Set()}
        onSelectRow={() => {}} onToggleCheck={() => {}} onToggleExpand={() => {}} onToggle={() => {}}
        onDelete={() => {}} onPatch={() => {}} onReorder={() => {}} onAdd={() => {}}
      />,
    );
    const names = [...host.querySelectorAll("[data-index]")].map((row) =>
      row.querySelector(".sectionName")?.textContent ?? row.querySelector(".ptitle")?.textContent)
      .filter((name): name is string => name !== undefined);
    // loose block, then Top's header, then a, then Child's header (depth 1), then b
    expect(names).toEqual(["loose", "Top", "a", "Child", "b"]);
    const childHeaderDepth = [...host.querySelectorAll("[data-depth]")]
      .find((el) => el.textContent?.includes("Child"))?.getAttribute("data-depth");
    expect(childHeaderDepth).toBe("1");
    await act(async () => root.unmount());
    host.remove();
  });

  test("collapsing a category hides its blocks but keeps the header", async () => {
    const { BlockList } = await import("./block-list");
    const groups: PresetGroup[] = [{ id: "g1", name: "G1", order: 0 }];
    const blocks = [block("a", { groupId: "g1" }), block("b", { groupId: "g1" })];
    const { host, root } = await mount(
      <BlockList
        blocks={blocks} groups={groups} collapsedGroups={new Set(["g1"])} onToggleGroup={() => {}}
        totalBlocks={blocks.length} tab="all" query="" onClearQuery={() => {}} onShowAll={() => {}}
        selectedId={null} selectedChecks={new Set()} expandedIds={new Set()}
        onSelectRow={() => {}} onToggleCheck={() => {}} onToggleExpand={() => {}} onToggle={() => {}}
        onDelete={() => {}} onPatch={() => {}} onReorder={() => {}} onAdd={() => {}}
      />,
    );
    expect(host.querySelectorAll(".ptitle").length).toBe(0);
    expect(host.textContent).toContain("G1");
    await act(async () => root.unmount());
    host.remove();
  });

  test("a search-filtered-to-nothing state shows the escape hatch, not an empty list", async () => {
    const { BlockList } = await import("./block-list");
    const { host, root } = await mount(
      <BlockList
        blocks={[]} collapsedGroups={new Set()} onToggleGroup={() => {}}
        totalBlocks={5} tab="all" query="nothing matches" onClearQuery={() => {}} onShowAll={() => {}}
        selectedId={null} selectedChecks={new Set()} expandedIds={new Set()}
        onSelectRow={() => {}} onToggleCheck={() => {}} onToggleExpand={() => {}} onToggle={() => {}}
        onDelete={() => {}} onPatch={() => {}} onReorder={() => {}} onAdd={() => {}}
      />,
    );
    expect(host.textContent).toContain("nothing matches");
    await act(async () => root.unmount());
    host.remove();
  });
});

describe("BlockList: reorder addresses blocks by id", () => {
  test("dropping block A onto block B calls onReorder(A, B) - never an index", async () => {
    const { BlockList } = await import("./block-list");
    const blocks = [block("a"), block("b"), block("c")];
    const calls: [string, string][] = [];
    const { host, root } = await mount(
      <BlockList
        blocks={blocks} collapsedGroups={new Set()} onToggleGroup={() => {}}
        totalBlocks={blocks.length} tab="all" query="" onClearQuery={() => {}} onShowAll={() => {}}
        selectedId={null} selectedChecks={new Set()} expandedIds={new Set()}
        onSelectRow={() => {}} onToggleCheck={() => {}} onToggleExpand={() => {}} onToggle={() => {}}
        onDelete={() => {}} onPatch={() => {}}
        onReorder={(from, to) => calls.push([from, to])}
        onAdd={() => {}}
      />,
    );
    const rows = [...host.querySelectorAll("[data-pick]")];
    const gripA = rows[0]!.querySelector('[aria-label="Drag to reorder"]')!;
    // onDrop lives on the INNER clickable row div (aria-posinset marks it), not the outer
    // `[data-pick]` wrapper - React's event delegation simulates bubbling UP from the real target,
    // so the event has to be dispatched on that inner element, never a parent of it.
    const rowC = rows[2]!.querySelector("[aria-posinset]")!;
    act(() => { gripA.dispatchEvent(new dom.window.Event("dragstart", { bubbles: true, cancelable: true })); });
    act(() => { rowC.dispatchEvent(new dom.window.Event("drop", { bubbles: true, cancelable: true })); });
    expect(calls).toEqual([["a", "c"]]);
    await act(async () => root.unmount());
    host.remove();
  });
});

describe("BlockList: aria position cues and bulk selection", () => {
  test("every row reports its 1-based position and the total", async () => {
    const { BlockList } = await import("./block-list");
    const blocks = [block("a"), block("b"), block("c")];
    const { host, root } = await mount(
      <BlockList
        blocks={blocks} collapsedGroups={new Set()} onToggleGroup={() => {}}
        totalBlocks={blocks.length} tab="all" query="" onClearQuery={() => {}} onShowAll={() => {}}
        selectedId={null} selectedChecks={new Set()} expandedIds={new Set()}
        onSelectRow={() => {}} onToggleCheck={() => {}} onToggleExpand={() => {}} onToggle={() => {}}
        onDelete={() => {}} onPatch={() => {}} onReorder={() => {}} onAdd={() => {}}
      />,
    );
    const rows = [...host.querySelectorAll("[aria-posinset]")];
    expect(rows.map((r) => r.getAttribute("aria-posinset"))).toEqual(["1", "2", "3"]);
    expect(rows.every((r) => r.getAttribute("aria-setsize") === "3")).toBe(true);
    await act(async () => root.unmount());
    host.remove();
  });

  test("selectedChecks marks a row selected, independent of the active/expanded row", async () => {
    const { BlockList } = await import("./block-list");
    const blocks = [block("a"), block("b")];
    const { host, root } = await mount(
      <BlockList
        blocks={blocks} collapsedGroups={new Set()} onToggleGroup={() => {}}
        totalBlocks={blocks.length} tab="all" query="" onClearQuery={() => {}} onShowAll={() => {}}
        selectedId="a" selectedChecks={new Set(["b"])} expandedIds={new Set()}
        onSelectRow={() => {}} onToggleCheck={() => {}} onToggleExpand={() => {}} onToggle={() => {}}
        onDelete={() => {}} onPatch={() => {}} onReorder={() => {}} onAdd={() => {}}
      />,
    );
    const checkB = host.querySelectorAll('[aria-label="Deselect"]');
    expect(checkB.length).toBe(1); // only "b" is checked, so only it offers "Deselect"
    await act(async () => root.unmount());
    host.remove();
  });
});
