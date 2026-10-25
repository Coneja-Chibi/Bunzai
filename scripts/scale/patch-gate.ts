/**
 * The patch path's own timed gates: a warm
 * one-block patch on the 30 MB preset under 50 ms p50, growth under 100 KB, a reorder under 250 KB, a
 * one-entry patch on the 5,000-entry lorebook under 50 ms, and the cold first patch recorded with no
 * single main-thread block over 100 ms (a `setInterval` lag probe, not a guess). Informational like
 * `fast-gate.ts`: prints numbers and exits non-zero only on an internal error, never on a budget miss
 * - the lead decides when to promote a row to enforced and add `scale:patch` to `perf:check`.
 *
 * Measures DB growth the way Appendix A P0 and `fast-gate.ts` already do: real on-disk file size after
 * `PRAGMA wal_checkpoint(TRUNCATE)` (the store's own `scrub()`), never an estimate.
 *
 * Run: bun run scale:patch
 */
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Every per-user location this run could touch, redirected before any module that reads them loads
// (scripts/test-sandbox.ts's own list). This script never opens the real studio or BUNRAKU_HOME.
const sandbox = mkdtempSync(join(tmpdir(), "bunraku-scale-patch-"));
process.env["BUNRAKU_HOME"] = join(sandbox, "home");
process.env["LOCALAPPDATA"] = join(sandbox, "local-app-data");
process.env["CODEX_HOME"] = join(sandbox, "codex");
process.env["CLAUDE_CONFIG_DIR"] = join(sandbox, "claude");
process.env["XDG_STATE_HOME"] = join(sandbox, "xdg-state");

interface Row {
  label: string;
  value: string;
  budget?: string;
  over?: boolean;
}
const rows: Row[] = [];
const report = (label: string, value: string): void => void rows.push({ label, value });
const budgeted = (label: string, value: number, unit: string, budget: number, over: boolean): void =>
  void rows.push({ label, value: `${value} ${unit}`, budget: `${budget} ${unit}`, over });

/** Starts a 5 ms `setInterval` lag probe and returns a stopper that reports the worst gap observed
 * between ticks beyond the 5 ms the timer itself asked for - the measurement for "no single
 * main-thread block over 100 ms" that does not depend on instrumenting the code under test at all. */
function startLagProbe(): { stop(): number } {
  const PERIOD_MS = 5;
  let last = performance.now();
  let worstGap = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    worstGap = Math.max(worstGap, now - last - PERIOD_MS);
    last = now;
  }, PERIOD_MS);
  return {
    stop: () => {
      clearInterval(timer);
      return worstGap;
    },
  };
}

async function openFreshLibrary(dir: string) {
  const { cellCipher } = await import("../../src/stage/crypto/cell-cipher");
  const { fakeComputer } = await import("../../src/stage/crypto/fake-device-vault");
  const { createKeyring } = await import("../../src/stage/crypto/keyring");
  const { createContentStore } = await import("../../src/stage/store/content-store");
  const { openStageDatabase } = await import("../../src/stage/store/sqlite/database");
  const { sqliteDocumentBackend } = await import("../../src/stage/store/sqlite/document-backend");
  const { MIGRATIONS } = await import("../../src/stage/store/sqlite/migrations");

  const dbPath = join(dir, "library.db");
  const d = openStageDatabase(dbPath, MIGRATIONS);
  const vault = fakeComputer();
  const ring = createKeyring(d, vault);
  await ring.setup();
  const cipher = cellCipher(() => ring.keys());
  const content = createContentStore(sqliteDocumentBackend(d, cipher));
  return { d, dbPath, content };
}

/** The exact head `piece-parts.ts`'s own `decompose` would hand back for `entity` - built by
 * decomposing the REAL entity and taking its "h" part verbatim, so this gate's own patches are as
 * honest a client as the real one (S7) will be, never a hand-rolled guess at which escrow formats are
 * split. */
async function headPlaceholderFor(entity: unknown): Promise<unknown> {
  const { decompose } = await import("../../src/entities/piece-parts");
  const { parseCanonicalEntity } = await import("../../src/entities/runtime-schema");
  const parsed = parseCanonicalEntity(entity);
  const headPart = decompose(parsed).find((p) => p.name === "h")!;
  return JSON.parse(headPart.json);
}

