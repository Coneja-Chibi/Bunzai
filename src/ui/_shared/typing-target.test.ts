/**
 * isTypingTarget is the one answer to "is the user typing into this?" (dry audit A15). Six copies
 * disagreed: three missed <select>, and the tagName form cannot see inside a nested contenteditable
 * host (jsdom has no isContentEditable, so the fixtures below use real elements and the selector).
 */
import { afterAll, describe, expect, test } from "bun:test";
import { installDom } from "./test-dom";
import { isTypingTarget } from "./typing-target";

const installed = installDom(undefined, { extraGlobals: [] });
afterAll(() => installed.teardown());

const el = (html: string): HTMLElement => {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.firstElementChild as HTMLElement;
};

describe("isTypingTarget", () => {
  test("text boxes count", () => {
    expect(isTypingTarget(el("<input>"))).toBe(true);
    expect(isTypingTarget(el("<textarea></textarea>"))).toBe(true);
  });

  test("a <select> counts: a shortcut must not fire while a dropdown has focus", () => {
    expect(isTypingTarget(el("<select><option>a</option></select>"))).toBe(true);
  });

  test("an element nested inside a contenteditable host counts", () => {
    const host = el('<div contenteditable="true"><p><b>x</b></p></div>');
    expect(isTypingTarget(host.querySelector("b"))).toBe(true);
  });

  test("contenteditable=false is not a field", () => {
    expect(isTypingTarget(el('<div contenteditable="false"><b>x</b></div>').querySelector("b"))).toBe(false);
  });

  test("buttons, plain text and nothing do not count", () => {
    expect(isTypingTarget(el("<button>go</button>"))).toBe(false);
    expect(isTypingTarget(el("<p>text</p>"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
  });

  test("hand-made fixtures spelled the way the DOM spells them (uppercase tagName, isContentEditable)", () => {
    expect(isTypingTarget({ tagName: "TEXTAREA", isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: "SELECT", isContentEditable: false })).toBe(true);
    expect(isTypingTarget({ tagName: "SPAN", isContentEditable: true })).toBe(true);
    expect(isTypingTarget({ tagName: "BUTTON", isContentEditable: false })).toBe(false);
  });
});
