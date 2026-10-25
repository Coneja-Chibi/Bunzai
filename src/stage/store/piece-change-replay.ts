/** Serializes bounded journal replay for derived owners that follow committed document changes. */
import type { DocumentBackend, PieceChangeEvent } from "../contracts/content-store";

export interface PieceChangeReplay {
  replay(): Promise<void>;
  close(): void;
  cursor(): number;
}

/** One replay promise coalesces callers; cursor advances only after an event is consumed. */
export function createPieceChangeReplay(
  backend: Pick<DocumentBackend, "pieceChanges">,
  apply: (event: PieceChangeEvent) => Promise<void>,
  onGap: (latest: number) => void | Promise<void>,
): PieceChangeReplay {
  let cursor = 0;
  let pending: Promise<void> | null = null;
  let requested = false;
  let closed = false;

  const pass = async (): Promise<void> => {
    for (;;) {
      if (closed) return;
      const batch = await backend.pieceChanges(cursor, 256);
      if (batch.gap) {
        await onGap(batch.latest);
        cursor = batch.latest;
        return;
      }
      for (const event of batch.events) {
        if (closed) return;
        if (event.sequence !== cursor + 1) throw new Error("piece-change journal sequence has a gap");
        await apply(event);
        cursor = event.sequence;
      }
      if (batch.events.length === 0) return;
    }
  };

  const start = (): Promise<void> => {
    if (!pending) {
      pending = (async () => {
        do {
          requested = false;
          await pass();
        } while (requested && !closed);
      })().finally(() => { pending = null; });
    }
    return pending.then(() => requested && !closed ? start() : undefined);
  };

  return {
    replay() {
      if (closed) return Promise.reject(new Error("piece-change replay is closed"));
      requested = true;
      return start();
    },
    close() { closed = true; },
    cursor: () => cursor,
  };
}