async function measurePresetPatch(): Promise<void> {
  const { preset, PRESET_SCALE_N } = await import("./fixtures/preset");

  const dir = mkdtempSync(join(sandbox, "preset-"));
  const { d, dbPath, content } = await openFreshLibrary(dir);
  try {
    const p = preset(PRESET_SCALE_N);
    await content.create(p);
    await d.scrub();
    const sizeAfterCreate = statSync(dbPath).size;
    let current = (await content.read("preset", "scale-preset"))!;

    // -- cold first patch: the very first patch() call ever made against this piece in this process,
    // so its own cache fill (coldFillParts, content-store-write.ts) is unavoidably paid here. --
    const coldHead = await headPlaceholderFor(current.entity);
    const coldProbe = startLagProbe();
    const coldStart = performance.now();
    const coldResult = await content.patch("preset", "scale-preset", current.revision, {
      head: coldHead,
      items: { "i/scale-block-0": { ...(current.entity.body as { prompts: { id: string }[] }).prompts[0]!, content: "cold patch edit" } },
    });
    const coldMs = performance.now() - coldStart;
    const coldWorstGap = coldProbe.stop();
    if (coldResult.status !== "saved") throw new Error(`cold patch did not save: ${coldResult.status}`);
    report("Cold first patch (30 MB preset), wall time", `${coldMs.toFixed(1)} ms`);
    budgeted("Cold first patch, worst single-tick lag (main-thread block proxy)", Math.round(coldWorstGap), "ms", 100, coldWorstGap > 100);
    current = (await content.read("preset", "scale-preset"))!;

    // -- warm one-block patches: p50 over 20 edits after the cold one above already warmed the cache,
    // plus growth averaged the same way fast-gate.ts measures a whole-entity save's own growth. --
    await d.scrub();
    const sizeBeforeWarm = statSync(dbPath).size;
    const timesMs: number[] = [];
    for (let i = 0; i < 20; i++) {
      const head = await headPlaceholderFor(current.entity);
      const body = current.entity.body as { prompts: { id: string; content: string }[] };
      const idx = (i * 37) % body.prompts.length; // spread across the block array, not always block 0
      const name = idx === 0 ? "i/scale-block-0" : `i/scale-block-${idx}`;
      const t0 = performance.now();
      const result = await content.patch("preset", "scale-preset", current.revision, {
        head,
        items: { [name]: { ...body.prompts[idx]!, content: `warm patch edit ${i}` } },
      });
      timesMs.push(performance.now() - t0);
      if (result.status !== "saved") throw new Error(`warm patch ${i} did not save: ${result.status}`);
      current = (await content.read("preset", "scale-preset"))!;
    }
    await d.scrub();
    const sizeAfterWarm = statSync(dbPath).size;
    const avgGrowth = (sizeAfterWarm - sizeBeforeWarm) / 20;
    timesMs.sort((a, b) => a - b);
    const p50 = timesMs[Math.floor(timesMs.length / 2)]!;
    budgeted("Warm one-block patch (30 MB preset), p50", Math.round(p50 * 10) / 10, "ms", 50, p50 > 50);
    report("Warm one-block patch, target", "about 10 ms");
    budgeted("Warm one-block patch, average DB growth over 20 edits", Math.round(avgGrowth), "bytes", 100_000, avgGrowth > 100_000);
    report("(for reference) whole-entity save growth at this size", "about 93 MB");

    // -- reorder, typical case: move ONE block - index 1, never one end of a duplicate pair
    // (those sit at i and i-1 for i % 200 === 0, i > 0), so moving it changes no OTHER item's
    // occurrence number: only the "o" part itself should grow. --
    {
      const typicalHead = await headPlaceholderFor(current.entity);
      const typicalBody = current.entity.body as { prompts: { id: string }[] };
      const { partNames: partNamesTypical } = await import("../../src/entities/piece-parts");
      const typicalOrder = partNamesTypical(current.entity);
      const moved = [...typicalBody.prompts];
      const [block1] = moved.splice(1, 1);
      moved.push(block1!);
      const movedNames = (() => {
        const seen = new Map<string, number>();
        return moved.map((item) => {
          const n = (seen.get(item.id) ?? 0) + 1;
          seen.set(item.id, n);
          return n === 1 ? `i/${item.id}` : `i/${item.id}#${n}`;
        });
      })();
      if (new Set(movedNames).size !== new Set(typicalOrder).size) {
        throw new Error("moving block 1 unexpectedly renamed another item - pick a different index");
      }
      await d.scrub();
      const sizeBeforeTypical = statSync(dbPath).size;
      const typicalResult = await content.patch("preset", "scale-preset", current.revision, { head: typicalHead, order: movedNames });
      if (typicalResult.status !== "saved") throw new Error(`typical reorder patch did not save: ${typicalResult.status}`);
      await d.scrub();
      const typicalGrowth = statSync(dbPath).size - sizeBeforeTypical;
      budgeted("Reorder patch (30 MB preset), DB growth - typical (move one block)", typicalGrowth, "bytes", 250_000, typicalGrowth > 250_000);
      current = (await content.read("preset", "scale-preset"))!;
    }

    // -- reorder, worst case: reverse the WHOLE order, which crosses every duplicate pair's relative
    // order (14 pairs at this N) and so forces a full resend of both items in each - a property of
    // section 1's positional duplicate-occurrence naming, not of the patch path's own efficiency.
    // Kept and labeled as the worst case rather than swapped for an easier op (S5 perf review,
    // 2026-09-30): a client that actually reverses a massive preset's block order pays this for real. --
    const reorderHead = await headPlaceholderFor(current.entity);
    const reorderBody = current.entity.body as { prompts: { id: string }[] };
    const { partNames } = await import("../../src/entities/piece-parts");
    const currentOrder = partNames(current.entity);
    const reversedOrder = [...currentOrder].reverse();
    // Any item whose name would change under the new order (a duplicate pair that crossed) needs an
    // explicit, unchanged-content rewrite - the same rule the differential test's own harness proves
    // (content-store-patch.contract.ts's `renamedSurvivors`). Reversing a sequence with duplicate ids
    // scattered through it can rename several; this gate includes them so the patch is honestly built,
    // not merely "how little can be sent and still have it accepted".
    const byName = new Map(reorderBody.prompts.map((item, i) => [currentOrder[i]!, item] as const));
    const reversedItems = [...reorderBody.prompts].reverse();
    const newNames = (() => {
      const seen = new Map<string, number>();
      return reversedItems.map((item) => {
        const n = (seen.get(item.id) ?? 0) + 1;
        seen.set(item.id, n);
        return n === 1 ? `i/${item.id}` : `i/${item.id}#${n}`;
      });
    })();
    const renamed: Record<string, unknown> = {};
    reversedItems.forEach((item, i) => {
      const oldIdx = reorderBody.prompts.length - 1 - i;
      if (currentOrder[oldIdx] !== newNames[i]) renamed[newNames[i]!] = byName.get(currentOrder[oldIdx]!);
    });
    await d.scrub();
    const sizeBeforeReorder = statSync(dbPath).size;
    const reorderResult = await content.patch("preset", "scale-preset", current.revision, {
      head: reorderHead,
      order: newNames,
      ...(Object.keys(renamed).length > 0 ? { items: renamed } : {}),
    });
    if (reorderResult.status !== "saved") throw new Error(`reorder patch did not save: ${reorderResult.status}`);
    await d.scrub();
    const reorderGrowth = statSync(dbPath).size - sizeBeforeReorder;
    budgeted("Reorder patch (30 MB preset), DB growth - worst case (full reverse)", reorderGrowth, "bytes", 250_000, reorderGrowth > 250_000);
    report(
      "Reorder worst case, note",
      "reversing the WHOLE order crosses every duplicate pair's relative order (14 pairs at this N), forcing a full resend of both items in each - section 1's positional duplicate-occurrence naming, not the patch path's own inefficiency; see the typical-case row above",
    );
    void reversedOrder;
    void sizeAfterCreate;
  } finally {
    d.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function measureLorebookPatch(): Promise<void> {
  const { lorebook, LOREBOOK_SCALE_N } = await import("./fixtures/lorebook");

  const dir = mkdtempSync(join(sandbox, "lorebook-"));
  const { d, content } = await openFreshLibrary(dir);
  try {
    const book = lorebook(LOREBOOK_SCALE_N);
    await content.create(book);
    let current = (await content.read("lorebook", "scale-lorebook"))!;
    // One cold fill to warm the cache (the 50 ms gate below is explicitly the WARM case, matching the
    // preset gate above; the lorebook's own cold case is covered qualitatively by the preset's).
    const warmupHead = await headPlaceholderFor(current.entity);
    const warmupBody = current.entity.body as { entries: { id: string; title: string }[] };
    await content.patch("lorebook", "scale-lorebook", current.revision, {
      head: warmupHead,
      items: { "i/scale-entry-0": { ...warmupBody.entries[0]!, title: "warmup" } },
    });
    current = (await content.read("lorebook", "scale-lorebook"))!;

    const timesMs: number[] = [];
    for (let i = 0; i < 20; i++) {
      const head = await headPlaceholderFor(current.entity);
      const body = current.entity.body as { entries: { id: string; title: string; content: string }[] };
      const idx = (i * 211) % body.entries.length;
      const name = idx === 0 ? "i/scale-entry-0" : `i/scale-entry-${idx}`;
      const t0 = performance.now();
      const result = await content.patch("lorebook", "scale-lorebook", current.revision, {
        head,
        items: { [name]: { ...body.entries[idx]!, content: `warm patch edit ${i}` } },
      });
      timesMs.push(performance.now() - t0);
      if (result.status !== "saved") throw new Error(`lorebook patch ${i} did not save: ${result.status}`);
      current = (await content.read("lorebook", "scale-lorebook"))!;
    }
    timesMs.sort((a, b) => a - b);
    const p50 = timesMs[Math.floor(timesMs.length / 2)]!;
    budgeted("Warm one-entry patch (5,000-entry lorebook), p50", Math.round(p50 * 10) / 10, "ms", 50, p50 > 50);
  } finally {
    d.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function printTable(): void {
  console.log("\nscale:patch - S5/P3 patch path gates (printed; enforced only once promoted)\n");
  const width = Math.max(...rows.map((r) => r.label.length));
  for (const r of rows) {
    const budget = r.budget ? `  budget ${r.budget}  ${r.over ? "OVER" : "ok"}` : "";
    console.log(`${r.label.padEnd(width)}  ${r.value}${budget}`);
  }
  const failing = rows.filter((r) => r.over);
  console.log(`\nBudgets failing today (${failing.length}):`);
  if (failing.length === 0) console.log("  none");
  for (const r of failing) console.log(`  ${r.label}: ${r.value} (budget ${r.budget})`);
}

try {
  await measurePresetPatch();
  await measureLorebookPatch();
  printTable();
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
