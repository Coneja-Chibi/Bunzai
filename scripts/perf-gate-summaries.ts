/**
 * The R5 step 3.3 gate: "boot and the library listing open 0 documents.body_json cells". Seeds a small SQLite
 * library across every kind, wraps its cipher with the counting cipher `document-summaries.sqlite.test.ts`
 * already uses, then asserts `StudioStore.inventory/list/graveyard` (what the Library boots from,
 * `/api/studio/list` and `/api/studio/trash`) open zero `documents.body_json` cells once every
 * summary is current - which it always is right after a `save`, since `content-store.ts` stamps the
 * summary in the same write.
 *
 * Run: bun run perf:check (chained after perf-gate.ts)
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countingCipher } from "./perf-count-cipher";
import { cellCipher } from "../src/stage/crypto/cell-cipher";
import { fakeComputer } from "../src/stage/crypto/fake-device-vault";
import { createKeyring } from "../src/stage/crypto/keyring";
import { createContentStore } from "../src/stage/store/content-store";
import { openStageDatabase } from "../src/stage/store/sqlite/database";
import { sqliteDocumentBackend } from "../src/stage/store/sqlite/document-backend";
import { MIGRATIONS } from "../src/stage/store/sqlite/migrations";
import { StudioStore } from "../src/studio/store";
import { fullCharacter, fullLorebook, fullPersona, fullPreset, fullRegex } from "../src/entities/runtime-schema.full-surface.fixtures";

const PIECE_COUNT_PER_KIND = 40;

const dir = mkdtempSync(join(tmpdir(), "bunraku-perf-summaries-"));
let failed = false;
try {
  const d = openStageDatabase(join(dir, "perf.db"), MIGRATIONS);
  const vault = fakeComputer();
  const ring = createKeyring(d, vault);
  await ring.setup();
  const counting = countingCipher(cellCipher(() => ring.keys()));
  const backend = sqliteDocumentBackend(d, counting.cipher);
  const content = createContentStore(backend);
  const studio = new StudioStore(dir, () => content);

  const seeds = [fullCharacter, fullLorebook, fullPersona, fullPreset, fullRegex];
  for (const seed of seeds) {
    for (let i = 0; i < PIECE_COUNT_PER_KIND; i++) {
      await content.save({ ...seed, id: `${seed.kind}-${i}` });
    }
  }
  // Every save above already stamped a current summary in the same write (content-store.ts): the
  // library never needs its background rebuild to finish before a listing can skip every body.
  await content.delete(seeds[0]!.kind, `${seeds[0]!.kind}-0`);

  const assertNoBodyOpens = async (label: string, work: () => Promise<unknown>) => {
    counting.reset();
    await work();
    const counts = counting.counts();
    const opens = counts["documents.body_json"]?.opens ?? 0;
    const mark = opens === 0 ? "ok  " : "OVER";
    console.log(`${mark} ${label.padEnd(40)} documents.body_json opens: ${opens}`);
    if (opens !== 0) failed = true;
  };

  await assertNoBodyOpens(`studio.list() (${seeds.length * PIECE_COUNT_PER_KIND - 1} pieces)`, () => studio.list());
  await assertNoBodyOpens("studio.inventory()", () => studio.inventory());
  await assertNoBodyOpens("studio.inventory(kind) (one kind)", () => studio.inventory("character"));
  await assertNoBodyOpens("studio.graveyard() (1 grave)", () => studio.graveyard());

  d.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log("perf-gate-summaries: the library listing opened a body cell it should not have");
  process.exit(1);
}
console.log("perf-gate-summaries: boot and the library listing open 0 documents.body_json cells");
