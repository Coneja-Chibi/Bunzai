/**
 * ProtectedDialog's contract: a modal <dialog> in the top layer, portaled to the body, that Escape and a stray close cannot
 * dismiss. jsdom has no top layer; test-dom's showModal() records `modal`, and what the real browser then does with it is
 * proved in headless Chrome (src/ui/shell/protected-browser.test.ts and the live run in the log).
 */
import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { installDom } from "./test-dom";
import { ProtectedDialog } from "./protected-dialog";

const installed = installDom('<!doctype html><div id="root"></div>', { pretendToBeVisual: true, extraGlobals: ["Event", "HTMLDialogElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
afterAll(() => installed.teardown());

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; });

const mount = (strict = false): void => {
  const host = document.getElementById("root")!;
  host.replaceChildren();
  root = createRoot(host);
  const dialog = createElement(ProtectedDialog, { variant: "card", ariaLabel: "Test prompt", children: createElement("p", null, "body") });
  act(() => { root!.render(strict ? createElement(StrictMode, null, dialog) : dialog); });
};
const dialog = (): HTMLDialogElement & { modal?: boolean } => document.querySelector("dialog")!;

describe("ProtectedDialog", () => {
  test("opens as a modal, protected, and portaled to the body so its only ancestors are the page root", () => {
    mount();
    expect(dialog().open).toBe(true);
    expect(dialog().modal).toBe(true);
    expect(dialog().classList.contains("host-protected")).toBe(true);
    expect(dialog().parentElement).toBe(document.body);
    expect(document.getElementById("root")!.querySelector("dialog")).toBeNull();
  });

  test("stays open as a modal through a StrictMode double mount", () => {
    mount(true);
    expect(document.querySelectorAll("dialog")).toHaveLength(1);
    expect(dialog().open).toBe(true);
    expect(dialog().modal).toBe(true);
  });

  test("Escape (a cancel event) is refused", () => {
    mount();
    const cancel = new window.Event("cancel", { cancelable: true });
    dialog().dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
  });

  test("a close the dialog did not ask for opens it again", () => {
    mount();
    act(() => dialog().close());
    expect(dialog().open).toBe(true);
    expect(dialog().modal).toBe(true);
  });

  test("unmounting takes the dialog out of the page", () => {
    mount();
    act(() => root?.unmount());
    root = null;
    expect(document.querySelector("dialog")).toBeNull();
  });

  test("rendered to a string it stays in place, markup intact", () => {
    const html = renderToStaticMarkup(createElement(ProtectedDialog, { variant: "full", ariaLabel: "Door", children: createElement("p", null, "body") }));
    expect(html).toContain("<dialog");
    expect(html).toContain("host-protected");
    expect(html).toContain("<p>body</p>");
  });
});
