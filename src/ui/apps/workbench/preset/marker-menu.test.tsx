/**
 * The + Marker menu (wireframe prompt-placement-nodes.html, Legacy callout 4): it lists every slot, SillyTavern's and the
 * feature markers, greys the placed ones, and adds the picked slot.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../../../_shared/test-dom";
import { MarkerMenu } from "./marker-menu";

let installed: InstalledDom;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8475/", globals: { IS_REACT_ACT_ENVIRONMENT: true } });
});
afterAll(() => installed.teardown());

const mount = (placed: string[], onAdd: (slot: string) => void): { host: HTMLElement; root: Root } => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<MarkerMenu placed={new Set(placed)} onAdd={onAdd} />));
  return { host, root };
};

describe("+ Marker", () => {
  test("opens a menu of every slot, the placed ones greyed, and adds the one picked", () => {
    const added: string[] = [];
    const { host, root } = mount(["chatHistory", "trackers"], (slot) => added.push(slot));
    act(() => host.querySelector<HTMLButtonElement>("button")!.click());
    const items = [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    const byName = (name: string) => items.find((b) => b.textContent?.startsWith(name))!;
    expect(items.map((b) => b.querySelector('[data-slot="label"]')?.textContent)).toContain("Library trackers");
    expect(byName("Chat history").disabled).toBe(true);
    expect(byName("Trackers").disabled).toBe(true);
    expect(byName("Storyboards").disabled).toBe(false);
    act(() => byName("Storyboards").click());
    expect(added).toEqual(["storyboards"]);
    expect(host.querySelector('[role="menu"]')).toBeNull();
    act(() => root.unmount());
  });
});
