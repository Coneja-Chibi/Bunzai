/** The accessibility choices: stored values read back safely and paint the root; CSS keeps the 12px floor at the smallest size. */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { installDom, type InstalledDom } from "../_shared/test-dom";
import { SETTING_KEYS } from "../../studio/settings-shape";
import { UI_TEXT, uiTextSizeOf } from "../_shared/accessibility-prefs";
import { paintAccessibility } from "./accessibility";

let installed: InstalledDom;
beforeAll(() => { installed = installDom(); });
afterAll(async () => { await installed.teardown(); });

describe("accessibility settings", () => {
  test("a stored size reads back inside the range, anything odd is the default", () => {
    expect(uiTextSizeOf(undefined)).toBe(UI_TEXT.def);
    expect(uiTextSizeOf("18")).toBe(UI_TEXT.def);
    expect(uiTextSizeOf(Number.NaN)).toBe(UI_TEXT.def);
    expect(uiTextSizeOf(4)).toBe(12);
    expect(uiTextSizeOf(99)).toBe(20);
    expect(uiTextSizeOf(16.4)).toBe(16);
  });

  test("the choices paint the root and unset cleanly", () => {
    const root = document.documentElement;
    paintAccessibility({ [SETTING_KEYS.uiTextSize]: 18, [SETTING_KEYS.uiReduceMotion]: true, [SETTING_KEYS.uiHighContrast]: true });
    expect(root.style.getPropertyValue("--ui-scale")).toBe(String(18 / 14));
    expect(root.hasAttribute("data-reduce-motion")).toBe(true);
    expect(root.hasAttribute("data-high-contrast")).toBe(true);
    paintAccessibility({ [SETTING_KEYS.uiReduceMotion]: "yes" });
    expect(root.style.getPropertyValue("--ui-scale")).toBe("");
    expect(root.hasAttribute("data-reduce-motion")).toBe(false);
    expect(root.hasAttribute("data-high-contrast")).toBe(false);
  });

  test("the smallest size keeps meta text at 12px or more, and control text equals the minimum", () => {
    const css = readFileSync(new URL("../theme/tokens.css", import.meta.url), "utf8");
    expect(css).toMatch(/--text-meta:\s*max\(12px,/);
    expect(UI_TEXT.min).toBeGreaterThanOrEqual(12);
    expect(UI_TEXT.def * (UI_TEXT.min / UI_TEXT.def)).toBe(UI_TEXT.min);
  });
});
