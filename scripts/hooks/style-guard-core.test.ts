/** The style guard's detectors: named fonts and viewport width queries are caught; tokens, container queries and escapes pass. */
import { expect, test } from "bun:test";
import { isStyleGuardedFile, styleViolation } from "./style-guard-core";

test("named fonts and raw font tokens are violations; theme font tokens are not", () => {
  expect(styleViolation(`.t { font-family: "Fraunces", serif; }`)?.rule).toBe("font");
  expect(styleViolation(`font: 700 14px var(--bk-font-display);`)?.match).toBe("var(--bk-font-display)");
  expect(styleViolation(`fontFamily: 'Inter'`)?.rule).toBe("font");
  expect(styleViolation(`.t { font-family: var(--font-fancy); }`)).toBeNull();
  expect(styleViolation(`.t { font: 600 13px var(--font-body); }`)).toBeNull();
});

test("viewport width media queries are violations; container and motion queries are not", () => {
  expect(styleViolation(`@media (max-width: 640px) {`)?.rule).toBe("viewport");
  expect(styleViolation(`@media screen and (min-width: 900px) {`)?.rule).toBe("viewport");
  expect(styleViolation(`@container (max-width: 640px) {`)).toBeNull();
  expect(styleViolation(`@media (prefers-reduced-motion: reduce) {`)).toBeNull();
});

test("styling the button element is a violation outside the family and the theme variants", () => {
  expect(styleViolation(`.scs .dd button { padding: 4px; }`, "src/ui/apps/scenes/tools-style.ts")?.rule).toBe("button");
  expect(styleViolation(`.cm > button:hover, .x {`, "src/ui/apps/scenes/a.css")?.rule).toBe("button");
  expect(styleViolation(`:where(button) { padding: 0; }`, "src/ui/components/button/styles.module.css")).toBeNull();
  expect(styleViolation(`& :where(button,input):focus-visible {`, "src/ui/_shared/variants/ui.controls/game.ts")).toBeNull();
  expect(styleViolation(`.ddItem { padding: 4px; }`, "src/ui/apps/scenes/tools-style.ts")).toBeNull();
  expect(styleViolation(`const x = document.querySelector("button");`, "src/ui/apps/x.ts")).toBeNull();
});

test("a same-line style-ok escape passes", () => {
  expect(styleViolation(`@media (max-width: 640px) { /* style-ok: print sheet */`)).toBeNull();
});

test("the theme sheet, the token bridge and tests are outside the guard", () => {
  expect(isStyleGuardedFile("src/ui/apps/press/styles.module.css")).toBe(true);
  expect(isStyleGuardedFile("src/ui/theme/tokens.css")).toBe(false);
  expect(isStyleGuardedFile("src/ui/shell/theme-tokens.ts")).toBe(false);
  expect(isStyleGuardedFile("src/ui/apps/press/press.test.tsx")).toBe(false);
  expect(isStyleGuardedFile("src/core/x.ts")).toBe(false);
});
