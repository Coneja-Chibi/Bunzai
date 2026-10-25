/** Spotify's pure half: the clock, the progress bar and where a click on it lands, device glyphs, and which art is drawn. */
import { describe, expect, test } from "bun:test";
import { deviceGlyph, formatMs, progressPct, safeArt, seekTo } from "./stage-spotify-core";

describe("the clock and the bar", () => {
  test("minutes and seconds, the percentage, and where a click lands", () => {
    expect([formatMs(0), formatMs(65_000), formatMs(3_599_000)]).toEqual(["0:00", "1:05", "59:59"]);
    expect([progressPct(50, 200), progressPct(5, 0), progressPct(500, 200)]).toEqual([25, 0, 100]);
    expect(seekTo(150, 100, 200, 200_000)).toBe(50_000);
    expect(seekTo(0, 100, 200, 200_000)).toBe(0);
    expect(seekTo(900, 100, 200, 200_000)).toBe(200_000);
  });

  test("device glyphs and art follow RoleCall", () => {
    expect([deviceGlyph("Smartphone"), deviceGlyph("Speaker"), deviceGlyph("Computer"), deviceGlyph("TV")]).toEqual(["lucide:smartphone", "lucide:speaker", "lucide:monitor", "lucide:monitor"]);
    expect([safeArt("https://x/a.jpg"), safeArt("http://x/a.jpg"), safeArt("javascript:1"), safeArt(null)]).toEqual(["https://x/a.jpg", null, null, null]);
  });
});
