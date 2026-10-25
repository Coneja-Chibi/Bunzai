/**
 * The scene's variants (scene.layout, .message, .composer, .swipes, .wings, .hud, .reasoning): every registered variant has a
 * stylesheet, every stylesheet is scoped to its own root attribute and stays square, colorless and complete (no
 * control hidden), and the markup variants (the version dots, the labelled wings) keep every control present under
 * every variant a theme can pick. The readout and composer are proved inside the full page (scene-page-render.test.tsx).
 */
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SURFACES, surfaceAttribute, type SurfaceId } from "../../../extensions/surface-registry";
import { variantCssProblems } from "../../_shared/variant-css-check";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { MetaRow } from "./scene-meta";
import { WingRails, WINGS } from "./scene-wings";
import { HARE_STYLE } from "./props/trackhare/hare-style";
import { TOKENS_STYLE } from "./props/trackhare/tokens-style";
import { LORE_STYLE } from "./lore-style";
import { PRESET_STYLE } from "./preset-style";
import { PROMPTING_STYLE } from "./prompting-style";
import { SCENE_STYLE } from "./scene-style";
import { TOOLS_STYLE } from "./tools-style";
import { TURN_STYLE } from "./scene-turn-style";
import { REASONING_STYLE } from "./scene-reasoning-style";
import { SCENE_VARIANTS_STYLE } from "./variants-style";

const SCENE_SURFACES = ["scene.layout", "scene.message", "scene.composer", "scene.swipes", "scene.wings", "scene.hud", "scene.reasoning"] as const satisfies readonly SurfaceId[];
const dir = new URL("./variants/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

describe("variant stylesheets", () => {
  test("every registered variant of the seven scene surfaces has its stylesheet", () => {
    for (const surface of SCENE_SURFACES) for (const variant of SURFACES[surface]) expect(existsSync(`${dir}${surface}/${variant}.ts`), `${surface}/${variant}`).toBe(true);
  });

  test("every rule is scoped to its variant root, square, colorless, focus-safe, and hides no control", () => {
    const kept = /\.(acts|meta|swc|rail|wi|cap|dockbar|scroll|paused-mark|send|stop|hint|branch|back)$/;
    expect(variantCssProblems(SCENE_VARIANTS_STYLE, /^html\[data-surface-scene-[a-z]+="[a-z-]+"\] \.scs/, kept)).toEqual([]);
  });
});

describe("scene.message bubble hover actions", () => {
  const rule = (sel: string): string => SCENE_VARIANTS_STYLE.split(String.fromCharCode(10)).find((r) => r.includes("html[data-surface-scene-message=\"bubble\"]") && r.includes(sel)) ?? "";
  test("the action bar clears the speaker name: a minimum bubble width, a truncating name, and the user bar on the other side", () => {
    expect(rule(".bub{min-width:")).toContain("min-width:min(21rem,70cqi)");
    expect(rule(".spk{max-width:")).toContain("text-overflow:ellipsis");
    expect(rule(".msg.user .acts{")).toContain("left:.4rem");
  });
});

describe("the scene base styles", () => {
  test("corners are square everywhere except the status dots", () => {
    const round: string[] = [];
    for (const [name, css] of Object.entries({ SCENE_STYLE, TURN_STYLE, REASONING_STYLE, TOOLS_STYLE, PRESET_STYLE, PROMPTING_STYLE, LORE_STYLE, HARE_STYLE, TOKENS_STYLE })) {
      for (const rule of css.split("}")) {
        const [selector, body] = rule.split("{");
        if (body !== undefined && /border-radius:\s*(?!0[;}\s]|0$|var\(--rc-radius)/.test(body) && !/\.(dot|bd|ov)\b/.test(selector!)) round.push(`${name}: ${selector!.trim()}`);
      }
    }
    expect(round).toEqual([]);
  });
});

let installed: InstalledDom;
let host: HTMLElement | null = null;
let tree: Root | null = null;
beforeAll(() => {
  installed = installDom("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8326/", extraGlobals: ["SVGElement", "MutationObserver", "HTMLTextAreaElement"], globals: { IS_REACT_ACT_ENVIRONMENT: true } });
});
afterAll(() => installed.teardown());
/** Unmount whatever is mounted; safe to call twice. */
async function cleanup(): Promise<void> {
  const mounted = tree;
  tree = null;
  await act(async () => { mounted?.unmount(); });
  host?.remove();
  host = null;
}
afterEach(async () => {
  await cleanup();
  for (const surface of SCENE_SURFACES) document.documentElement.removeAttribute(surfaceAttribute(surface));
});

async function show(element: ReturnType<typeof createElement>, picks: Partial<Record<SurfaceId, string>> = {}): Promise<HTMLElement> {
  await cleanup();
  for (const [surface, variant] of Object.entries(picks)) document.documentElement.setAttribute(surfaceAttribute(surface as SurfaceId), variant);
  const mount = document.createElement("div");
  document.body.append(mount);
  const root = createRoot(mount);
  host = mount;
  tree = root;
  await act(async () => { root.render(element); });
  return mount;
}
const labels = (el: HTMLElement): string[] => [...el.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");

describe("scene.swipes version controls", () => {
  const picked: number[] = [];
  const meta = (): ReturnType<typeof createElement> => createElement(MetaRow, { versions: { index: 1, count: 3, isNew: false, busy: false, onPrev: () => undefined, onNext: () => undefined, onRegenerate: () => undefined, onGo: (i: number) => picked.push(i) } });
  for (const variant of SURFACES["scene.swipes"]) {
    test(`${variant} keeps previous, next and the 2 / 3 count`, async () => {
      const el = await show(meta(), { "scene.swipes": variant });
      expect(labels(el)).toContain("Previous version");
      expect(labels(el)).toContain("Next version");
      expect(el.querySelector(".ct")?.textContent).toContain("2");
      expect(el.querySelector(".ct")?.textContent).toContain("3");
    });
  }
  test("dots adds one pip per version that jumps to it; no other variant draws them", async () => {
    const el = await show(meta(), { "scene.swipes": "dots" });
    expect(labels(el).filter((l) => l.startsWith("Version "))).toEqual(["Version 1", "Version 2", "Version 3"]);
    await act(async () => { (el.querySelector('[aria-label="Version 3"]') as HTMLElement).click(); });
    expect(picked).toEqual([2]);
    expect((await show(meta(), { "scene.swipes": "key-chips" })).querySelector(".vdots")).toBeNull();
  });
});

describe("scene.wings rails", () => {
  for (const variant of SURFACES["scene.wings"]) {
    test(`${variant} opens every wing by its name, with its blurb and a visible label`, async () => {
      const el = await show(createElement(WingRails, { open: null, onToggle: () => undefined }), { "scene.wings": variant });
      expect(labels(el)).toEqual(WINGS.map((w) => w.label));
      for (const w of WINGS) {
        const button = el.querySelector(`[aria-label="${w.label}"]`)!;
        expect(button.getAttribute("title")).toBe(w.blurb);
        expect(button.querySelector(".lbl")?.textContent).toBe(w.label);
      }
    });
  }
});
