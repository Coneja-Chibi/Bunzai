/**
 * What each persona's running counters hold and how they read,
 * shared by both ChatStore backends. The counters are RoleCall's persona stats: messages sent, scenes
 * played, and the day streak (`get_persona_streak`: consecutive days with a message, counting back from
 * today, or from yesterday when today has none, at most 366). Days are UTC day numbers, kept as the
 * newest few hundred distinct days, so the streak reads exactly and a backfill can add days in any order.
 */
import type { Cast, ChatHistory, PersonaStats } from "../contracts/chat-store";
import { isWhole } from "./scalar-rules";

export interface StatsRow { messages: number; scenes: number; days: number[] }

export const DAY_MS = 86_400_000;
const KEEP_DAYS = 400;
const STREAK_CAP = 366;

export const dayOf = (ms: number): number => Math.floor(ms / DAY_MS);
export const emptyStats = (): StatsRow => ({ messages: 0, scenes: 0, days: [] });

/**
 * The UTC day of every user message in a scene's imported history, per persona: the one the message is
 * stamped with, else the scene's own (undefined when it has none). Both backends feed this to their
 * counters, so a scene born with its history earns the same stats in either.
 */
export function personaDaysOf(history: ChatHistory, cast: Cast): Map<string | undefined, number[]> {
  const days = new Map<string | undefined, number[]>();
  for (const m of history.messages) {
    if (m.role !== "user") continue;
    const who = m.persona?.id ?? cast.persona?.id;
    days.set(who, [...(days.get(who) ?? []), dayOf(m.createdAt)]);
  }
  return days;
}

/** The days with `day` added, ascending, distinct, newest few hundred only. */
export function withDays(days: readonly number[], added: readonly number[]): number[] {
  return [...new Set([...days, ...added])].sort((a, b) => a - b).slice(-KEEP_DAYS);
}

/** RoleCall's streak, read at `today`. */
export function streakAt(days: readonly number[], today: number): number {
  const set = new Set(days);
  let streak = 0;
  let day = set.has(today) ? today : today - 1;
  while (set.has(day) && streak <= 365) {
    streak += 1;
    day -= 1;
  }
  return Math.min(streak, STREAK_CAP);
}

export const readStats = (row: StatsRow | undefined, today: number): PersonaStats => ({
  messages: Math.max(0, row?.messages ?? 0),
  scenes: Math.max(0, row?.scenes ?? 0),
  streak: streakAt(row?.days ?? [], today),
});

/** A stored counter row, or an error: a damaged one is never read as zero. */
export function parseStatsRow(text: string): StatsRow {
  const v = JSON.parse(text) as Partial<StatsRow> | null;
  if (!v || !isWhole(v.messages) || !isWhole(v.scenes) || !Array.isArray(v.days) || !v.days.every((d) => isWhole(d))) throw new Error("a persona's counters are damaged");
  return { messages: v.messages!, scenes: v.scenes!, days: v.days as number[] };
}
