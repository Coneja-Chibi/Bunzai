/** RoleCall VVS-243: a tap on a message toggles its action bar on a narrow viewport; taps on controls are ignored; one tap never toggles twice. */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { TOUCH_BREAKPOINT_PX, TOUCH_DEBOUNCE_MS, isNarrow, ownsItsClick, tapToggles } from "./touch-actions-core";

let installed: InstalledDom;
beforeAll(() => { installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8326/" }); });
afterAll(() => installed.teardown());

test("narrow means under RoleCall's 1024 px (useIsMobile), tablets included", () => {
  expect(TOUCH_BREAKPOINT_PX).toBe(1024);
  expect(isNarrow(1023)).toBe(true);
  expect(isNarrow(1024)).toBe(false);
});

test("a second toggle inside 100 ms is the same tap's synthetic click and is swallowed", () => {
  expect(TOUCH_DEBOUNCE_MS).toBe(100);
  expect(tapToggles(1000, 0)).toBe(true);
  expect(tapToggles(1099, 1000)).toBe(false);
  expect(tapToggles(1100, 1000)).toBe(true);
});

test("controls that own their click (links, buttons, summaries, inputs, editable regions) are not taps on the bubble", () => {
  const dom = document.createElement("div");
  dom.innerHTML = `<p id="p">text</p><a id="a" href="#">l</a><details><summary><b id="s">s</b></summary></details><textarea id="t"></textarea><span role="button" id="r"></span>`;
  for (const id of ["a", "s", "t", "r"]) expect(ownsItsClick(dom.querySelector(`#${id}`))).toBe(true);
  expect(ownsItsClick(dom.querySelector("#p"))).toBe(false);
  expect(ownsItsClick(null)).toBe(false);
});
