/** The Stage look's stylesheet: every flag and variable the root can carry is read, a setting outranks a theme variant, and the rules that need to know a layout's shape cover every layout. */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SCENE_STYLE } from "./scene-style";
import { SCENE_VARIANTS_STYLE } from "./variants-style";
import { STAGE_LOOK_STYLE } from "./stage-look-style";
import { LOOK_DEFAULTS, lookRoot, type StageLook } from "./stage-look-core";

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));
/** Every setting away from its default at once. */
const EVERYTHING: StageLook = { ...LOOK_DEFAULTS, chatTheme: "immersive", opacity: 0.5, gap: 8, avatars: false, size: 20, font: "serif", colorChar: "#111111", colorUser: "#222222", colorDialogue: "#333333", lineHeight: 2, fadeIn: false, compact: true, collapse: true, collapseStyle: "segmented", labels: false };
const root = lookRoot(EVERYTHING);

describe("what the scene root carries is read by a rule", () => {
  test("every data-look flag has a rule in the look stylesheet, except opacity, which the bubble paint reads", () => {
    for (const flag of root.attrs["data-look"].split(" ").filter((f) => f !== "opacity")) expect(STAGE_LOOK_STYLE).toContain(`[data-look~="${flag}"]`);
  });
  test("every variable it paints is read somewhere", () => {
    const sources = STAGE_LOOK_STYLE + SCENE_STYLE + SCENE_VARIANTS_STYLE;
    for (const name of Object.keys(root.style ?? {})) expect(sources).toContain(`var(${name}`);
  });
  test("the chat theme flags have rules for the two themes that change the chrome", () => {
    expect(STAGE_LOOK_STYLE).toContain('[data-chat-theme="basic"]');
    expect(STAGE_LOOK_STYLE).toContain('[data-chat-theme="immersive"]');
  });
});

describe("a setting outranks a theme variant", () => {
  test("every look rule is as specific as a variant rule (html + root + attribute) and the sheet comes after the variants", () => {
    const selectors = STAGE_LOOK_STYLE.split("\n").filter((l) => /^html \.scs/.test(l));
    expect(selectors.length).toBeGreaterThan(15);
    const index = readFileSync(here("./index.tsx"), "utf8");
    expect(index.indexOf("STAGE_LOOK_STYLE +")).toBeGreaterThan(index.indexOf("SCENE_VARIANTS_STYLE +"));
  });
  test("a variant that sets the prose font is overridden by size, line height and face on the same selector shape", () => {
    expect(SCENE_VARIANTS_STYLE).toContain('html[data-surface-scene-message="bubble"] .scs .prose{font:');
    for (const prop of ["font-size:var(--bk-msg-size)", "line-height:var(--bk-msg-lh)", "font-family:var(--bk-msg-font)"]) expect(STAGE_LOOK_STYLE).toContain(prop);
  });
});

describe("bubble opacity and density", () => {
  test("the core bubble and the two boxed variants paint through the clamped see-through share", () => {
    for (const css of [readFileSync(here("./scene-style.ts"), "utf8"), readFileSync(here("./variants/scene.message/bubble.ts"), "utf8"), readFileSync(here("./variants/scene.message/vn-box.ts"), "utf8")]) {
      expect(css).toContain("seeThrough(");
    }
    const { seeThrough } = require("./bubble-opacity") as typeof import("./bubble-opacity");
    expect(seeThrough("var(--x)", 55)).toBe("color-mix(in srgb,var(--x) clamp(0%,calc(55%*var(--bk-msg-opacity,1)),100%),transparent)");
  });
  test("compact lowers the density the messages already scale by, including the core message gap", () => {
    expect(SCENE_STYLE).toContain("margin-bottom:calc(40px*var(--bk-density,1))");
    expect(STAGE_LOOK_STYLE).toContain('[data-look~="compact"]{--bk-density:.7}');
  });
});

describe("Show Avatars off", () => {
  test("it undoes every way a layout makes room for the portrait", () => {
    const off = STAGE_LOOK_STYLE.split("\n").filter((l) => l.includes('"noavatar"')).join("\n");
    for (const file of readdirSync(here("./variants/scene.layout/"))) {
      const css = readFileSync(here(`./variants/scene.layout/${file}`), "utf8");
      const msg = [...css.matchAll(/\.msg\{([^}]*)\}/g)].map((m) => m[1]!).join(";");
      if (msg.includes("grid-template-columns")) expect(off).toContain("grid-template-columns");
      if (/padding(-left)?:[^;]*rem/.test(msg) && /padding(-left)?:(0 0 [^;]*|[^;]*) /.test(msg + " ")) expect(off).toContain("padding-left:0");
    }
    expect(off).toContain(".por{display:none}");
  });
});
