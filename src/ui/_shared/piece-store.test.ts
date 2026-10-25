/** Exercises lock flights and committed notice correlation at the shared summary owner. */
import { describe, expect, test } from "bun:test";
import { PieceStore } from "./piece-store";

const row = (writeId: number, revision = `r${writeId}`) => ({ kind: "persona", id: "p", name: `P${writeId}`, version: writeId, writeId, revision });
const event = (sequence: number, writeId: number, revision = `r${writeId}`) => ({ kind: "persona", id: "p", action: "upsert" as const, version: writeId, writeId, revision, sequence });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("PieceStore committed lifetime and WatchNote identity", () => {
  test("an initial flight cannot retry and seed after its lock lifetime ended", async () => {
    const pieces = new PieceStore();
    const first = deferred<{ entities: ReturnType<typeof row>[] }>();
    let reads = 0;
    const flight = pieces.loadInitial(async () => { reads++; return first.promise; }, (value) => value.entities);
    pieces.setLock("locked");
    pieces.setLock("unlocked");
    first.resolve({ entities: [row(1)] });
    const failure = await flight.then(() => null, (error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(reads).toBe(1);
    expect(pieces.isSeeded()).toBe(false);
    expect(pieces.listSnapshot()).toEqual([]);
  });

  test("an awaited stream read cannot publish into a replacement lock lifetime", async () => {
    const pieces = new PieceStore();
    pieces.seed([row(1)], 0);
    const read = deferred<ReturnType<typeof row>>();
    const pending = pieces.apply(event(1, 2), async () => read.promise);
    pieces.setLock("locked");
    pieces.setLock("unlocked");
    pieces.replace([row(3)]);
    read.resolve(row(2));
    await pending;
    expect(pieces.snapshot("persona", "p")?.writeId).toBe(3);
    expect(pieces.lastSequence()).toBe(0);
    expect(pieces.streamState().externalVersion).toBe(0);
  });

  test("SSE-first echo clears only its matching notice and duplicate identity is quiet", async () => {
    const pieces = new PieceStore();
    pieces.seed([row(1)], 0);
    await pieces.apply(event(1, 2), async () => row(2));
    expect(pieces.streamState().externalVersion).toBe(1);
    await pieces.apply(event(2, 2), async () => row(2));
    expect(pieces.streamState().externalVersion).toBe(1);
    pieces.accept(row(2));
    expect(pieces.streamState().kinds).toEqual([]);
  });

  test("HTTP-first echo is suppressed while an unrelated local receipt preserves the external notice", async () => {
    const pieces = new PieceStore();
    pieces.seed([row(1), { kind: "character", id: "c", name: "C", version: 1, writeId: 1, revision: "c1" }], 0);
    pieces.accept(row(2));
    await pieces.apply(event(1, 2), async () => row(2));
    expect(pieces.streamState().externalVersion).toBe(0);
    await pieces.apply({ ...event(2, 2), kind: "character", id: "c", revision: "c2" }, async () => ({ kind: "character", id: "c", name: "C2", version: 2, writeId: 2, revision: "c2" }));
    pieces.accept(row(3));
    expect(pieces.streamState().kinds).toEqual(["character"]);
  });

  test("same key and write number with a different committed revision is not a local echo", async () => {
    const pieces = new PieceStore();
    pieces.seed([row(1)], 0);
    pieces.accept(row(2, "local-revision"));
    await pieces.apply(event(1, 2, "external-revision"), async () => row(2, "external-revision"));
    expect(pieces.streamState().externalVersion).toBe(1);
    expect(pieces.streamState().kinds).toEqual(["persona"]);
  });

  test("failed summary reads publish no external notice", async () => {
    const pieces = new PieceStore();
    pieces.seed([row(1)], 0);
    const failure = await pieces.apply(event(1, 2), async () => { throw new Error("offline"); }).then(() => null, (error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(pieces.streamState().externalVersion).toBe(0);
    expect(pieces.lastSequence()).toBe(0);
  });
});

describe("PieceStore: the scene-trackers push", () => {
  test("the last push is kept with a counter so a repeat is seen, and subscribers hear it", () => {
    const store = new PieceStore();
    let heard = 0;
    store.subscribeList(() => { heard++; });
    expect(store.streamState().sceneTrackers).toBeNull();
    store.setSceneTrackers({ chatId: "c1", modules: [{ module: "inventory", outcome: "applied" }] });
    store.setSceneTrackers({ chatId: "c1", modules: [{ module: "inventory", outcome: "applied" }] });
    expect(store.streamState().sceneTrackers).toEqual({ chatId: "c1", modules: [{ module: "inventory", outcome: "applied" }], seq: 2 });
    expect(heard).toBe(2);
  });
});
