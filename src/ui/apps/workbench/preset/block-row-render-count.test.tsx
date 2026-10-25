/**
 * M4 GREEN evidence: editing one block re-renders only that block's row. Split
 * from block-list.perf.test.tsx on purpose - a dynamic `import("./block-list")` is cached after its
 * first resolution in a module graph, so `mock.module("./block-row", ...)` has to run before the
 * FIRST import of "./block-list" anywhere in THIS file, or it mocks nothing (a second test in the
 * same file that already imported the real chain would just get the cached, already-bound module).
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act, createElement, memo, useState, type JSX } from "react";
import { createRoot } from "react-dom/client";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";

let dom: JSDOM;
let installed: InstalledDom;

beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true,
    url: "http://127.0.0.1:8476/",
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

interface Block { id: string; content: string }
const N = 3000;
function fixture(): Block[] {
  return Array.from({ length: N }, (_, i) => ({ id: `blk-${String(i)}`, content: `block ${String(i)} content ${"x".repeat(40)}` }));
}
function toBlock(b: Block): import("../../../../entities/preset").PresetPrompt {
  return {
    id: b.id, name: b.id, content: b.content, role: "system", enabled: true, systemPrompt: false,
    marker: false, placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false,
  };
}

test("editing ONE block of 3,000 re-renders only that block's row", async () => {
  // `./block-row`'s real `BlockRow` is already `memo(BlockRowInner)` - a Memo OBJECT, not a callable
  // function - so it is rendered via `createElement` inside this counting wrapper, never called
  // directly. Both wrappers use the SAME default shallow prop compare, so this wrapper's bail
  // decision (and the counter it gates) matches the real BlockRow's own bail decision for identical
  // props - it is measuring the real memoization, not a looser approximation of it.
  // Captured as a plain value ONCE, not read as `real.BlockRow` inside the render below: `mock.module`
  // replaces the module namespace's OWN `BlockRow` property in place, so re-reading it on every
  // render would (once the mock below is registered) resolve back to this very wrapper - infinite
  // self-recursion. A local `const` copy is immune to that later reassignment.
  const real = await import("./block-row") as unknown as { BlockRow: (props: Record<string, unknown>) => JSX.Element };
  const RealBlockRow = real.BlockRow;
  let renders = 0;
  const seen = new Set<string>();
  mock.module("./block-row", () => ({
    BlockRow: memo((props: { block: Block }) => {
      renders++;
      seen.add(props.block.id);
      return createElement(RealBlockRow, props);
    }),
  }));

  const { BlockList } = await import("./block-list"); // FIRST import of block-list in this file/graph

  // Module-scoped, not inline: an inline `() => {}` in Harness's JSX is a FRESH closure every render,
  // which would defeat BlockRow's memo for every row just like an unmemoized handler in the real
  // editor would (preset-editor.tsx's own handlers are real `useCallback`s for exactly this reason -
  // this test has to give BlockRow the same stability real callers give it, or it isn't testing the
  // real mechanism).
  const noop0 = (): void => {};
  const noop1 = (_a: unknown): void => {};
  const noop2 = (_a: unknown, _b: unknown): void => {};
  const emptySet = new Set<string>();
  const expandedFive = new Set(["blk-5"]);

  function Harness(): JSX.Element {
    const [blocks, setBlocks] = useState(() => fixture().map((b) => toBlock(b)));
    (Harness as unknown as { edit?: () => void }).edit = () => {
      setBlocks((prev) => prev.map((b, i) => (i === 5 ? { ...b, content: "EDITED" } : b)));
    };
    return (
      <BlockList
        blocks={blocks}
        collapsedGroups={emptySet}
        onToggleGroup={noop1}
        totalBlocks={blocks.length}
        tab="all"
        query=""
        onClearQuery={noop0}
        onShowAll={noop0}
        selectedId={null}
        selectedChecks={emptySet}
        expandedIds={expandedFive} // near the top, so it is inside the initial virtual window
        onSelectRow={noop1}
        onToggleCheck={noop1}
        onToggleExpand={noop1}
        onToggle={noop1}
        onDelete={noop1}
        onPatch={noop2}
        onReorder={noop2}
        onAdd={noop0}
      />
    );
  }

  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<Harness />); });

  renders = 0;
  seen.clear();
  await act(async () => { (Harness as unknown as { edit: () => void }).edit(); });
  expect(renders).toBe(1);
  expect([...seen]).toEqual(["blk-5"]);

  await act(async () => root.unmount());
  host.remove();
}, 20_000);
