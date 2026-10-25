/**
 * The World wing's shell at RoleCall's rc-world-compendium.png: the "Scene / World" crumb, two equal cards
 * (LOREBOOK with its "N linked" line, COMPENDIUM), the Lorebook tab kept mounted while the Compendium
 * shows (so a pending typed edit is never unmounted away), and the wide world panel.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createElement } from "react";
import type { Root } from "react-dom/client";
import { installDom, teardownAllDoms, type InstalledDom } from "../../_shared/test-dom";
import { WingPanel } from "./scene-wings";

let installed: InstalledDom;
let host: HTMLElement;
let root: Root;
type FlushSync = typeof import("react-dom")["flushSync"];
let flushSync: FlushSync;

beforeAll(async () => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8330/", extraGlobals: ["SVGElement", "Event", "CustomEvent"], boundGlobals: ["getComputedStyle"] });
  flushSync = (await import("react-dom")).flushSync;
});
afterAll(async () => { await teardownAllDoms(); });
beforeEach(async () => {
  installed.reinstall();
  const { createRoot } = await import("react-dom/client");
  host = installed.dom.window.document.createElement("div");
  installed.dom.window.document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root.render(createElement(WingPanel, { id: "world", world: { panel: createElement("p", { id: "lore" }, "lore body"), compendium: createElement("p", { id: "comp" }, "compendium body"), meta: "2 linked" } })));
});

const tabs = (): HTMLElement[] => [...host.querySelectorAll<HTMLElement>('[role="tab"]')];

describe("the World wing shell", () => {
  test("reads Scene / World, then two cards: LOREBOOK with its linked count, COMPENDIUM", () => {
    expect(host.querySelector(".crumb")!.textContent).toBe("Scene / World");
    expect(tabs().map((t) => t.textContent)).toEqual(["Lorebook2 linked", "Compendium"]);
    expect(tabs().map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    expect(host.querySelector("section")!.className).toContain("world-wing");
  });

  test("Compendium shows its body and keeps the Lorebook tab mounted but hidden", () => {
    flushSync(() => tabs()[1]!.click());
    expect(tabs().map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(host.querySelector("#comp")).not.toBeNull();
    expect(host.querySelectorAll<HTMLElement>(".wtab")[0]!.hidden).toBe(true);
    expect(host.querySelectorAll(".wtab")[0]!.textContent).toBe("lore body");
    flushSync(() => tabs()[0]!.click());
    expect(host.querySelector("#comp")).toBeNull();
    expect(host.querySelectorAll<HTMLElement>(".wtab")[0]!.hidden).toBe(false);
  });
});
