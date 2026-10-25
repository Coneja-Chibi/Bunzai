/** The chat summary's settings as the readers see them (RoleCall `lib/summary/settings.ts`, rc-parity 08): sparse saved keys over RoleCall's defaults, and the three derived numbers. */
import { describe, expect, test } from "bun:test";
import { SUMMARY_DEFAULTS, automationActive, contextWindow, resolveSummary, summaryWindow } from "./settings";

describe("resolveSummary", () => {
  test("nothing saved is RoleCall's defaults: off, rolling, replace, in context, nothing hidden, 0.3, 150 tokens", () => {
    expect(resolveSummary(undefined)).toEqual({ auto: false, interval: 0, method: "rolling", mode: "replace", include: true, hideOld: false, temperature: 0.3, maxTokens: 150, truncate: false, reasoning: false });
    expect(SUMMARY_DEFAULTS).toMatchObject({ enabledInterval: 60, keepRecent: 60, sourceLimit: 200 });
  });
  test("saved keys win; unsaved ones keep the default", () => {
    const r = resolveSummary({ auto: true, interval: 40, method: "pair", include: false, window: 12, keepRecent: 30, model: { id: "c", model: "m" }, prompt: "P" });
    expect(r).toMatchObject({ auto: true, interval: 40, method: "pair", include: false, window: 12, keepRecent: 30, model: { id: "c", model: "m" }, prompt: "P", temperature: 0.3 });
  });
});

describe("automationActive", () => {
  test("is on only when switched on and it has something to count by: a pair, or an interval above zero", () => {
    expect(automationActive(resolveSummary({ auto: true, method: "pair" }))).toBe(true);
    expect(automationActive(resolveSummary({ auto: true, interval: 20 }))).toBe(true);
    expect(automationActive(resolveSummary({ auto: true }))).toBe(false);
    expect(automationActive(resolveSummary({ interval: 20 }))).toBe(false);
  });
});

describe("the windows", () => {
  test("messages per summary: the setting, else the interval, else all", () => {
    expect(summaryWindow(resolveSummary({ window: 8, interval: 20 }))).toBe(8);
    expect(summaryWindow(resolveSummary({ interval: 20 }))).toBe(20);
    expect(summaryWindow(resolveSummary({}))).toBeUndefined();
  });
  test("newest messages kept beside a summary: keep-recent, else the summary window, else none stated", () => {
    expect(contextWindow(resolveSummary({ keepRecent: 30, window: 8 }))).toBe(30);
    expect(contextWindow(resolveSummary({ window: 8 }))).toBe(8);
    expect(contextWindow(resolveSummary({ interval: 20 }))).toBe(20);
    expect(contextWindow(resolveSummary({}))).toBeUndefined();
  });
});
