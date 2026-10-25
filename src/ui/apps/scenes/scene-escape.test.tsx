/**
 * Escape inside the scene's two small editors goes through isEscapeClose (dry audit A2): the take rename box
 * used to cancel on a bare `key === "Escape"` and so cancelled on the Escape that dismisses an IME composition.
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { TakeSummary } from "../../../studio/scenes";
import { installDom } from "../../_shared/test-dom";
import { EditBox } from "./scene-edit-box";
import { TakesMenu } from "./scene-takes";

const installed = installDom(undefined, {
  extraGlobals: ["KeyboardEvent", "HTMLTextAreaElement", "HTMLInputElement", "SVGElement", "Event", "CustomEvent"],
  boundGlobals: ["getComputedStyle"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true }
});
afterAll(() => installed.teardown());

let root: Root | null = null;
let host: HTMLElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
});
const mount = (node: React.ReactElement): void => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(node));
};
const press = (target: Element, init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...init });
  act(() => { target.dispatchEvent(event); });
  return event;
};

const take = (id: string, parent: string | null, name: string): TakeSummary =>
  ({ id, name, parentBranchId: parent, createdAt: 1_700_000_000_000, messageCount: 2 }) as TakeSummary;

describe("the take rename box", () => {
  const menu = (): React.ReactElement => (
    <TakesMenu takes={[take("a", null, "Original"), take("b", "a", "Alt")]} activeId="a" onSwitch={() => undefined} onRename={() => undefined} onDelete={() => undefined} />
  );
  const startRename = (): HTMLInputElement => {
    mount(menu());
    act(() => { (host.querySelector('button[aria-label="Rename Alt"]') as HTMLButtonElement).click(); });
    return host.querySelector("input[aria-label='Take name']") as HTMLInputElement;
  };

  test("Escape cancels the rename", () => {
    startRename();
    press(host.querySelector("input[aria-label='Take name']")!, {});
    expect(host.querySelector("input[aria-label='Take name']")).toBeNull();
  });

  test("the Escape that dismisses an IME composition does not cancel it", () => {
    const box = startRename();
    press(box, { isComposing: true });
    expect(host.querySelector("input[aria-label='Take name']")).not.toBeNull();
  });
});

describe("the message edit box", () => {
  const box = (calls: string[]): React.ReactElement => (
    <EditBox value="hi" onChange={() => undefined} onSave={() => calls.push("save")} onCancel={() => calls.push("cancel")} />
  );

  test("Escape cancels and is spent so the arbiter never also stops a running reply", () => {
    const calls: string[] = [];
    mount(box(calls));
    const event = press(host.querySelector("textarea")!, {});
    expect(calls).toEqual(["cancel"]);
    expect(event.defaultPrevented).toBe(true);
  });

  test("an IME Escape is left alone", () => {
    const calls: string[] = [];
    mount(box(calls));
    press(host.querySelector("textarea")!, { isComposing: true });
    expect(calls).toEqual([]);
  });

  test("Ctrl+Enter saves", () => {
    const calls: string[] = [];
    mount(box(calls));
    press(host.querySelector("textarea")!, { key: "Enter", ctrlKey: true });
    expect(calls).toEqual(["save"]);
  });
});
