/** App widget regressions: exact editor identity, cold inventory truth and live agent context. */
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AppContext } from "../app-contract";
import { PieceStore } from "../_shared/piece-store";
import { installDom, teardownAllDoms } from "../_shared/test-dom";
import { OverlayWidgets as Workbench } from "../apps/workbench/overlay";
import { OverlayWidgets as Library } from "../apps/library/overlay";
import { OverlayWidgets as Pages } from "../apps/html-view/overlay";
import { OverlayWidgets as Agent } from "../apps/agent/overlay";
import { useShellStore } from "./store";
import { paneKeyOf } from "./store-core";
import { createLiveSurface } from "../agent/live-state";

let root: Root; let host: HTMLElement;
beforeAll(() => { const { dom } = installDom('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: false } }); host = dom.window.document.getElementById("root")!; });
afterAll(teardownAllDoms);
afterEach(() => { flushSync(() => root?.unmount()); });
function render(Widget: typeof Library, ctx: AppContext) { root = createRoot(host); flushSync(() => root.render(<Widget ctx={ctx} onActivate={() => {}} />)); }

test("choosing the second entry editor preserves its exact pane identity", () => {
  const original = useShellStore.getState();
  const first = { id: "world", kind: "lorebook", name: "First entry", params: { focusEntry: "first" } };
  const second = { ...first, name: "Second entry", params: { focusEntry: "second" } };
  useShellStore.setState({ manifests: [], openPieces: [first, second], activeKey: paneKeyOf(first) });
  const ctx = { workbench: { pieces: () => [first, second], active: () => first, dirty: () => ({}), beside: () => null,
    focus: (id: string, kind: string, entry?: string) => useShellStore.getState().focusPiece(id, kind, entry),
  } } as unknown as AppContext;
  try { render(Workbench, ctx); flushSync(() => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Second entry"))!.click());
    expect(useShellStore.getState().activeKey).toBe(paneKeyOf(second));
  } finally { useShellStore.setState(original); }
});

for (const [label, Widget] of [["Library", Library], ["HTML View", Pages]] as const) {
  test(`${label} awaits initial inventory and then recognizes a confirmed empty inventory`, () => {
    const pieces = new PieceStore(); render(Widget, { pieces, workbench: { restoreFailure: () => null } } as unknown as AppContext);
    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("No saved");
    flushSync(() => pieces.replace([]));
    expect(host.textContent).not.toContain("Loading");
    expect(host.textContent).toMatch(/no pieces|No saved/i);
  });
  test(`${label} reports a failed inventory instead of claiming it is still loading`, () => {
    render(Widget, { pieces: new PieceStore(), workbench: { restoreFailure: () => "Inventory could not be opened. Reload to retry." } } as unknown as AppContext);
    expect(host.textContent).toContain("Reload to retry"); expect(host.textContent).not.toContain("Loading");
  });
}

test("the agent brief follows a publish while its widget remains open", () => {
  const surface = createLiveSurface(); surface.publish("library", { headline: "First brief" });
  const ctx = { agent: surface } as unknown as AppContext;
  render(Agent, ctx); expect(host.textContent).toContain("First brief");
  flushSync(() => surface.publish("library", { headline: "Updated brief" }));
  expect(host.textContent).toContain("Updated brief");
});
