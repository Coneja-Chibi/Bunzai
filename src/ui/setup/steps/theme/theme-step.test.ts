/** The setup theme step: the default theme is listed first and preselected, and every bundled theme is offered once. */
import { expect, test } from "bun:test";
import { DEFAULT_STUDIO_THEME, DEFAULT_THEME_NAME, STUDIO_THEMES } from "../../../../studio/settings-shape";
import { defaultValue } from "../../wizard-core";
import step from "./index";

const options = await step.options({} as never);

test("the default theme is first, titled from its manifest, and the only preselected option", () => {
  expect(options[0]).toMatchObject({ id: DEFAULT_STUDIO_THEME, title: DEFAULT_THEME_NAME, isDefault: true });
  expect(options.filter((o) => o.isDefault)).toHaveLength(1);
  expect(defaultValue(step.manifest, options)).toBe(DEFAULT_STUDIO_THEME);
});

test("every bundled theme is offered exactly once", () => {
  expect(options.map((o) => o.id).sort()).toEqual([...STUDIO_THEMES].sort());
});
