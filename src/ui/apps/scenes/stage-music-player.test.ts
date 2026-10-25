/** The shared audio element, driven through a fake: play, pause, resume, stop, a refused play, volume, and release. */
import { describe, expect, test } from "bun:test";
import { FakeAudio } from "./fake-audio";
import { createMusicPlayer } from "./stage-music-player";
import type { Track } from "./stage-music-core";

const track = (n: number): Track => ({ id: `p:${n}`, packId: "p", packName: "P", itemId: String(n), title: `T${n}`, sha: n.toString(16).padStart(64, "0") });
const rig = (volume?: number) => {
  const made: FakeAudio[] = [];
  const player = createMusicPlayer(() => { const a = new FakeAudio(); made.push(a); return a; }, volume);
  return { player, made, audio: () => made.at(-1)! };
};

describe("the shared audio element", () => {
  test("it is made on the first acquire with loop on and preload none, and dropped when the last user lets go", () => {
    const { player, made, audio } = rig();
    const a = player.acquire();
    const b = player.acquire();
    expect(made).toHaveLength(1);
    expect(audio().loop).toBe(true);
    expect(audio().preload).toBe("none");
    a();
    expect(audio().listeners()).toBe(2);
    b();
    expect(audio().listeners()).toBe(0);
    b();
    player.acquire();
    expect(made).toHaveLength(2);
  });

  test("playing a track sets the asset route as the source, loops, uses the volume, and reports playing", async () => {
    const { player, audio } = rig(0.3);
    player.acquire();
    await player.play(track(1));
    expect(audio().src).toBe(`/api/asset/${track(1).sha}`);
    expect(audio().loop).toBe(true);
    expect(audio().volume).toBe(0.3);
    expect(player.get()).toMatchObject({ track: track(1), playing: true, error: null });
  });

  test("the same track is not reloaded; a different one swaps the source", async () => {
    const { player, audio } = rig();
    player.acquire();
    await player.play(track(1));
    await player.play(track(1));
    expect(audio().log.filter((l) => l === "load")).toHaveLength(1);
    await player.play(track(2));
    expect(audio().log.filter((l) => l === "load")).toHaveLength(2);
    expect(player.get().track).toEqual(track(2));
  });

  test("pause holds the track, and the same control resumes it", async () => {
    const { player, audio } = rig();
    player.acquire();
    await player.play(track(1));
    player.toggle();
    expect(player.get()).toMatchObject({ playing: false, track: track(1) });
    player.toggle();
    await Promise.resolve();
    expect(player.get().playing).toBe(true);
    expect(audio().log.filter((l) => l === "play")).toHaveLength(2);
  });

  test("a play the browser refuses shows its words and stays paused on that track", async () => {
    const { player, audio } = rig();
    player.acquire();
    audio().refuse = new Error("play() failed because the user did not interact with the document first.");
    await player.play(track(1));
    expect(player.get()).toMatchObject({ playing: false, track: track(1), error: "play() failed because the user did not interact with the document first." });
    audio().refuse = new DOMException("", "NotAllowedError");
    await player.play(track(1));
    expect(player.get().error).toBe("Browser blocked autoplay.");
    audio().refuse = null;
    await player.play(track(1));
    expect(player.get().error).toBeNull();
  });

  test("Next plays the following track of the queue the current one came from, and wraps", async () => {
    const { player } = rig();
    player.acquire();
    await player.play(track(1), [track(1), track(2)]);
    player.next();
    await Promise.resolve();
    expect(player.get().track).toEqual(track(2));
    player.next();
    await Promise.resolve();
    expect(player.get().track).toEqual(track(1));
    player.stop();
    player.next();
    expect(player.get().track).toBeNull();
  });

  test("stop clears the track and the source", async () => {
    const { player, audio } = rig();
    player.acquire();
    await player.play(track(1));
    player.stop();
    expect(player.get()).toMatchObject({ track: null, playing: false });
    expect(audio().src).toBe("");
    expect(audio().log.slice(-3)).toEqual(["pause", "remove src", "load"]);
  });

  test("volume clamps, reaches the element, and a release stops the music", async () => {
    const { player, audio } = rig();
    const release = player.acquire();
    await player.play(track(1));
    player.setVolume(5);
    expect([player.get().volume, audio().volume]).toEqual([1, 1]);
    player.setVolume(0.5);
    expect(audio().volume).toBe(0.5);
    release();
    expect(player.get()).toMatchObject({ track: null, playing: false });
  });

  test("playing with no element made says the player is not ready", async () => {
    const { player } = rig();
    await player.play(track(1));
    expect(player.get()).toMatchObject({ error: "Audio player is not ready.", track: null });
  });
});
