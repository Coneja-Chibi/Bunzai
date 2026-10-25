/**
 * S0's fast gate: COUNTS ONLY, no timings,
 * CPU-independent, meant to run under 60 s. Wires the measures that exist TODAY, against a
 * throwaway `BUNRAKU_HOME` and studio folder (never the real ones):
 *
 * 1. body/cell opens for the Library list, via the counting cipher `scripts/perf-count-cipher.ts`
 *    already ships (`perf-gate-summaries.ts`'s own pattern).
 * 2. real one-item patch/open/seal/request counts at N and 10N, owned by patch-fast-gate.ts.
 * 3. DOM node count for the Library (Shelves, what the app actually lands on - not the bare
 *    `views/grid.tsx` Tiles component), the preset block list, and the two preset rail panes
 *    (`live-build.tsx`, `live-preview.tsx`) at N and 10N (`scripts/scale/dom-count.ts`). Shelves and
 *    all four mounted surfaces must remain below 5,000 nodes and must not grow at 10N.
 *
 * Enforced CPU-independent counts. Existing patch, idle-timer, and cache owner suites run in the
 * `scale:fast` package command; this owner checks real synthetic list counts, DOM ceilings and shape.
 *
 * Run: bun run scale:fast
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Every per-user location this run could touch, redirected before any module that reads them loads
// (the same list `scripts/test-sandbox.ts` and `scripts/perf-browser.ts` use). This script never
// opens the real studio or the real BUNRAKU_HOME.
const sandbox = mkdtempSync(join(tmpdir(), "bunraku-scale-fast-"));
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

async function measureLibraryListOpens(): Promise<void> {
  const { countingCipher } = await import("../perf-count-cipher");
  const { cellCipher } = await import("../../src/stage/crypto/cell-cipher");
  const { fakeComputer } = await import("../../src/stage/crypto/fake-device-vault");
  const { createKeyring } = await import("../../src/stage/crypto/keyring");
  const { createContentStore } = await import("../../src/stage/store/content-store");
  const { openStageDatabase } = await import("../../src/stage/store/sqlite/database");
  const { sqliteDocumentBackend } = await import("../../src/stage/store/sqlite/document-backend");
  const { MIGRATIONS } = await import("../../src/stage/store/sqlite/migrations");
  const { StudioStore } = await import("../../src/studio/store");
  const { characters } = await import("./fixtures/character");
  const { personas } = await import("./fixtures/persona");
  const { htmldocs } = await import("./fixtures/htmldoc");

  const dir = mkdtempSync(join(sandbox, "list-"));
  const d = openStageDatabase(join(dir, "library.db"), MIGRATIONS);
  try {
    const vault = fakeComputer();
    const ring = createKeyring(d, vault);
    await ring.setup();
    const counting = countingCipher(cellCipher(() => ring.keys()));
    const content = createContentStore(sqliteDocumentBackend(d, counting.cipher));
    const studio = new StudioStore(dir, () => content);

    const SEED_PER_KIND = 40; // matches perf-gate-summaries.ts's own scale
    for (const c of characters(SEED_PER_KIND)) await content.save(c);
    for (const p of personas(SEED_PER_KIND)) await content.save(p);
    for (const h of htmldocs(SEED_PER_KIND)) await content.save(h);

    counting.reset();
    await studio.list();
    await studio.inventory();
    const observed = counting.counts();
    if (!Object.keys(observed).length) throw new Error("counting cipher recorded no calls during the seeded Library list/inventory observation");
    for (const column of ["piece_parts.cell", "blobs.cell"] as const) {
      const opens = observed[column]?.opens ?? 0;
      budgeted(`Library list, ${column} opens`, opens, "opens", 0, opens !== 0);
    }
  } finally {
    d.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

interface DomCountResult {
  shelves: number;
  blockList: number;
  liveBuild: number;
  livePreview: number;
}

async function measureDomCounts(n: number): Promise<DomCountResult> {
  const { libraryShelvesDomCount, presetBlockListDomCount, presetLiveBuildDomCount, presetLivePreviewDomCount } = await import("./dom-count");
  const { preset } = await import("./fixtures/preset");
  type Summary = import("../../src/ui/app-contract").StudioEntitySummary;
  const entities = Array.from({ length: n }, (_, i) => ({ id: `scale-character-${i}`, kind: "character", name: `Scale Character ${i}`, hasPortrait: false })) as Summary[];
  const body = preset(n).body;

  // Shelves, not the bare views/grid.tsx Tiles component: Shelves is what the Library app actually
  // lands on (dom-count.ts's own docblock).
  const shelves = await libraryShelvesDomCount(entities);
  budgeted(`Library Shelves (shelves.tsx) DOM nodes, n=${n}`, shelves, "nodes", 5_000, shelves > 5_000);

  const blockList = await presetBlockListDomCount(body.prompts);
  budgeted(`Preset block-list (block-list.tsx) DOM nodes, n=${n}`, blockList, "nodes", 5_000, blockList > 5_000);

  const liveBuild = await presetLiveBuildDomCount(body);
  budgeted(`Preset rail LiveBuild DOM nodes, n=${n}`, liveBuild, "nodes", 5_000, liveBuild > 5_000);

  const livePreview = await presetLivePreviewDomCount(body);
  budgeted(`Preset rail LivePreview DOM nodes, n=${n}`, livePreview, "nodes", 5_000, livePreview > 5_000);

  return { shelves, blockList, liveBuild, livePreview };
}

function printTable(): void {
  console.log("\nscale:fast - enforced counts and shape budgets\n");
  const width = Math.max(...rows.map((r) => r.label.length));
  for (const r of rows) {
    const budget = r.budget ? `  budget ${r.budget}  ${r.over ? "OVER" : "ok"}` : "";
    console.log(`${r.label.padEnd(width)}  ${r.value}${budget}`);
  }
  const failing = rows.filter((r) => r.over);
  console.log(`\nBudget failures (${failing.length}):`);
  if (failing.length === 0) console.log("  none");
  for (const r of failing) console.log(`  ${r.label}: ${r.value} (budget ${r.budget})`);
}

/** Section 11.3's complexity gate. Existing public patch tests enforce one-part work; this owner
 * enforces the O(visible) DOM bounds and synthetic N/10N shape. */
