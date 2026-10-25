/**
 * RoleCall's chrome reaches no other theme: a rule written for it is re-rooted under html[data-chrome="rolecall"], the sub-12px sizes it draws are tokens that fall
 * back to the theme's own small size, and the sheets that were changed for it use only sizes that exist.
 */
import { describe, expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { BUBBLE_STYLE } from "./scene-bubble-style";
import { FINAL_CUT_STYLE } from "./final-cut/fc-style";
import { COMPOSER_STYLE } from "./composer-style";
import { TRACKER_STYLE } from "./props/trackers/tracker-style";
import { BATTLE_STYLE } from "./props/trackers/battle/battle-style";
import { RC, RC_SIZE_STYLE, rcScope } from "./rc-chrome";

describe("rcScope", () => {
  test("roots every selector of a rule, inside a media block too, and leaves keyframes and values alone", () => {
    const out = rcScope(`.scs .a,.scs .b{color:red}\n@media (hover:hover){.scs .c:hover{opacity:1}}\n@keyframes k{from{opacity:0}}\n.sct .d{margin:0}`);
    expect(out).toBe(`${RC} .scs .a,${RC} .scs .b{color:red}\n@media (hover:hover){${RC} .scs .c:hover{opacity:1}}\n@keyframes k{from{opacity:0}}\n${RC} .sct .d{margin:0}`);
  });
});

describe("the size tokens", () => {
  test("every one is the theme's small text size by default and its real size under RoleCall's chrome", () => {
    const [root, rc] = RC_SIZE_STYLE.trim().split("\n");
    expect(root).toContain("--rc-s-10px:var(--text-meta)");
    expect(root).toContain("--rc-s-p62rem:var(--text-meta)");
    expect(rc!.startsWith(`${RC}{`)).toBe(true);
    expect(rc).toContain("--rc-s-10px:10px");
    expect(rc).toContain("--rc-s-p62rem:.62rem");
  });

  test("a sheet only asks for sizes that are defined", () => {
    const defined = new Set([...RC_SIZE_STYLE.matchAll(/--rc-s-([a-z0-9]+):/g)].map((m) => m[1]));
    const asked = new Set<string>();
    for (const file of new Glob("**/*style*.ts").scanSync({ cwd: import.meta.dir, absolute: true })) {
      for (const m of readFileSync(file, "utf8").matchAll(/var\(--rc-s-([a-z0-9]+)\)/g)) asked.add(m[1]!);
    }
    expect(asked.size).toBeGreaterThan(0);
    expect([...asked].filter((s) => !defined.has(s))).toEqual([]);
  });
});

describe("the sheets changed for RoleCall", () => {
  test("the message sheet gives every theme only the portrait slot, the delete menu's rule, the zoom button and the avatars-off rule", () => {
    const bare = BUBBLE_STYLE.split("\n").filter((l) => l.startsWith(".scs") || l.startsWith("html .scs"));
    expect(bare.map((l) => l.slice(0, l.indexOf("{")))).toEqual([".scs .msg .pw", ".scs .msg .pw .por", ".scs .msg .pw .pstamp", 'html .scs[data-look~="noavatar"] .msg .pw', ".scs .dd .menu-rule", ".scs .pzoom", ".scs .pzoom:hover"]);
  });

  test("a scene with avatars off drops the whole portrait column, and RoleCall's chrome keeps the time in the meta row for it", () => {
    expect(BUBBLE_STYLE).toContain('html .scs[data-look~="noavatar"] .msg .pw{display:none}');
    expect(BUBBLE_STYLE).toContain(`${RC} .scs[data-look~="noavatar"] .msg .meta .ts{display:inline}`);
  });

  test("the composer, tracker and Combat sheets keep their old rules for every theme and put the glass menu, the glows and the motion under RoleCall's chrome", () => {
    const bare = (css: string): string[] => css.split("\n").filter((l) => l.startsWith(".scs "));
    expect(bare(COMPOSER_STYLE).filter((l) => l.startsWith(".scs .dockbar") || l.includes("backdrop-filter:blur(40px)"))).toEqual([]);
    expect(bare(TRACKER_STYLE).filter((l) => l.includes("filter:blur(") || l.includes("animation:"))).toEqual([]);
    expect(bare(BATTLE_STYLE).filter((l) => l.includes("animation:") || l.includes("filter:blur("))).toEqual([]);
    expect(COMPOSER_STYLE).toContain(`${RC} .scs .menu.cm{`);
    expect(TRACKER_STYLE).toContain(`${RC} .scs .st-card::before{`);
  });

  test("Final Cut is the thin-line card for every theme and the 3px frame under RoleCall's chrome", () => {
    expect(FINAL_CUT_STYLE).toContain(".scs .fc-card{border:1px solid var(--stage-line)");
    expect(FINAL_CUT_STYLE).toContain(`${RC} .scs .fc-card{overflow:hidden;border:3px solid var(--stage-black)`);
    expect(FINAL_CUT_STYLE.split("\n").filter((l) => l.startsWith(".scs ") && l.includes("3px solid var(--stage-black)"))).toEqual([]);
  });
});
