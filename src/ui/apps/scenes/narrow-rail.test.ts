/** Below a 1024px scene container no wing may become unreachable: the rail turns into a button row in the core style and in every column-rail wings variant. */
import { expect, test } from "bun:test";
import { narrowRail } from "./narrow-rail";
import { SCENE_STYLE } from "./scene-style";
import marginalia from "./variants/scene.wings/marginalia";
import pauseMenu from "./variants/scene.wings/pause-menu";

const narrow = (css: string): string => css.slice(css.indexOf("@container (max-width:1023px)"));

test("the core narrow block shows the rails as a row instead of hiding them", () => {
  expect(narrow(SCENE_STYLE)).toContain(narrowRail(".scs"));
  expect(/\.rail\{display:none\}/.test(narrow(SCENE_STYLE))).toBe(false);
});

test("the column-rail wings variants splice the same row in, scoped to their own attribute", () => {
  for (const [variant, css] of [["marginalia", marginalia], ["pause-menu", pauseMenu]] as const) {
    expect(narrow(css), variant).toContain(narrowRail(`html[data-surface-scene-wings="${variant}"] .scs`));
  }
});
