/** Mood Music's pure half: which pack items are tracks, Next within a pack, the volume clamp. */
import { describe, expect, test } from "bun:test";
import { DEFAULT_VOLUME, groupOf, isSound, nextOf, sourceOf, volumeOf } from "./stage-music-core";
import type { BackdropPack } from "./scene-backdrop-core";

const sha = (n: number): string => n.toString(16).padStart(64, "0");
const ref = (mime: string, n: number): string => `\u0000b:u:${mime}:${sha(n)}`;
const pack = (id: string, items: { id: string; label: string; ref: string; mime?: string }[]): BackdropPack => ({ id, name: `Pack ${id}`, items });

describe("tracks", () => {
  test("a pack item is a track when its media type is audio, by the item or by its ref", () => {
    expect(isSound({ id: "a", label: "A", ref: ref("audio/mpeg", 1), mime: "audio/mpeg" })).toBe(true);
    expect(isSound({ id: "a", label: "A", ref: ref("audio/ogg", 1) })).toBe(true);
    expect(isSound({ id: "b", label: "B", ref: ref("image/png", 2), mime: "image/png" })).toBe(false);
    expect(isSound({ id: "c", label: "C", ref: ref("video/mp4", 3) })).toBe(false);
  });

  test("a group lists only the sounds a pack stores, and a pack with none is no group", () => {
    const g = groupOf(pack("p", [
      { id: "a", label: "Tavern", ref: ref("audio/mpeg", 1) },
      { id: "b", label: "Face", ref: ref("image/png", 2) },
      { id: "c", label: "Inline", ref: "data:audio/mpeg;base64,AAAA", mime: "audio/mpeg" },
    ]));
    expect(g?.tracks.map((t) => [t.id, t.title, t.sha])).toEqual([["p:a", "Tavern", sha(1)]]);
    expect(groupOf(pack("q", [{ id: "b", label: "Face", ref: ref("image/png", 2) }]))).toBeNull();
  });

  test("Next walks the current pack and wraps; a track whose pack lost it has no next", () => {
    const g = groupOf(pack("p", [{ id: "a", label: "A", ref: ref("audio/mpeg", 1) }, { id: "b", label: "B", ref: ref("audio/mpeg", 2) }]))!;
    const other = groupOf(pack("o", [{ id: "z", label: "Z", ref: ref("audio/mpeg", 9) }]))!;
    const a = g.tracks[0]!;
    const b = g.tracks[1]!;
    expect(nextOf(g.tracks, a)?.id).toBe("p:b");
    expect(nextOf(g.tracks, b)?.id).toBe("p:a");
    expect(nextOf(other.tracks, a)).toBeNull();
    expect(nextOf([], a)).toBeNull();
  });

  test("a track plays from the asset route on the page's own origin", () => {
    expect(sourceOf(groupOf(pack("p", [{ id: "a", label: "A", ref: ref("audio/mpeg", 1) }]))!.tracks[0]!)).toBe(`/api/asset/${sha(1)}`);
  });
});

test("volume clamps to 0 to 1 and an unset or broken pref is 0.6", () => {
  expect([volumeOf(0.25), volumeOf(7), volumeOf(-1)]).toEqual([0.25, 1, 0]);
  expect([volumeOf(undefined), volumeOf("x"), volumeOf(Number.NaN)]).toEqual([DEFAULT_VOLUME, DEFAULT_VOLUME, DEFAULT_VOLUME]);
});

describe("play on scene open", () => {
  test("autoplay is on only when set true", async () => {
    const { autoplayOn } = await import("./stage-music-core");
    expect([autoplayOn(undefined), autoplayOn("true"), autoplayOn(1), autoplayOn(false), autoplayOn(true)]).toEqual([false, false, false, false, true]);
  });
  test("a saved track reference is parsed strictly and found by pack and item ids", async () => {
    const { lastTrackOf, findTrack } = await import("./stage-music-core");
    expect(lastTrackOf(null)).toBeNull();
    expect(lastTrackOf({ packId: "p" })).toBeNull();
    expect(lastTrackOf({ packId: "", itemId: "i" })).toBeNull();
    const ref = lastTrackOf({ packId: "p", itemId: "i" });
    expect(ref).toEqual({ packId: "p", itemId: "i" });
    const track = { id: "p:i", packId: "p", packName: "P", itemId: "i", title: "T", sha: "s" };
    const groups = [{ packId: "p", name: "P", tracks: [track] }];
    expect(findTrack(groups, ref!)?.track).toBe(track);
    expect(findTrack(groups, { packId: "p", itemId: "gone" })).toBeNull();
    expect(findTrack(groups, { packId: "other", itemId: "i" })).toBeNull();
  });
});
