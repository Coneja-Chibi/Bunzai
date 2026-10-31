/** Linked rp-core scenes expose an independent wing with persisted feature switches. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import type { AppContext } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";
import type { CoreSceneState } from "../../../studio/core-inspect";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8325/" }); });
afterAll(() => installed.teardown());

const scene = { core: true, chat: { id: "c1" }, branchVersion: 1 } as unknown as OpenScene;
let state: CoreSceneState = {
  directorEnabled: false, memoryEnabled: true, director: null,
  memory: { total: 0, offset: 0, items: [], queued: 0, running: false, parked: 0 },
};
const writes: Array<[string, string, boolean]> = [];
const ctx = { api: {
  getCoreSceneState: async () => state,
  setCoreSceneFeature: async (chatId: string, feature: "director" | "memory", enabled: boolean) => {
    writes.push([chatId, feature, enabled]);
    state = { ...state, [feature === "director" ? "directorEnabled" : "memoryEnabled"]: enabled };
    return state;
  },
} } as unknown as AppContext;

test("rp-core has its own right rail button and saves both switches", async () => {
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { CORE_WING, WingPanel, WingRails } = await import("./scene-wings");
  const host = installed.dom.window.document.createElement("div");
  installed.dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<><WingRails open="core" onToggle={() => undefined} extra={[CORE_WING]} /><WingPanel id="core" core={{ ctx, scene }} /></>));
  expect(CORE_WING.side).toBe("r");
  expect(host.querySelector('nav.rail.r [data-wing="core"]')).not.toBeNull();
  expect(host.querySelector('[data-wing="core"].wing-panel')).not.toBeNull();
  await new Promise((resolve) => setTimeout(resolve, 10));
  const switches = () => [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
  expect(switches().map((button) => button.getAttribute("aria-checked"))).toEqual(["false", "true"]);
  flushSync(() => switches()[0]!.click());
  await new Promise((resolve) => setTimeout(resolve, 10));
  flushSync(() => switches()[1]!.click());
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(writes).toEqual([["c1", "director", true], ["c1", "memory", false]]);
  expect(switches().map((button) => button.getAttribute("aria-checked"))).toEqual(["true", "false"]);
  flushSync(() => root.unmount());
  host.remove();
});

test("Director seeds show their hint and payoff rather than a numbered placeholder", async () => {
  state = { ...state, director: { turn: 1, ok: true, state: { seeds: [{ id: "seed-1", hint: "A silver key", payoff: "Opens the masked door" }] } } };
  const { flushSync } = await import("react-dom");
  const { createRoot } = await import("react-dom/client");
  const { WingPanel } = await import("./scene-wings");
  const host = installed.dom.window.document.createElement("div");
  installed.dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(<WingPanel id="core" core={{ ctx, scene }} />));
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(host.textContent).toContain("A silver key");
  expect(host.textContent).toContain("Opens the masked door");
  expect(host.textContent).not.toContain("Item 1");
  flushSync(() => root.unmount());
  host.remove();
});
