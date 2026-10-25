/**
 * title-core.test - every "must not show" case from the title screen plan, as a table: the title
 * shows only when every reason to skip it is false.
 */
import { expect, test } from "bun:test";
import { shouldShowTitle, type TitleGateInput } from "./title-core";

const ALL_CLEAR: TitleGateInput = {
  reload: false,
  requested: false,
  freshFromSetup: false,
  restoredApp: false,
  webdriver: false,
};

test("a genuinely fresh launch shows the title", () => {
  expect(shouldShowTitle(ALL_CLEAR)).toBe(true);
});

test("a reload of the same tab never shows it", () => {
  expect(shouldShowTitle({ ...ALL_CLEAR, reload: true })).toBe(false);
});

test("a URL asking for a specific app wins over the title", () => {
  expect(shouldShowTitle({ ...ALL_CLEAR, requested: true })).toBe(false);
});

test("right after the setup wizard, the wizard already greeted them", () => {
  expect(shouldShowTitle({ ...ALL_CLEAR, freshFromSetup: true })).toBe(false);
});

test("a restored workspace bench that names an app wins over the title", () => {
  expect(shouldShowTitle({ ...ALL_CLEAR, restoredApp: true })).toBe(false);
});

test("automation (navigator.webdriver) never sees the title", () => {
  expect(shouldShowTitle({ ...ALL_CLEAR, webdriver: true })).toBe(false);
});

test("every reason to skip it stacks: more than one true is still false", () => {
  expect(shouldShowTitle({ ...ALL_CLEAR, reload: true, webdriver: true })).toBe(false);
});
