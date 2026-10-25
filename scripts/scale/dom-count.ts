/**
 * DOM node counts for the fast gate (S0, section 11.1's "render counts... and DOM node counts"):
 * mounts REAL preset-editor and Library panels inside a throwaway JSDOM window and returns the
 * total node count. Each call gets its own JSDOM window and tears it down before returning, so
 * repeated calls (N then 10N) do not leak state into each other.
 *
 * `libraryGridDomCount` and `presetBlockListDomCount` mount `views/grid.tsx` and `block-list.tsx`,
 * both already virtualized - their counts stay flat across N, which is
 * the CORRECT behavior to prove, not a defect. They alone are not the whole preset-editor screen
 * though: `presetLiveBuildDomCount` and `presetLivePreviewDomCount` mount the rail panes
 * (`live-build.tsx`, `live-preview.tsx`), which render one list item per BUILT line with no
 * windowing - the actual O(n) surface behind section 10.2's "51,248 DOM nodes at 3,000 blocks"
 * figure (`block-list.perf.test.tsx`'s own docblock: that number was BlockList's pre-M4 baseline;
 * these two panes were never part of that fix). All four ship with clean, self-contained props (no
 * `AppContext`), so none needed a new test hook in `src/`.
 *
 * `react-dom` must load AFTER a DOM exists (`scripts/test-react-dom.ts`'s own docblock), and these
 * components import real CSS modules that resolve to plain CSS text outside a bundler - both handled
 * the same way their source tests do: `mock.module` (from `bun:test`, which works fine under a plain
 * `bun run`, not only under the test runner) for the CSS, and every react/react-dom import deferred
 * with a dynamic `import()` until the window is in place.
 */
import { mock } from "bun:test";
import { JSDOM } from "jsdom";
import type { StudioEntitySummary } from "../../src/ui/app-contract";
import type { PresetBody, PresetPrompt } from "../../src/entities/preset/schema";

class FakeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): never[] {
    return [];
  }
}

/** Installs a throwaway JSDOM window as the global DOM, runs `work`, then removes it. `sizeOf`
 * decides the mocked `offsetWidth`/`offsetHeight` for each element by its className, matching the
 * viewport each source test hard-codes for its own scroll container. */
async function withDom<T>(url: string, sizeOf: (className: string) => { w: number; h: number }, work: () => Promise<T>): Promise<T> {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url, pretendToBeVisual: true });
  const g = globalThis as unknown as Record<string, unknown>;
  const KEYS = ["window", "document", "navigator", "HTMLElement", "Node", "Element", "IS_REACT_ACT_ENVIRONMENT", "ResizeObserver", "IntersectionObserver", "getComputedStyle", "KeyboardEvent", "requestAnimationFrame", "DOMParser"] as const;
  const had = KEYS.map((k) => [k, k in g, g[k]] as const);
  Object.assign(g, {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Element: dom.window.Element,
    IS_REACT_ACT_ENVIRONMENT: true, ResizeObserver: FakeObserver, IntersectionObserver: FakeObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window), KeyboardEvent: dom.window.KeyboardEvent,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), DOMParser: dom.window.DOMParser,
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetWidth", { configurable: true, get(this: HTMLElement) { return sizeOf(this.className).w; } });
  Object.defineProperty(dom.window.HTMLElement.prototype, "offsetHeight", { configurable: true, get(this: HTMLElement) { return sizeOf(this.className).h; } });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientWidth", { configurable: true, value: 1024 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "clientHeight", { configurable: true, value: 720 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollWidth", { configurable: true, value: 10_000_000 });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollHeight", { configurable: true, value: 10_000_000 });
  try {
    return await work();
  } finally {
    dom.window.close();
    for (const [k, present, value] of had) {
      if (present) g[k] = value;
      else delete g[k];
    }
  }
}

