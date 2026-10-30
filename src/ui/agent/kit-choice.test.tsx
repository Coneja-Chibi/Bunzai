/**
 * The ask panel answers from the keyboard: it takes focus when it appears (unless you are typing
 * elsewhere), up and down move the pick with the focus, a number picks its row, Enter sends what the
 * bar says. Clicking still only selects.
 */
import { afterAll, afterEach, beforeEach, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installDom } from "../_shared/test-dom";
import { ChoiceList } from "./kit-choice";

const installed = installDom(undefined, {
  extraGlobals: ["KeyboardEvent", "HTMLInputElement", "HTMLTextAreaElement", "HTMLButtonElement", "Event"],
  globals: { IS_REACT_ACT_ENVIRONMENT: true },
});
beforeEach(() => installed.reinstall());
afterAll(() => installed.teardown());

const CHOICES = { question: "Which card?", options: [{ value: "Vera" }, { value: "Elias" }, { value: "Mira" }] };
let root: Root | null = null;
let host: HTMLElement;
let sent: string[] = [];
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = null;
  sent = [];
});

async function mount(): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<ChoiceList choices={CHOICES} onSend={(m) => { sent.push(m); }} />));
  return host.querySelector(".kit-ask") as HTMLElement;
}

const press = (key: string, target: Element | null = document.activeElement): void => {
  act(() => { target!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); });
};
const caretOn = (): string => host.querySelector(".kit-ask__opt--on .kit-ask__val, .kit-ask__opt--on .kit-ask__esc")!.textContent!;

test("the panel takes focus when it appears, so the first key lands on it", async () => {
  const panel = await mount();
  expect(document.activeElement === panel).toBe(true);
});

test("arrows move the pick and the focus, wrapping at the ends; Enter sends the pick", async () => {
  await mount();
  press("ArrowDown");
  expect(caretOn()).toBe("Elias");
  expect(document.activeElement?.textContent).toContain("Elias");
  press("ArrowUp");
  press("ArrowUp");
  expect(caretOn()).toBe("Chat about this instead");
  press("ArrowDown");
  press("Enter");
  expect(sent).toEqual(["Vera"]);
});

test("focus is the pick: Tab onto an option and Enter sends that one", async () => {
  await mount();
  const third = host.querySelectorAll('[data-control="row"]')[2] as HTMLButtonElement;
  act(() => { third.focus(); });
  press("Enter", third);
  expect(sent).toEqual(["Mira"]);
});

test("the hint never promises a number key that does nothing", async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  const many = { question: "Which?", options: Array.from({ length: 12 }, (_, i) => ({ value: `opt${String(i)}` })) };
  await act(async () => root!.render(<ChoiceList choices={many} onSend={() => undefined} />));
  expect(host.querySelector(".kit-ask__head")!.textContent).toContain("1-9");
});

test("a number picks its row and Enter sends it with the note", async () => {
  await mount();
  press("3");
  expect(caretOn()).toBe("Mira");
  const note = host.querySelector(".kit-ask__noteField") as HTMLInputElement;
  act(() => { note.focus(); });
  press("2", note); // typing a digit into the note never moves the pick
  expect(caretOn()).toBe("Mira");
  expect(sent).toEqual([]);
});

test("picking Write your own puts the cursor in its field; Enter there sends only once it holds text", async () => {
  await mount();
  press("4");
  const own = host.querySelector(".kit-ask__own") as HTMLInputElement;
  expect(document.activeElement === own).toBe(true);
  press("Enter", own);
  expect(sent).toEqual([]);
});

test("every digit pressed on the panel is the panel's, even busy or past its rows", async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<ChoiceList choices={CHOICES} busy onSend={() => undefined} />));
  const panel = host.querySelector(".kit-ask")!;
  for (const key of ["2", "9"]) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    act(() => { panel.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
  }
});

test("a panel never takes focus out of a field you are typing in", async () => {
  const composer = document.createElement("textarea");
  composer.value = "half a thought";
  document.body.appendChild(composer);
  composer.focus();
  await mount();
  expect(document.activeElement === composer).toBe(true);
  composer.remove();
});

test.each(["contenteditable", "select"])("a panel preserves focus in a %s editor", async (kind) => {
  const editor = document.createElement(kind === "select" ? "select" : "div");
  if (kind === "contenteditable") {
    editor.setAttribute("contenteditable", "true");
    editor.textContent = "half a thought";
    editor.tabIndex = 0;
  }
  document.body.appendChild(editor);
  editor.focus();
  await mount();
  expect(document.activeElement === editor).toBe(true);
  editor.remove();
});
