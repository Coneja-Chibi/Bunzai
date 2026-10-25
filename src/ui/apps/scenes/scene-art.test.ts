/** Source-only regression fixtures for immutable snapshot and live legacy art cache identities. */
import { describe, expect, test } from "bun:test";
import { sceneArtAvailable, sceneArtIdentity, scenePortraitUrl } from "./scene-art";

describe("scene art identity", () => {
  test("frozen art is keyed by its chat snapshot, not a later live receipt", () => {
    expect(sceneArtIdentity(12, 1, "a", 3)).toBe("snapshot:12");
    expect(sceneArtIdentity(12, 9, "b", 8)).toBe("snapshot:12");
    expect(scenePortraitUrl("chat 1/2", 12)).toBe("/api/chats/portrait?id=chat%201%2F2&v=12");
  });

  test("legacy-v0 art changes identity on accepted same-version autosave receipts and library generations", () => {
    const before = sceneArtIdentity(0, 5, "same-history-version", 4);
    expect(sceneArtIdentity(0, 6, "same-history-version", 4)).not.toBe(before);
    expect(sceneArtIdentity(0, 5, "same-history-version", 5)).not.toBe(before);
  });

  test("legacy art can appear after the live piece is seeded while frozen availability stays fixed", () => {
    expect(sceneArtAvailable(0, undefined, false, false)).toBe(false);
    expect(sceneArtAvailable(0, true, true, false)).toBe(true);
    expect(sceneArtAvailable(0, false, true, true)).toBe(false);
    expect(sceneArtAvailable(12, false, true, true)).toBe(true);
    expect(sceneArtAvailable(12, true, true, false)).toBe(false);
  });
});