async function mountAndSettle(el: unknown, hostClassName = ""): Promise<{ host: HTMLElement; unmount: () => Promise<void> }> {
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const host = document.createElement("div");
  host.className = hostClassName;
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(el as Parameters<typeof root.render>[0]);
  });
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
  }
  return {
    host,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

/** Mounts the real `Shelves` component (`library/shelves.tsx`) - what the Library app actually lands
 * on (`shelves.test.tsx`'s own docblock: "the default Cards view"), NOT the bare `views/grid.tsx`
 * Tiles component a piece deck switches to. One deck section carrying all of `entities`, "grid"
 * layout, mounted inside the `.lcar` scroller `useScrollMargin` looks for (the real Library room
 * wraps Shelves in one), the same harness `shelves.test.tsx`'s own `baseProps`/`mountInLcar` use.
 * Returns the total DOM node count inside it (virtualized: far fewer nodes than `entities.length`). */
export async function libraryShelvesDomCount(entities: StudioEntitySummary[]): Promise<number> {
  return withDom(
    "http://127.0.0.1:8462/",
    (className) => (className.includes("lcar") || className.includes("lrow-cards") ? { w: 1024, h: 900 } : { w: 200, h: 320 }),
    async () => {
      const React = await import("react");
      const { Shelves } = await import("../../src/ui/apps/library/shelves");
      const { deckMeta } = await import("../../src/ui/_shared/decks");
      const { parseQuery } = await import("../../src/ui/apps/library/search-core");
      const { PieceStore } = await import("../../src/ui/_shared/piece-store");
      const pieceStore = new PieceStore();
      pieceStore.seed(entities, 0);
      type ShelvesProps = import("../../src/ui/apps/library/shelves").ShelvesProps;
      type CarouselSection = import("../../src/ui/apps/library/carousel-core").CarouselSection;
      const section: CarouselSection = { deck: deckMeta("character"), numeral: "I", pieces: entities, total: entities.length };
      const props: ShelvesProps = {
        ctx: { pieces: pieceStore } as unknown as import("../../src/ui/app-contract").AppContext,
        vctxFor: (kind, pieces) => ({
          entities: pieces, deck: deckMeta(kind || "character"), open: new Set<string>(), selected: new Set<string>(),
          onPiece: () => undefined, menus: { useContextMenu: () => () => undefined }, portraitUrl: () => null, sourceLabel: () => null, peek: async () => null,
        }) as unknown as import("../../src/ui/apps/library/view-contract").DeckViewContext,
        sections: [section], single: null, singleTotal: entities.length, layout: "grid", views: {}, setView: () => undefined,
        meta: {} as ShelvesProps["meta"], generation: entities, parsed: parseQuery(""), query: "", setQuery: () => undefined,
        perDeck: [{ kind: "character", count: entities.length }], onJump: () => undefined, studioTotal: entities.length, onCreated: () => undefined,
      };
      const { host, unmount } = await mountAndSettle(React.createElement(Shelves, props), "lcar");
      const count = host.querySelectorAll("*").length;
      await unmount();
      return count;
    },
  );
}

/** Mounts the real preset editor `BlockList` (`workbench/preset/block-list.tsx`) with `blocks` and
 * returns the total DOM node count inside it (virtualized: far fewer nodes than `blocks.length`). */
export async function presetBlockListDomCount(blocks: PresetPrompt[]): Promise<number> {
  const classNames = new Proxy({}, { get: (_t, property) => String(property) });
  mock.module("../../src/ui/apps/workbench/preset/preset.module.css", () => ({ default: classNames }));
  mock.module("../../src/ui/apps/workbench/preset/row.module.css", () => ({ default: classNames }));
  return withDom(
    "http://127.0.0.1:8475/",
    (className) => (className === "list" ? { w: 1024, h: 720 } : { w: 300, h: 52 }),
    async () => {
      const React = await import("react");
      const { BlockList } = await import("../../src/ui/apps/workbench/preset/block-list");
      const { host, unmount } = await mountAndSettle(
        React.createElement(BlockList, {
          blocks, collapsedGroups: new Set(), onToggleGroup: () => {}, totalBlocks: blocks.length,
          tab: "all", query: "", onClearQuery: () => {}, onShowAll: () => {}, selectedId: null,
          selectedChecks: new Set(), expandedIds: new Set(), onSelectRow: () => {}, onToggleCheck: () => {},
          onToggleExpand: () => {}, onToggle: () => {}, onDelete: () => {}, onPatch: () => {}, onReorder: () => {}, onAdd: () => {},
        }),
      );
      const count = host.querySelectorAll("*").length;
      await unmount();
      return count;
    },
  );
}

/** Mounts the real `LiveBuild` rail pane (`workbench/preset/live-build.tsx`) with `body` and returns
 * the total DOM node count: one unwindowed `<li>` per built line, so this scales with `body.prompts`,
 * unlike the two views above. */
export async function presetLiveBuildDomCount(body: PresetBody): Promise<number> {
  const classNames = new Proxy({}, { get: (_t, property) => String(property) });
  mock.module("../../src/ui/apps/workbench/preset/live-build.module.css", () => ({ default: classNames }));
  return withDom(
    "http://127.0.0.1:8476/",
    () => ({ w: 1024, h: 720 }),
    async () => {
      const React = await import("react");
      const { LiveBuild } = await import("../../src/ui/apps/workbench/preset/live-build");
      const { host, unmount } = await mountAndSettle(React.createElement(LiveBuild, { body, onSelect: () => {} }));
      const count = host.querySelectorAll("*").length;
      await unmount();
      return count;
    },
  );
}

/** Mounts the real `LivePreview` rail pane (`workbench/preset/live-preview.tsx`) with `body` and
 * returns the total DOM node count: also one unwindowed item per built line plus per-segment spans,
 * the other O(n) surface behind the 3,000-block baseline. */
export async function presetLivePreviewDomCount(body: PresetBody): Promise<number> {
  const classNames = new Proxy({}, { get: (_t, property) => String(property) });
  mock.module("../../src/ui/apps/workbench/preset/live-preview.module.css", () => ({ default: classNames }));
  return withDom(
    "http://127.0.0.1:8477/",
    () => ({ w: 1024, h: 720 }),
    async () => {
      const React = await import("react");
      const { LivePreview } = await import("../../src/ui/apps/workbench/preset/live-preview");
      const { host, unmount } = await mountAndSettle(
        React.createElement(LivePreview, { body, onPatchContent: () => {}, onSelect: () => {} }),
      );
      const count = host.querySelectorAll("*").length;
      await unmount();
      return count;
    },
  );
}
