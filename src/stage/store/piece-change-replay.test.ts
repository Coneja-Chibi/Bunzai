/** Source regression for bounded, coalesced committed-journal replay; intentionally not run here. */
import { describe, expect, it } from "bun:test";
import type { DocumentBackend, PieceChangeEvent } from "../contracts/content-store";
import { createPieceChangeReplay } from "./piece-change-replay";

const event = (sequence: number): PieceChangeEvent => ({
  sequence, kind: "character", id: `piece-${sequence}`, version: 1, writeId: sequence,
  revision: `revision-${sequence}`, action: "upsert",
});

describe("createPieceChangeReplay", () => {
  it("coalesces concurrent requests and applies journal sequence exactly once", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const backend: Pick<DocumentBackend, "pieceChanges"> = {
      async pieceChanges(after) {
        calls++;
        if (after === 0) { await held; return { events: [event(1), event(2)], latest: 2, gap: false }; }
        return { events: [], latest: 2, gap: false };
      },
    };
    const applied: number[] = [];
    const replay = createPieceChangeReplay(backend, async (row) => { applied.push(row.sequence); }, () => undefined);
    const first = replay.replay();
    const second = replay.replay();
    release();
    await Promise.all([first, second]);
    expect(applied).toEqual([1, 2]);
    expect(replay.cursor()).toBe(2);
    expect(calls).toBeLessThanOrEqual(3);
  });

  it("invalidates at the journal's latest sequence when bounded history has a gap", async () => {
    const backend: Pick<DocumentBackend, "pieceChanges"> = {
      async pieceChanges() { return { events: [], latest: 5000, gap: true }; },
    };
    let invalidatedAt = 0;
    const replay = createPieceChangeReplay(backend, async () => undefined, (latest) => { invalidatedAt = latest; });
    await replay.replay();
    expect(invalidatedAt).toBe(5000);
    expect(replay.cursor()).toBe(5000);
  });
});
