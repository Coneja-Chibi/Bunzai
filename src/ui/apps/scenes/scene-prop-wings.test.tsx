/**
 * A Prop's own wing (RoleCall: "their wing icons and deeper panels appear only when enabled"). A Prop that declares a `rail`
 * and has a panel gets an icon on the right rail while it is on, and the wing opens the same panel its gear opens in the
 * Props wing. The Story Director is the one that asks: its arcs and seeds were reachable only from a small gear inside Props.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { JSDOM } from "jsdom";
import { createElement, type JSX } from "react";
import type { Root } from "react-dom/client";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { AppContext } from "../../app-contract";
import { installDom, type InstalledDom, flushTasks } from "../../_shared/test-dom";
import { DIRECTOR_PROP_ID } from "../../../core/director/settings";
import type { SceneProp } from "./props/prop-contract";
import { sceneProps } from "./props/registry";
import { WingPanel, WingRails } from "./scene-wings";
import { propWings, wingOf } from "./scene-wing-data";

let dom: JSDOM;
let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8323/", extraGlobals: ["SVGElement", "Event", "MouseEvent"] });
  dom = installed.dom;
});
afterAll(() => installed.teardown());

const fake = (id: string, extra: Partial<SceneProp>): SceneProp => ({
  id, name: `Prop ${id}`, reach: "none", blurb: "b", tier: "t", icon: "lucide:zap", tone: "var(--accent)", ...extra,
});
const panelKind = (id: string): NonNullable<SceneProp["panel"]> => ({ id, title: `Panel ${id}`, noun: `Panel ${id}`, icon: "lucide:zap", render: () => <div className="fake-panel">{`inside ${id}`}</div> });
const railed = fake("railed", { rail: { blurb: "Its own wing" }, panel: panelKind("railed") });
const plain = fake("plain", { panel: panelKind("plain") });
const chat = { id: "c1" } as Chat;
const ctx = { prefs: { get: () => undefined, set: () => undefined } } as unknown as AppContext;

async function render(ui: JSX.Element): Promise<HTMLElement> {
  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const host = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(host);
  const root: Root = createRoot(host);
  flushSync(() => root.render(ui));
  await flushTasks();
  return host;
}

describe("a Prop's own wing", () => {
  test("only a Prop that asks for a rail, has a panel, and is on gets a right-rail wing", () => {
    expect(propWings([railed, plain], ["railed", "plain"]).map((w) => [w.id, w.side, w.label, w.blurb])).toEqual([["prop:railed", "r", "Prop railed", "Its own wing"]]);
    expect(propWings([railed, plain], ["plain"])).toEqual([]);
    expect(propWings([railed], null)).toEqual([]);
  });

  test("the Story Director is registered with its own wing", () => {
    expect(propWings(sceneProps(), [DIRECTOR_PROP_ID]).map((w) => w.label)).toEqual(["Story Director"]);
  });

  test("a Prop wing sits on the right, so the scene opens toward it", () => {
    expect(wingOf("prop:railed", propWings([railed], ["railed"]))?.side).toBe("r");
    expect(wingOf("ai")?.side).toBe("r");
    expect(wingOf("props")?.side).toBe("l");
    expect(wingOf(null)?.side).toBeUndefined();
  });

  test("the right rail shows the Prop's icon after the built-in wings", async () => {
    const host = await render(createElement(WingRails, { open: null, onToggle: () => undefined, extra: propWings([railed], ["railed"]) }));
    const right = host.querySelector('nav.rail.r')!;
    const labels = [...right.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
    expect(labels[labels.length - 1]).toBe("Prop railed");
    expect(host.querySelector('nav.rail.l [aria-label="Prop railed"]')).toBeNull();
  });

  test("the wing opens the Prop's panel, docked, the same panel the gear opens", async () => {
    const host = await render(createElement(WingPanel, { id: "prop:railed", propWing: { list: [railed], on: ["railed"], host: { ctx, chat } } }));
    const section = host.querySelector('[data-part="scene.wings.panel"]')!;
    expect(section.getAttribute("data-wing")).toBe("prop:railed");
    expect(section.textContent).toContain("inside railed");
  });

  test("while the scene's Props are still unknown the wing says it is reading them, or that it could not, never that the Prop is off", async () => {
    const reading = await render(createElement(WingPanel, { id: "prop:railed", propWing: { list: [railed], on: null, host: { ctx, chat } } }));
    expect(reading.textContent).toContain("Reading this scene's Props");
    expect(reading.textContent).not.toContain("is off");
    const failed = await render(createElement(WingPanel, { id: "prop:railed", propWing: { list: [railed], on: null, failed: true, host: { ctx, chat } } }));
    expect(failed.textContent).toContain("could not be read");
    expect(failed.textContent).not.toContain("is off");
  });

  test("a Prop wing whose Prop is off says so instead of drawing its panel", async () => {
    const host = await render(createElement(WingPanel, { id: "prop:railed", propWing: { list: [railed], on: [], host: { ctx, chat } } }));
    expect(host.textContent).not.toContain("inside railed");
    expect(host.textContent).toContain("Prop railed is off");
  });
});