function printComparison(domSmall: DomCountResult, domBig: DomCountResult): void {
  console.log("\nN=300 vs 10N=3,000 (section 11.3's complexity check):");
  const failures: string[] = [];
  const line = (label: string, a: number, b: number, expectO1: boolean) => {
    const ratio = a === 0 ? Number.NaN : b / a;
    const valid = a > 0 && b > 0 && (expectO1 ? a === b : b <= a);
    if (!valid) failures.push(`${label}: ${a} -> ${b}`);
    const shape = valid ? (expectO1 ? "O(1)" : "O(visible) bounded") : `FAIL (x${ratio.toFixed(1)})`;
    console.log(`  ${label.padEnd(38)} ${String(a).padStart(10)} -> ${String(b).padStart(10)}   ${shape}`);
  };
  line("Library Shelves DOM nodes", domSmall.shelves, domBig.shelves, true);
  line("Preset block-list DOM nodes", domSmall.blockList, domBig.blockList, true);
  line("Preset LiveBuild DOM nodes", domSmall.liveBuild, domBig.liveBuild, true);
  line("Preset LivePreview DOM nodes", domSmall.livePreview, domBig.livePreview, true);
  if (failures.length) throw new Error(`complexity violations: ${failures.join("; ")}`);
}

async function enforceCacheBudgets(): Promise<void> {
  for (const [owner, modulePath] of [["server", "../../src/stage/caches"], ["browser", "../../src/ui/_shared/caches"]] as const) {
    const registry = await import(modulePath);
    const entries = registry.__registeredCachesForTests();
    const required = owner === "server" ? ["derived", "keyword-regex", "piece-cache"] : ["derived", "keyword-regex", "art"];
    for (const name of required) if (!entries.some((entry) => entry.name === name)) throw new Error(`${owner} cache registry is missing ${name}`);
    const total = entries.reduce((sum, entry) => {
      const bytes = entry.bytes();
      if (!Number.isFinite(bytes) || bytes < 0 || bytes > entry.budgetBytes) throw new Error(`${owner} cache ${entry.name} exceeds its budget`);
      return sum + bytes;
    }, 0);
    if (total > registry.GLOBAL_BUDGET_BYTES) throw new Error(`${owner} cache total ${total} exceeds ${registry.GLOBAL_BUDGET_BYTES}`);
    report(`${owner} registered caches`, `${entries.length} / ${total} bytes within ${registry.GLOBAL_BUDGET_BYTES}`);
  }
}

const started = performance.now();
try {
  await measureLibraryListOpens();
  await enforceCacheBudgets();
  const domSmall = await measureDomCounts(300);
  const domBig = await measureDomCounts(3_000);
  printTable();
  printComparison(domSmall, domBig);
  if (rows.some((row) => row.over)) throw new Error(`budget violations: ${rows.filter((row) => row.over).map((row) => row.label).join(", ")}`);
  console.log(`\nscale:fast: ${((performance.now() - started) / 1000).toFixed(1)} s (wall time of the gate itself, not a measured row)`);
} catch (e) {
  console.error("scale:fast failed:", e);
  process.exitCode = 1;
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
