/** Proof for the counting cipher: it counts opens and bytes by column, and `reset` zeroes them. */
import { describe, expect, test } from "bun:test";
import { countingCipher } from "./perf-count-cipher";
import type { CellCipher } from "../src/stage/crypto/cell-cipher";

function fakeCellCipher(): CellCipher {
  return {
    seal: (where, text) => `sealed(${where}):${text}`,
    open: (where, cell) => cell.replace(`sealed(${where}):`, ""),
    index: (value) => `hash:${value}`,
    ready: () => {},
  };
}

describe("countingCipher", () => {
  test("counts opens and bytes by column, not by call site", () => {
    const counting = countingCipher(fakeCellCipher());
    const a = counting.cipher.seal("documents.body_json", "x".repeat(10));
    const b = counting.cipher.seal("chats.cast_snapshot_json", "y".repeat(20));
    counting.cipher.open("documents.body_json", a);
    counting.cipher.open("documents.body_json", a);
    counting.cipher.open("chats.cast_snapshot_json", b);

    const counts = counting.counts();
    expect(counts["documents.body_json"]).toEqual({ opens: 2, bytes: a.length * 2 });
    expect(counts["chats.cast_snapshot_json"]).toEqual({ opens: 1, bytes: b.length });
    // A column never opened is absent, not zero: a gate checking "opens zero" must not need this key.
    expect(counts["chats.previous_snapshot_json"]).toBeUndefined();
  });

  test("reset zeroes every count", () => {
    const counting = countingCipher(fakeCellCipher());
    counting.cipher.open("documents.body_json", counting.cipher.seal("documents.body_json", "x"));
    expect(counting.counts()["documents.body_json"]?.opens).toBe(1);
    counting.reset();
    expect(counting.counts()).toEqual({});
  });

  test("seal, index and ready pass through to the wrapped cipher unmodified", () => {
    const counting = countingCipher(fakeCellCipher());
    expect(counting.cipher.seal("t.c", "hi")).toBe("sealed(t.c):hi");
    expect(counting.cipher.index("hi")).toBe("hash:hi");
    expect(() => counting.cipher.ready()).not.toThrow();
  });

  test("a snapshot from counts() does not change when more opens happen after it", () => {
    const counting = countingCipher(fakeCellCipher());
    const cell = counting.cipher.seal("documents.body_json", "x");
    counting.cipher.open("documents.body_json", cell);
    const snapshot = counting.counts();
    counting.cipher.open("documents.body_json", cell);
    expect(snapshot["documents.body_json"]?.opens).toBe(1);
    expect(counting.counts()["documents.body_json"]?.opens).toBe(2);
  });
});
