/** theme-keys detector: every selector form that names a theme id is flagged; core plumbing, surface picks and theme-key-ok are not. */
import { describe, expect, test } from "bun:test";
import { themeKeyHits } from "./theme-keys-core";

describe("themeKeyHits", () => {
  test("flags every selector form that names a theme id", () => {
    for (const line of [
      'html[data-theme="theater"] .a { color: red; }',
      ":global(html[data-theme='paper']) .b {}",
      ":root[data-theme=stage] .c {}",
      'html[data-theme^="encore"] .d {}',
      'const css = `[data-theme="girliepop"] .e{}`;',
      'const css = "html[data-theme=\\"theater\\"] .f{}";',
      'html[data-theme="bunzai.theme.encore"] .g {}',
      'html[data-theme="greenroom"] .h {}',
    ]) expect(themeKeyHits(line)).toHaveLength(1);
  });

  test("flags TS logic that compares a value to a built-in id", () => {
    for (const line of [
      'const isDark = theme !== "paper";',
      "if (appearance.themeId === 'stage') return label;",
      'const flavor = "theater" === id ? 1 : 2;',
      'case "paper": return 1;',
      'if (id == "bunzai.theme.encore") {}',
      'const rc = theme === "greenroom";',
    ]) expect(themeKeyHits(line)).toHaveLength(1);
  });

  test("allows defaults, third-party ids and opted-out comparisons", () => {
    expect(themeKeyHits('const theme = next.theme ?? "theater";')).toEqual([]);
    expect(themeKeyHits('if (id === "bunzai.theme.neon-pop") {}')).toEqual([]);
    expect(themeKeyHits('const kind = "paper-cut";')).toEqual([]);
    expect(themeKeyHits(['// theme-key-ok: bundled set only', 'const a = id === "paper";'].join(String.fromCharCode(10)))).toEqual([]);
  });

  test("allows core plumbing and surface picks", () => {
    expect(themeKeyHits('<html lang="en" data-theme="core">')).toEqual([]);
    expect(themeKeyHits('html[data-surface-ui-controls="quiet"] .a {}')).toEqual([]);
    expect(themeKeyHits('const SLOT_ATTRIBUTE = "data-theme-slots";')).toEqual([]);
  });

  test("theme-key-ok on the line or the line above opts out", () => {
    expect(themeKeyHits('html[data-theme="paper"] .a {} /* theme-key-ok: core plumbing */')).toEqual([]);
    expect(themeKeyHits('/* theme-key-ok: light/dark plumbing */\nhtml[data-theme="paper"] .a {}')).toEqual([]);
    expect(themeKeyHits('/* note */\n\nhtml[data-theme="paper"] .a {}')).toHaveLength(1);
  });

  test("reports 1-based line numbers", () => {
    expect(themeKeyHits('a\nhtml[data-theme="paper"] .a {}')[0]?.line).toBe(2);
  });
});
