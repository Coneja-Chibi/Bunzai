/**
 * The memory ChatStore's persona counters. The store calls the
 * three mutators inside the same synchronous step as the write they count, so they never drift; there
 * is nothing to backfill because every scene here was counted when it was made.
 */
import type { ChatStore } from "../../contracts/chat-store";
import { dayOf, emptyStats, readStats, withDays, type StatsRow } from "../persona-stats-rules";

export interface StatsCounters {
  /** Scenes now playing `personaId` change by `delta`. */
  scenes(personaId: string | undefined, delta: 1 | -1): void;
  /** `count` user messages written under `personaId`, on today's day unless `days` names the days they were written. */
  messages(personaId: string | undefined, count: number, days?: number[]): void;
  api: Pick<ChatStore, "personaStats" | "backfillPersonaStats">;
}

export function statsCounters(clock: () => number): StatsCounters {
  const rows = new Map<string, StatsRow>();
  const row = (id: string): StatsRow => {
    let r = rows.get(id);
    if (!r) rows.set(id, (r = emptyStats()));
    return r;
  };
  return {
    scenes(id, delta) {
      if (id) row(id).scenes += delta;
    },
    messages(id, count, days) {
      if (!id || count === 0) return;
      const r = row(id);
      r.messages += count;
      r.days = withDays(r.days, days ?? [dayOf(clock())]);
    },
    api: {
      async personaStats(personaId) {
        return readStats(rows.get(personaId), dayOf(clock()));
      },
      async backfillPersonaStats() {
        return 0;
      },
    },
  };
}
