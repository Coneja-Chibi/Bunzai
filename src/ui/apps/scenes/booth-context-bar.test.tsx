/**
 * The Control Booth's Context Usage bar and Scene Readout (RoleCall QuickPlayPanel.tsx:501-537 and :1619-1646): the bar is the Context wing's own Context Pressure meter
 * (same figures, same thresholds and target prefs), centred figures read Msgs, Tokens, Avg in RoleCall's order, and the Story Director tile follows the scene's Props switch.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { AppContext } from "../../app-contract";
import type { SceneTrace } from "../../app-contract-scenes";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { TARGET_KEY, THRESHOLDS_KEY } from "./context/pressure-core";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { observers: true, url: "http://127.0.0.1:8341/", pretendToBeVisual: true, globals: { IS_REACT_ACT_ENVIRONMENT: true } });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const chat = { id: "chat1", title: "Scene", cast: { character: { id: "c1", version: 1, name: "Char" } }, activeBranchId: "b1", createdAt: 0, updatedAt: 0, snapshotVersion: 1 } as unknown as Chat;
const scene = { chat, messages: [], messageCount: 9, snapshot: {} } as unknown as OpenScene;
const trace = (tokens: number, window = { context: 10_000, reply: 1000, stated: true }): SceneTrace => ({
  reply: { messageId: "m", swipeId: "s", number: 2, model: "m", take: "t" }, blocks: [{ kind: "prompt", label: "Main", role: "system", tokens, category: "preset" }], window, trimmed: 0, lore: null, rawAvailable: false, replies: [],
});

async function mount(t: SceneTrace | null, prefs: Record<string, unknown> = {}) {
  const { BoothReadout } = await import("./booth-readout");
  const ctx = { api: { getSceneTrace: async () => t }, prefs: { get: (k: string) => prefs[k], set: () => undefined } } as unknown as AppContext;
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<BoothReadout ctx={ctx} scene={scene} />); });
  return { host, done: () => { act(() => root.unmount()); host.remove(); } };
}

describe("the Booth's Context Usage bar", () => {
  test("it reads the Context wing's meter: the request's tokens over the window, filled to that percent", async () => {
    const m = await mount(trace(2500));
    expect(m.host.querySelector(".bth-cx")!.textContent).toBe("Context2,500 / 10,000");
    expect(m.host.querySelector<HTMLElement>(".bth-bar i")!.style.width).toBe("25%");
    expect(m.host.querySelector(".bth-bar")!.getAttribute("aria-valuenow")).toBe("25");
    m.done();
  });

  test("a Context Target the viewer set in the Context wing is the limit here too, and the bar colours at the wing's own marks", async () => {
    const m = await mount(trace(900), { [TARGET_KEY]: 1024, [THRESHOLDS_KEY]: { warning: 50, danger: 80, critical: 98 } });
    expect(m.host.querySelector(".bth-cx")!.textContent).toBe("Context900 / 1,024");
    expect(m.host.querySelector<HTMLElement>(".bth-bar i")!.style.getPropertyValue("--bar")).toBe("var(--stage-danger-text)");
    m.done();
  });

  test("a reply past the critical mark glows, and with no reply yet the bar is empty rather than missing", async () => {
    let m = await mount(trace(9900));
    expect(m.host.querySelector(".bth-bar")!.classList.contains("hot")).toBe(true);
    m.done();
    m = await mount(null);
    expect(m.host.querySelector(".bth-cx")!.textContent).toBe("Context0 / -");
    expect(m.host.querySelector<HTMLElement>(".bth-bar i")!.style.width).toBe("0%");
    m.done();
  });
});

describe("the Booth's Scene Readout", () => {
  test("it reads Msgs, Tokens, Avg in RoleCall's order, value above label", async () => {
    const m = await mount(trace(2500));
    const cells = [...m.host.querySelectorAll('[data-part="scene.booth.readout"] > div')].map((d) => [d.querySelector("small")!.textContent, d.querySelector("b")!.textContent]);
    expect(cells).toEqual([["Msgs", "9"], ["Tokens", "~2.5k"], ["Avg", "-"]]);
    m.done();
  });
});

describe("the Booth's Story Director tile", () => {
  test("it follows the scene's Props switch, reads off when the read fails, and reads again when the tick changes", async () => {
    const { useDirectorOn } = await import("./use-director-on");
    const { DIRECTOR_PROP_ID } = await import("../../../core/director/settings");
    let on: string[] = [DIRECTOR_PROP_ID];
    let fail = false;
    const ctx = { api: { getSceneProps: async () => { if (fail) throw new Error("locked"); return { on }; } } } as unknown as AppContext;
    const seen: boolean[] = [];
    function Probe({ tick }: { tick: number }) { seen.push(useDirectorOn(ctx, "chat1", tick)); return null; }
    const host = dom.window.document.createElement("div");
    const root = createRoot(host);
    await act(async () => { root.render(<Probe tick={0} />); });
    expect(seen.at(-1)).toBe(true);
    on = [];
    await act(async () => { root.render(<Probe tick={1} />); });
    expect(seen.at(-1)).toBe(false);
    on = [DIRECTOR_PROP_ID];
    fail = true;
    await act(async () => { root.render(<Probe tick={2} />); });
    expect(seen.at(-1)).toBe(false);
    act(() => root.unmount());
  });
});
