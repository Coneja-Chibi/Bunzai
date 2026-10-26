/** ui.controls: all four variants exist, are scoped to their own root attribute, stay square and colorless, and never reach the protected layer. */
import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { SURFACES } from "../../extensions/surface-registry";
import { installDom } from "./test-dom";
import { variantCssProblems } from "./variant-css-check";
import { CONTROLS_STYLE, installControlsStyle } from "./controls-style";

const dir = new URL("./variants/ui.controls/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const rules = CONTROLS_STYLE.split("}").map((r) => r.split("{") as [string, string?]).filter((r): r is [string, string] => r[1] !== undefined);

test("every registered ui.controls variant has its stylesheet", () => {
  for (const variant of SURFACES["ui.controls"]) expect(existsSync(`${dir}${variant}.ts`), variant).toBe(true);
});

test("each rule is scoped to a variant root attribute; element rules exclude the protected layer", () => {
  expect(rules.length).toBeGreaterThanOrEqual(16);
  for (const [selector] of rules) for (const part of selector.split(/,(?![^(]*\))/)) {
    const s = part.trim();
    expect(s, s).toMatch(/^html\[data-surface-ui-controls="[a-z]+"\]/);
    if (s.includes(" ")) expect(s, `${s} can reach .host-protected`).toContain(":not(.host-protected *)");
  }
});

test("square, token-only, focus-safe, and no control hidden", () => {
  expect(variantCssProblems(CONTROLS_STYLE, /^html\[data-surface-ui-controls="[a-z]+"\]/, /(button|input|select|textarea)\b|\[data-control\]/)).toEqual([]);
});

test("installControlsStyle paints one style element, once", async () => {
  const installed = installDom();
  try {
    installControlsStyle();
    installControlsStyle();
    expect(document.head.querySelectorAll("style#bk-controls")).toHaveLength(1);
    expect(document.getElementById("bk-controls")?.textContent).toBe(CONTROLS_STYLE);
  } finally { await installed.teardown(); }
});
