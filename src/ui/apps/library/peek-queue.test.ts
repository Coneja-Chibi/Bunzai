/**
 * The peek queue's two promises: it never runs more than three reads at once, and it never
 * remembers a failure (a lock mid-read must not leave a card blank after unlocking).
 */
import { describe, expect, test } from "bun:test";
import { createPeekQueue } from "./peek-queue";
import type { PiecePeek } from "./view-contract";

const piece = (id: string, writeId = 0) => ({ kind: "lorebook", id, name: id, writeId, version: writeId, revision: `r${writeId}` });

describe("createPeekQueue", () => {
  test("at most three reads run at once; the rest wait their turn and all finish", async () => {
    let running = 0;
    let peak = 0;
    const gates: (() => void)[] = [];
    const queue = createPeekQueue(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise<void>((go) => gates.push(go));
      running -= 1;
      return { tokens: 1 };
    });

    const all = Promise.all(["a", "b", "c", "d", "e"].map((id) => queue.request(piece(id))));
    // Let every request reach its gate or its wait.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(gates).toHaveLength(3);

    while (gates.length > 0) {
      gates.shift()?.();
      for (let i = 0; i < 10; i++) await Promise.resolve();
    }
    expect(await all).toHaveLength(5);
    expect(peak).toBe(3);
  });

  test("a success is cached; the same piece is read once", async () => {
    let reads = 0;
    const queue = createPeekQueue(() => {
      reads += 1;
      return Promise.resolve({ tokens: 7 } satisfies PiecePeek);
    });

    await queue.request(piece("a"));
    await queue.request(piece("a"));
    expect(reads).toBe(1);
    expect(queue.cached(piece("a"))).toEqual({ tokens: 7 });
  });

  test("a failure is forgotten, so the next ask reads again", async () => {
    let reads = 0;
    const queue = createPeekQueue(() => {
      reads += 1;
      return Promise.resolve(reads === 1 ? null : { tokens: 2 });
    });

    expect(await queue.request(piece("a"))).toBeNull();
    expect(queue.cached(piece("a"))).toBeUndefined();
    expect(await queue.request(piece("a"))).toEqual({ tokens: 2 });
    expect(reads).toBe(2);
  });

  test("a newer receipt invalidates an older peek and an older in-flight result cannot replace it", async () => {
    const gates = new Map<number, (value: PiecePeek | null) => void>();
    const queue = createPeekQueue((e) => new Promise((resolve) => gates.set(e.writeId ?? 0, resolve)));
    queue.reset(1);
    const oldRead = queue.request(piece("a", 1));
    await Promise.resolve();
    const newPiece = piece("a", 2);
    expect(queue.cached(newPiece)).toBeUndefined();
    const newRead = queue.request(newPiece);
    await Promise.resolve();

    gates.get(2)!({ tokens: 2 });
    expect(await newRead).toEqual({ tokens: 2 });
    expect(queue.cached(newPiece)).toEqual({ tokens: 2 });
    gates.get(1)!({ tokens: 1 });
    expect(await oldRead).toBeNull();
    expect(queue.cached(newPiece)).toEqual({ tokens: 2 });
  });

  test("a stale read waiting for a slot is discarded before it starts", async () => {
    const gates: (() => void)[] = [];
    const reads: string[] = [];
    const queue = createPeekQueue(async (e) => {
      reads.push(`${e.id}:${e.writeId}`);
      await new Promise<void>((resolve) => gates.push(resolve));
      return { tokens: e.writeId };
    });
    const blockers = ["b", "c", "d"].map((id) => queue.request(piece(id)));
    await Promise.resolve();
    const oldRead = queue.request(piece("a", 1));
    const newPiece = piece("a", 2);
    queue.cached(newPiece);
    const newRead = queue.request(newPiece);
    expect(reads).toEqual(["b:0", "c:0", "d:0"]);

    gates.shift()!();
    await Promise.resolve();
    await Promise.resolve();
    expect(await oldRead).toBeNull();
    expect(reads).toContain("a:2");
    while (gates.length) { gates.shift()!(); await Promise.resolve(); await Promise.resolve(); }
    await Promise.all(blockers);
    expect(await newRead).toEqual({ tokens: 2 });
  });

  test("a library lifetime reset rejects late reads and clears cached peeks", async () => {
    const gates: ((value: PiecePeek | null) => void)[] = [];
    const queue = createPeekQueue(() => new Promise((resolve) => gates.push(resolve)));
    queue.reset(1);
    const oldRead = queue.request(piece("a", 1));
    await Promise.resolve();
    queue.reset(2);
    const newRead = queue.request(piece("a", 1));
    await Promise.resolve();

    gates[0]!({ tokens: 1 });
    expect(await oldRead).toBeNull();
    expect(queue.cached(piece("a", 1))).toBeUndefined();
    gates[1]!({ tokens: 2 });
    expect(await newRead).toEqual({ tokens: 2 });
    expect(queue.cached(piece("a", 1))).toEqual({ tokens: 2 });
  });

  test("a stale listing cannot evict or request over the PieceStore's current identity", async () => {
    let latest = piece("a", 2);
    let reads = 0;
    const queue = createPeekQueue(async () => { reads++; return { tokens: 2 }; }, (e) => e.writeId === latest.writeId);
    queue.reset(1);
    await queue.request(latest);
    expect(queue.cached(piece("a", 1))).toBeUndefined();
    expect(queue.cached(latest)).toEqual({ tokens: 2 });
    expect(await queue.request(piece("a", 1))).toBeNull();
    expect(reads).toBe(1);
  });

  test("an inactive queue rejects work after its owner unmounts", async () => {
    let reads = 0;
    const queue = createPeekQueue(async () => { reads++; return { tokens: 1 }; });
    await queue.request(piece("a", 1));
    queue.reset(null);
    expect(queue.cached(piece("a", 1))).toBeUndefined();
    expect(await queue.request(piece("a", 1))).toBeNull();
    expect(reads).toBe(1);
  });
});
