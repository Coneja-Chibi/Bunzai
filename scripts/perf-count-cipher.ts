/**
 * Wraps a `CellCipher` to count `open()` calls by column ("table.column"), plus the bytes of the
 * sealed cell each call opened. This is the harness a later phase's open-count budget reads.
 * Wrap the cipher before it is handed to a store's constructor, not after, so no call is missed.
 *
 * Not wired into any gate yet: Phase 0 is the harness only. The gate that reads `counts()` and fails
 * on an unexpected column lands in the phase that makes it pass (R5, R6, R8, R9).
 */
import type { CellCipher } from "../src/stage/crypto/cell-cipher";

export interface CellOpenCounts {
  /** Opens and total sealed bytes read, keyed by the `where` ("table.column") each open named. */
  [where: string]: { opens: number; bytes: number };
}

export interface CountingCipher {
  /** The cipher to hand to a store's constructor in place of the real one. */
  cipher: CellCipher;
  /** A snapshot of the counts so far. Mutating the result does not affect further counting. */
  counts(): CellOpenCounts;
  /** Zeroes every count, so a caller can measure one action in isolation. */
  reset(): void;
}

export function countingCipher(inner: CellCipher): CountingCipher {
  let counts: CellOpenCounts = {};
  return {
    cipher: {
      seal: (where, text) => inner.seal(where, text),
      open: (where, cell) => {
        const entry = counts[where] ?? { opens: 0, bytes: 0 };
        entry.opens += 1;
        entry.bytes += cell.length;
        counts[where] = entry;
        return inner.open(where, cell);
      },
      index: (value) => inner.index(value),
      ready: () => inner.ready(),
    },
    counts: () => Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { ...v }])),
    reset: () => (counts = {}),
  };
}
