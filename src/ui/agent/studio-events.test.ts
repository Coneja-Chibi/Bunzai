/**
 * Which filesystem noise counts as a studio change.
 *
 * The filter is the whole design. Atomic saves leave .tmp orphans, editors leave swap files, and an
 * event for each of those would have every open window re-reading the folder several times per save.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { publishSceneTrackers } from "../../studio/scene-events";
import { kindOfPath, kindsOfChange, studioEvents } from "./studio-events";
import { STUDIO_ENTITY_KINDS } from "../../studio/path-policy";
import type { LibraryHandle } from "../library-root";

describe("kindOfPath", () => {
  test("a piece in a kind folder reports its deck", () => {
    expect(kindOfPath("preset/hawthorne.json")).toBe("preset");
    expect(kindOfPath("character/ludovic-and-levi.json")).toBe("character");
  });

  test("WINDOWS BACKSLASHES ARE THE SAME PATH", () => {
    // node's watcher hands back the platform's own separator; the wire uses one spelling.
    expect(kindOfPath("preset\\hawthorne.json")).toBe("preset");
  });

  test("A DOTFILE IS AN ARTIFACT, NOT SOMEBODY'S WORK", () => {
    /**
     * Atomic replacement writes `.hawthorne.json.tmp` and renames it. Announcing that would fire a
     * reload for the intermediate state of every single save, on top of the real one.
     */
    expect(kindOfPath("preset/.hawthorne.json.tmp")).toBeNull();
    expect(kindOfPath("preset/.DS_Store")).toBeNull();
  });

  test("anything that is not json is ignored", () => {
    expect(kindOfPath("preset/notes.txt")).toBeNull();
    expect(kindOfPath("character/portrait.png")).toBeNull();
  });

  test("a loose file at the top of the studio belongs to no deck", () => {
    expect(kindOfPath("settings.json")).toBeNull();
    expect(kindOfPath("")).toBeNull();
  });

  test("a deeper path still reports its deck", () => {
    // Recursive watching reports nested paths; the deck is still the first segment.
    expect(kindOfPath("preset/sub/thing.json")).toBe("preset");
  });
});

describe("kindsOfChange", () => {
  test("a write to the encrypted library names every deck, since the file cannot say which changed", () => {
    expect(kindsOfChange("library.db-wal")).toEqual([...STUDIO_ENTITY_KINDS]);
    expect(kindsOfChange("library.db")).toEqual([...STUDIO_ENTITY_KINDS]);
  });
  test("a plain file names its own deck, and anything else names none", () => {
    expect(kindsOfChange("preset/hawthorne.json")).toEqual(["preset"]);
    expect(kindsOfChange("library.db-shm")).toEqual([]);
    expect(kindsOfChange("notes.txt")).toEqual([]);
  });
});

/**
 * The library's lock/unlock push: locking writes nothing to disk,
 * so the folder watcher above can never see it. A fake LibraryHandle stands in for the real one -
 * only `onLockChange` matters here, so it is the only method given a body.
 */
describe("studioEvents: the lock/unlock push", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

  const dir = (): string => {
    const d = mkdtempSync(join(tmpdir(), "bunraku-studio-events-"));
    dirs.push(d);
    return d;
  };

  const fakeLibrary = (): { library: LibraryHandle; fire: (s: "locked" | "unlocked") => void; restored: () => void } => {
    const listeners = new Set<(s: "locked" | "unlocked") => void>();
    const restores = new Set<() => void>();
    const library = {
      onLockChange: (cb: (s: "locked" | "unlocked") => void) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      onRestore: (cb: () => void) => {
        restores.add(cb);
        return () => restores.delete(cb);
      },
    } as unknown as LibraryHandle;
    return { library, fire: (s) => { for (const cb of listeners) cb(s); }, restored: () => { for (const cb of restores) cb(); } };
  };

  /** Reads SSE frames off the response as `{event, data}` pairs, by event name only (data is `{}`). */
  async function readFrames(res: Response, count: number): Promise<string[]> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const events: string[] = [];
    while (events.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, at);
        buf = buf.slice(at + 2);
        const m = /^event: (.+)$/m.exec(frame);
        if (m) events.push(m[1]!);
      }
    }
    await reader.cancel();
    return events;
  }

  test("a lock or unlock the handle announces is pushed as its own event", async () => {
    const controller = new AbortController();
    const { library, fire } = fakeLibrary();
    const res = studioEvents(dir(), controller.signal, library);
    const framesPromise = readFrames(res, 3); // ready, lock, unlock
    // Give the stream's start() a tick to attach the listener before firing.
    await Bun.sleep(20);
    fire("locked");
    fire("unlocked");
    expect(await framesPromise).toEqual(["ready", "lock", "unlock"]);
    controller.abort();
  });

  test("a scene's trackers changing is pushed as its own event with the chat and what became of each tracker, to a stream with or without a library, and not after it closes", async () => {
    const controller = new AbortController();
    const res = studioEvents(dir(), controller.signal);
    const body = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    const until = async (needle: string): Promise<void> => { while (!text.includes(needle)) { const { value, done } = await body.read(); if (done) return; text += decoder.decode(value, { stream: true }); } };
    await until("event: ready");
    publishSceneTrackers({ chatId: "chat-1", modules: [{ module: "inventory", outcome: "applied" }] });
    await until("scene-trackers");
    await until("applied");
    expect(text).toContain('event: scene-trackers\ndata: {"chatId":"chat-1","modules":[{"module":"inventory","outcome":"applied"}]}');
    controller.abort();
    await body.cancel().catch(() => undefined);
    expect(() => publishSceneTrackers({ chatId: "chat-1", modules: [] })).not.toThrow();
  });

  test("a restore is pushed as its own event, so every open page reloads", async () => {
    const controller = new AbortController();
    const { library, restored } = fakeLibrary();
    const res = studioEvents(dir(), controller.signal, library);
    const framesPromise = readFrames(res, 2); // ready, restored
    await Bun.sleep(20);
    restored();
    expect(await framesPromise).toEqual(["ready", "restored"]);
    controller.abort();
  });

  test("unsubscribes on shutdown: a fire after the stream closes reaches no one", async () => {
    const controller = new AbortController();
    const { library, fire } = fakeLibrary();
    const res = studioEvents(dir(), controller.signal, library);
    const reader = res.body!.getReader();
    await reader.read(); // "ready"
    controller.abort();
    await Bun.sleep(10);
    // Nothing should throw, and nothing is listening any more; this is the absence-of-a-crash proof.
    expect(() => fire("locked")).not.toThrow();
    await reader.cancel();
  });
});
