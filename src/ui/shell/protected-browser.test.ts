/**
 * The protected layer in a real browser: layout, the top layer and the cascade cannot be modelled, so this launches headless
 * Chrome on a harness page (the real tokens.css and the real apply pipeline, bundled) with hostile mods on it.
 * It needs Chrome (set CHROME_PATH if it is elsewhere) and is skipped without it; the unit tests carry the same rules on a model.
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "bun:test";
import { hasChrome, measure } from "../../../scripts/mod-top-layer/run";

type Box = { w: number; h: number };
interface Seen { plain: Box; prot: Box; fill: string; spacing: string; shadow: string; plainFill: string; plainSpacing: string; modOn: boolean; broken: string[] }
let r: { continuity: { before: number; after: number; color: string; colorAfter: string; transitionBefore: number; transitionAfter: number; extraScans: number; modOn: boolean; broken: unknown[] }; font: Record<string, Seen>; cover: { top: boolean; inside: string; control: string; modOn: boolean; broken: string[] }; small: { modOn: boolean; broken: string[] }; cost: { elements: number; fullMs: number; cheapMs: number; quietScansIn6500ms: number; modOn: boolean } };

beforeAll(async () => { if (hasChrome()) r = (await measure(join(tmpdir(), "bunzai-top-layer-proof"), 9591 + Number(process.env.THEME_MEASURE_PORT_OFFSET ?? 0))) as typeof r; }, 120_000);
const chrome = test.skipIf(!hasChrome());

describe("protected prompts under hostile mod CSS, in headless Chrome", () => {
  for (const name of ["html font-size 400%", "html zoom 4", "body zoom 3"]) {
    chrome(`${name}: protected text keeps its rendered size while ordinary text grows`, () => {
      const base = r.font.base!, seen = r.font[name]!;
      expect(seen.modOn, "the mod must still be on or this proves nothing").toBe(true);
      expect(seen.plain.h, "control: the hostile CSS really scaled ordinary text").toBeGreaterThan(base.plain.h * 2);
      expect(seen.prot).toEqual(base.prot);
    });
  }

  chrome("html{font-size:1px} is caught as an offense (the mod is dropped) and protected text is still the same size", () => {
    const seen = r.font["html font-size 1px"]!;
    expect(seen.broken).toContain("font-size");
    expect(seen.prot).toEqual(r.font.base!.prot);
  });

  chrome("inherited text-fill, letter-spacing and shadow set on body do not reach protected text", () => {
    const base = r.font.base!, seen = r.font["text smear"]!;
    expect(seen.modOn).toBe(true);
    expect(seen.plainFill, "control: the hostile CSS really blanked ordinary text").not.toBe(base.plainFill);
    expect(seen.plainSpacing).not.toBe("normal");
    expect([seen.fill, seen.spacing, seen.shadow]).toEqual([base.fill, "normal", "none"]);
  });

  chrome("a full-screen fixed overlay with the largest z-index cannot cover a modal prompt", () => {
    expect(r.cover.control, "control: with the prompt closed the overlay is what a click hits").toBe("veil");
    expect(r.cover.top).toBe(true);
    expect(r.cover.inside).toBe("inner");
    expect(r.cover.modOn).toBe(true);
    expect(r.cover.broken).toEqual([]);
  });

  chrome("a small overlay over the inline manager trips the watchdog and drops the mod", () => {
    expect(r.small.broken).toContain("overlay-over");
    expect(r.small.modOn).toBe(false);
  });

  chrome("a host-hidden control leaves theme CSS on and baseline sampling preserves animation and color", () => {
    expect(r.continuity.modOn).toBe(true);
    expect(r.continuity.broken).toEqual([]);
    expect(r.continuity.before).toBe(4000);
    expect(r.continuity.after).toBeGreaterThanOrEqual(4000);
    expect(r.continuity.colorAfter).toBe(r.continuity.color);
    expect(r.continuity.transitionBefore).toBe(4000);
    expect(r.continuity.transitionAfter).toBeGreaterThanOrEqual(4000);
    expect(r.continuity.extraScans).toBeLessThanOrEqual(1);
  });

  chrome("on a 7,500 element page a quiet 6.5 s runs no element scan, and a mod that does nothing wrong stays on", () => {
    expect(r.cost.elements).toBeGreaterThan(7000);
    expect(r.cost.quietScansIn6500ms).toBe(0);
    expect(r.cost.modOn).toBe(true);
    console.log(`full scan ${r.cost.fullMs.toFixed(0)} ms, cheap checks ${r.cost.cheapMs.toFixed(2)} ms on ${r.cost.elements} elements`);
  });
});
