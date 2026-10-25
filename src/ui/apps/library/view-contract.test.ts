/**
 * versionedArtUrl: keyed by committed write identity so same-history-version autosaves invalidate art.
 */
import { describe, expect, test } from "bun:test";
import type { StudioEntitySummary } from "../../app-contract";
import { versionedArtUrl, type DeckViewContext } from "./view-contract";

const ctx = (url: string | null): DeckViewContext =>
  ({ portraitUrl: () => url } as unknown as DeckViewContext);

const piece = (over: Partial<StudioEntitySummary> = {}): StudioEntitySummary =>
  ({ id: "vera", kind: "character", name: "Vera", ...over } as StudioEntitySummary);

describe("versionedArtUrl", () => {
  test("no art means no URL at all", () => {
    expect(versionedArtUrl(ctx(null), piece())).toBeNull();
  });

  test("the committed write identity rides along as the cache selector", () => {
    const url = versionedArtUrl(ctx("/api/studio/portrait?kind=character&id=vera"), piece({ version: 3 }));
    expect(url).toBe("/api/studio/portrait?kind=character&id=vera&v=3");
  });

  test("same history version with a newer autosave receipt gets a new URL", () => {
    const before = versionedArtUrl(ctx("/api/studio/portrait?kind=character&id=vera"), piece({ version: 4, writeId: 7 }));
    const after = versionedArtUrl(ctx("/api/studio/portrait?kind=character&id=vera"), piece({ version: 4, writeId: 8 }));
    expect(before).not.toBe(after);
    expect(after).toBe("/api/studio/portrait?kind=character&id=vera&v=8");
  });

  test("a plain folder (no version kept) still gets a stable, valid URL, not a crash", () => {
    expect(versionedArtUrl(ctx("/api/studio/portrait?kind=character&id=vera"), piece())).toBe(
      "/api/studio/portrait?kind=character&id=vera&v=0",
    );
  });
});
