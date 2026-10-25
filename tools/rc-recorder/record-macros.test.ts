// @vitest-environment node
/**
 * Records RoleCall's macro engine on its own characterization corpus
 * (lib/macros/__characterization__/corpus.ts at the pin), as the parity target for Bunraku's
 * ported engine in src/core/macros. Per entry: the parse tree, and the full process result minus
 * timing, under RoleCall's golden-test context (TestChar / TestUser, empty variables). The clock is
 * frozen and Math.random is seeded per entry, and each entry runs twice and must match, so even
 * the volatile entries have one recorded answer; they are flagged so a port whose random draws
 * differ in count can fall back to option membership.
 */
import { expect, test, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = process.env.RC_RECORDER_OUT!;
const NOW = "2026-09-27T12:00:00.000Z";

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

test("macro corpus, recorded", async () => {
  const { CORPUS } = await import("@/lib/macros/__characterization__/corpus");
  const { processMacros, createDefaultContext, __parseForTest } = await import("@/lib/macros/processor");
  const { initializeMacros } = await import("@/lib/macros/index");
  initializeMacros();

  const runOnce = (input: string, seed: number) => {
    vi.useFakeTimers({ now: new Date(NOW), toFake: ["Date"] });
    const spy = vi.spyOn(Math, "random").mockImplementation(seeded(seed));
    try {
      const r = processMacros(
        input,
        createDefaultContext({ characterName: "TestChar", userName: "TestUser", messages: [], messageCount: 0, readOnly: false }),
      );
      return {
        text: r.text,
        expansions: r.expansions.map((e) => ({ original: e.original, expanded: e.expanded, macroName: e.macroName, depth: e.depth })),
        errors: r.errors.map((e) => ({ macro: e.macro, message: e.message })),
        sideEffects: r.sideEffects.map((fx) => ({ type: fx.type, key: fx.key, value: fx.value ?? null, cause: fx.cause ?? null })),
        touchedVariables: r.touchedVariables,
        cacheable: r.cacheable,
        randomDraws: spy.mock.calls.length,
      };
    } finally {
      spy.mockRestore();
      vi.useRealTimers();
    }
  };

  const entries = CORPUS.map((entry, i) => {
    const seed = i + 1;
    const first = runOnce(entry.input, seed);
    expect(JSON.stringify(runOnce(entry.input, seed)), entry.id).toBe(JSON.stringify(first));
    return {
      id: entry.id,
      category: entry.category,
      input: entry.input,
      note: entry.note ?? null,
      seed,
      volatile: !first.cacheable && first.sideEffects.length === 0 ? true : !first.cacheable && first.randomDraws > 0,
      ast: __parseForTest(entry.input),
      result: first,
    };
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "macro-corpus.json"),
    JSON.stringify({ rolecall: process.env.RC_RECORDER_REF, now: NOW, host: Intl.DateTimeFormat().resolvedOptions(), context: { characterName: "TestChar", userName: "TestUser" }, entries }, null, 2) + "\n",
  );
});
