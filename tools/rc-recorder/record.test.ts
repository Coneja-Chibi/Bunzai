// @vitest-environment node
/**
 * Records RoleCall's prompt assembler on each fixture, as the parity target for Bunraku's port,
 * running under RoleCall's own vitest at the recorded commit; run.sh copies this folder in and runs it. For each fixture:
 *
 * - Supabase is the fail-closed double in fake-supabase.ts, answering only what the fixture declares.
 * - The clock, Math.random, and crypto.randomUUID are frozen to the fixture's values, so the port can
 *   be handed the same now and seed.
 * - The assembly runs RUNS times; every run must produce the same output, or the fixture fails (an
 *   unfrozen source of variation would make the target meaningless).
 * - Output: the messages, the other prompt-shaping result fields, the writes it attempted, the tables
 *   it read, and wall-clock timings. Timings exclude database time (the double answers instantly),
 *   and runs after the first hit RoleCall's in-process character cache, as a warm server does.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fakeSupabase, type FakeClient, type FakeDb } from "./fake-supabase";

const FIXTURES = process.env.RC_RECORDER_FIXTURES!;
const OUT = process.env.RC_RECORDER_OUT!;
const REF = process.env.RC_RECORDER_REF!;
const RUNS = 15;

let current: FakeClient | null = null;
const client = () => {
  if (!current) throw new Error("recorder: no fake client installed");
  return current.client;
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client() }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => client() }));

interface Fixture {
  name: string;
  about: string;
  now: string;
  seed: number;
  db: FakeDb;
  input: Record<string, unknown>;
}

/** mulberry32: a tiny seeded generator, so Math.random is the same sequence every run. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const freeze = (f: Fixture) => {
  vi.useFakeTimers({ now: new Date(f.now), toFake: ["Date"] });
  vi.spyOn(Math, "random").mockImplementation(seeded(f.seed));
  let n = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`);
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  current = null;
});

const fixtures = readdirSync(FIXTURES).filter((f) => f.endsWith(".json")).sort();

describe("RoleCall prompt assembly, recorded", () => {
  for (const file of fixtures) {
    test(file, async () => {
      const f = JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as Fixture;
      // A fresh module graph per fixture: RoleCall caches characters and personas at module level,
      // so a later fixture reusing an id would otherwise record the earlier fixture's card.
      vi.resetModules();
      const { assemblePrompt } = await import("@/lib/ai/prompt-assembly");
      mkdirSync(OUT, { recursive: true });
      const outputs: string[] = [];
      const times: number[] = [];
      let record: Record<string, unknown> = {};
      let reads: string[] = [];
      for (let run = 0; run < RUNS; run++) {
        freeze(f);
        current = fakeSupabase(f.db);
        const t0 = performance.now();
        const result = await assemblePrompt({
          ...f.input,
          databaseAuthority: { kind: "background-job", userId: f.db.userId },
        } as Parameters<typeof assemblePrompt>[0]);
        times.push(performance.now() - t0);
        // A refusal RoleCall swallowed means it ran a fallback path, not the behavior being recorded.
        expect(current.refusals, "the fake database refused a read or write").toEqual([]);
        record = {
          conversationHistory: result.conversationHistory,
          samplerSettings: result.samplerSettings ?? null,
          presetName: result.presetName ?? null,
          assistantPrefill: result.assistantPrefill ?? null,
          budgetReport: result.budgetReport ?? null,
          messagesTrimmed: result.messagesTrimmed ?? null,
          personaXml: result.personaXml ?? null,
          writes: current.writes,
        };
        outputs.push(JSON.stringify(record));
        // Reads are not compared: runs after the first hit the in-process caches and skip them.
        if (run === 0) reads = [...new Set(current.reads)].sort();
        vi.useRealTimers();
        vi.restoreAllMocks();
      }
      if (new Set(outputs).size !== 1) writeFileSync(join(OUT, file + ".variance.json"), JSON.stringify(outputs.map((o) => JSON.parse(o)), null, 2));
      expect(new Set(outputs).size, "every run must produce the same output").toBe(1);
      const sorted = [...times].sort((a, b) => a - b);
      writeFileSync(
        join(OUT, file),
        JSON.stringify(
          {
            fixture: f.name,
            rolecall: REF,
            ...record,
            reads,
            timing: { runs: RUNS, firstMs: +times[0]!.toFixed(2), medianWarmMs: +sorted[Math.floor(sorted.length / 2)]!.toFixed(2), note: "wall clock, database time excluded" },
          },
          null,
          2,
        ) + "\n",
      );
    });
  }
});
