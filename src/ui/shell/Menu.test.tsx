/**
 * The shell menu and the Escape arbiter. Menu is mounted for the life of the shell, so registering as an Escape
 * owner unconditionally made it the owner of every plain press (it consumed the press, a no-op when nothing was
 * open) and kept the floating agent and focus mode from ever hearing Escape. It now registers only while open.
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom, type InstalledDom } from "../_shared/test-dom";
import { useEscapeKey } from "../_shared/use-escape-key";
import { Menu } from "./Menu";
import { useShellStore } from "./store";

let installed: InstalledDom;
beforeAll(() => { installed = installDom(undefined, { extraGlobals: ["KeyboardEvent", "SVGElement", "Event", "CustomEvent"], globals: { IS_REACT_ACT_ENVIRONMENT: true } }); });
afterAll(() => installed.teardown());

let root: Root | null = null;
let host: HTMLElement;
afterEach(() => {
  act(() => useShellStore.getState().closeMenu());
  act(() => root?.unmount());
  host?.remove();
  root = null;
});

function mount(fired: string[]): void {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  // An overlay like the agent can be listening before the menu mounts or opens; Menu must not take its press when nothing is open.
  function Overlay(): null {
    useEscapeKey(() => { fired.push("overlay"); });
    return null;
  }
  act(() => root!.render(<><Overlay /><Menu /></>));
}
const escape = (): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  act(() => { document.body.dispatchEvent(event); });
  return event;
};

describe("Menu and Escape", () => {
  test("with no menu open the press belongs to whatever else is listening", () => {
    const fired: string[] = [];
    mount(fired);
    escape();
    expect(fired).toEqual(["overlay"]);
  });

  test("an open menu closes on Escape, ahead of an overlay that opened before it", () => {
    const fired: string[] = [];
    mount(fired);
    act(() => useShellStore.getState().showMenu(10, 10, { type: "shell", label: "Menu" }, [[{ label: "Do it", onPick: () => undefined }]]));
    expect(useShellStore.getState().openMenu).not.toBeNull();
    escape();
    expect(useShellStore.getState().openMenu).toBeNull();
    expect(fired).toEqual([]);
  });
});
