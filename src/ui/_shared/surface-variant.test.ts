/** useSurfaceVariant: components re-render when the painter changes a surface attribute, and read "core" when there is none or it is not a registered variant. */
import { afterAll, expect, test } from "bun:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { installDom, setSurfacePicks } from "./test-dom";
import { surfaceVariant, useSurfaceVariant } from "./surface-variant";

const installed = installDom(undefined, { globals: { IS_REACT_ACT_ENVIRONMENT: true }, extraGlobals: ["MutationObserver"] });
afterAll(() => installed.teardown());

test("a component follows the root attribute and falls back to core", async () => {
  const root = document.documentElement;
  const host = document.createElement("div");
  document.body.append(host);
  const tree = createRoot(host);
  const View = (): ReturnType<typeof createElement> => createElement("span", null, useSurfaceVariant("shell.nav"));
  await act(async () => { tree.render(createElement(View)); });
  expect(host.textContent).toBe("core");
  await act(async () => { root.setAttribute("data-surface-shell-nav", "hud-bar"); });
  expect(host.textContent).toBe("hud-bar");
  expect(surfaceVariant("shell.nav")).toBe("hud-bar");
  expect(surfaceVariant("ui.toast")).toBe("core");
  await act(async () => { root.setAttribute("data-surface-shell-nav", "not-a-variant"); });
  expect(host.textContent).toBe("core");
  await act(async () => { root.removeAttribute("data-surface-shell-nav"); });
  expect(host.textContent).toBe("core");
  await act(async () => { tree.unmount(); });
});

test("re-rendering never builds another observer: one MutationObserver serves every subscriber across renders", async () => {
  const RealObserver = globalThis.MutationObserver;
  let built = 0;
  globalThis.MutationObserver = class extends RealObserver { constructor(cb: MutationCallback) { super(cb); built++; } } as typeof MutationObserver;
  const host = document.createElement("div");
  document.body.append(host);
  const tree = createRoot(host);
  const View = ({ tick }: { tick: number }): ReturnType<typeof createElement> => createElement("span", { "data-tick": tick }, useSurfaceVariant("scene.hud") + useSurfaceVariant("scene.layout"));
  try {
    for (let tick = 0; tick < 6; tick++) await act(async () => { tree.render(createElement(View, { tick })); });
    expect(built).toBeLessThanOrEqual(1);
    await act(async () => { document.documentElement.setAttribute("data-surface-scene-hud", "chips"); });
    expect(host.textContent).toBe("chipscore");
  } finally {
    await act(async () => { tree.unmount(); });
    document.documentElement.removeAttribute("data-surface-scene-hud");
    globalThis.MutationObserver = RealObserver;
  }
});

test("two copies of the module (each app bundle ships its own) read the same root attribute", async () => {
  const second = (await import(/* @vite-ignore */ "./surface-variant.ts" + "?second-bundle-copy")) as typeof import("./surface-variant");
  setSurfacePicks({ "library.grid": "catalog-list" });
  expect(second.surfaceVariant("library.grid")).toBe("catalog-list");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const View = (): ReturnType<typeof createElement> => createElement("span", null, second.useSurfaceVariant("library.grid"));
  await act(async () => { root.render(createElement(View)); });
  await act(async () => { setSurfacePicks({ "library.grid": "covers" }); });
  expect(host.textContent).toBe("covers");
  await act(async () => { root.unmount(); setSurfacePicks({}); });
});
