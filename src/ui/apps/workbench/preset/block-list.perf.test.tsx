/**
 * The preset block list at massive scale: 3,000 blocks mount as a window of rows, not 3,000 DOM nodes.
 * That editing one block re-renders only its
 * own row is block-row-render-count.test.tsx.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act, type JSX } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushTasks, installDom, type InstalledDom } from "../../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", {
    observers: true,
    url: "http://127.0.0.1:8474/",
    pretendToBeVisual: true,
    boundGlobals: ["getComputedStyle"],
    globals: { IS_REACT_ACT_ENVIRONMENT: true },
  });
  dom = installed.dom;
  // The scroll container ("list", exact match - a row's own class ("listRow") also CONTAINS "list",
  // so this has to be exact, not `.includes`) gets a real viewport; everything else is a plain row.
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

interface Block { id: string; content: string }
const N = 3000;
function fixture(): Block[] {
  return Array.from({ length: N }, (_, i) => ({ id: `blk-${String(i)}`, content: `block ${String(i)} content ${"x".repeat(40)}` }));
}

async function mount(el: JSX.Element): Promise<{ host: HTMLElement; root: Root }> {
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  await act(async () => { await flushTasks(4); });
  return { host, root };
}

describe("the virtualized BlockList", () => {
  test(`${String(N)} blocks render far fewer than ${String(N)} row nodes`, async () => {
    const { BlockList } = await import("./block-list");
    const blocks = fixture().map((b) => toBlock(b));
    const { host, root } = await mount(
      <BlockList
        blocks={blocks}
        collapsedGroups={new Set()}
        onToggleGroup={() => {}}
        totalBlocks={blocks.length}
        tab="all"
        query=""
        onClearQuery={() => {}}
        onShowAll={() => {}}
        selectedId={null}
        selectedChecks={new Set()}
        expandedIds={new Set()}
        onSelectRow={() => {}}
        onToggleCheck={() => {}}
        onToggleExpand={() => {}}
        onToggle={() => {}}
        onDelete={() => {}}
        onPatch={() => {}}
        onReorder={() => {}}
        onAdd={() => {}}
      />,
    );
    const rowCount = host.querySelectorAll("[data-pick]").length;
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThan(100);
    await act(async () => root.unmount());
    host.remove();
  });
  // The "editing ONE block re-renders only that block's row" proof lives in its own file
  // (block-row-render-count.test.tsx): it needs to `mock.module("./block-row", ...)` BEFORE the
  // FIRST `import("./block-list")` anywhere in its module graph, since a dynamic import is cached
  // after its first resolution - a second test in this same file re-importing "./block-list" would
  // get back the already-bound-to-the-real-BlockRow module from the test above, not the mock.
});

function toBlock(b: Block): import("../../../../entities/preset").PresetPrompt {
  return {
    id: b.id,
    name: b.id,
    content: b.content,
    role: "system",
    enabled: true,
    systemPrompt: false,
    marker: false,
    placement: "relative",
    injectionDepth: 4,
    injectionOrder: 100,
    forbidOverrides: false,
  };
}
