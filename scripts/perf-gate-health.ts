/**
 * The health check's speed budget: a scan opens every sealed
 * cell, including a ~20 MB frozen snapshot, and must not hold the main thread past 100 ms, because the
 * cell checks run on the background lane under a key lease (health-lane.ts). Also covers the one-time
 * adoption of fingerprints on a library that predates them. The same open of the 20 MB cell on the main
 * thread is timed for comparison, so the gate can be seen to bite: it is the freeze this design removes.
 *
 * Run: bun run perf:check (chained after perf-gate.ts)
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cellCipher } from "../src/stage/crypto/cell-cipher";
import { fakeComputer } from "../src/stage/crypto/fake-device-vault";
import { createKeyring } from "../src/stage/crypto/keyring";
import type { JsonObject } from "../src/stage/contracts/chat-store";
import { createContentStore } from "../src/stage/store/content-store";
import { openStageDatabase } from "../src/stage/store/sqlite/database";
import { sqliteDocumentBackend } from "../src/stage/store/sqlite/document-backend";
import { damagedColumns } from "../src/stage/store/sqlite/health-cells";
import { createHealthCheck } from "../src/stage/store/sqlite/health-check";
import { MIGRATIONS } from "../src/stage/store/sqlite/migrations";
import { sqliteChatStore } from "../src/stage/store/sqlite-chat-store";
import { card, realisticSnapshotMedia, reply } from "./perf-gate-data";
import { measure } from "./perf-measure";

const BUDGET_MS = 100;
const dir = mkdtempSync(join(tmpdir(), "bunraku-perf-health-"));
const results: { action: string; freezeMs: number; totalMs: number }[] = [];
let inlineMs = 0;
try {
  const path = join(dir, "perf.db");
  const d = openStageDatabase(path, MIGRATIONS);
  const ring = createKeyring(d, fakeComputer());
  await ring.setup();
  const cipher = cellCipher(() => ring.keys());
  const library = createContentStore(sqliteDocumentBackend(d, cipher));
  const chats = sqliteChatStore(d, cipher);
  const health = createHealthCheck({ database: d, cipher, path, content: library, keys: ring });
  for (let i = 0; i < 300; i++) await library.save(card(i));
  const frozen = { ...card(1), body: { ...card(1).body, media: realisticSnapshotMedia() } };
  const chat = await chats.createChat({ title: "A long scene", cast: { character: { id: "card-1", version: 1 } }, snapshot: { character: frozen as unknown as JsonObject } });
  for (let m = 0; m < 200; m++) await chats.appendMessage(chat.activeBranchId, { role: m % 2 ? "assistant" : "user", content: reply });
  Bun.gc(true);

  const run = async (action: string, work: () => Promise<unknown>) => results.push({ action, ...(await measure(work)) });
  let found = -1;
  await run("scan every cell (health check, ~20 MB cell, lane)", async () => { found = (await health.scan()).findings.length; });
  await run("adopt fingerprints on an upgraded library (lane + commits)", async () => {
    d.db.run("DELETE FROM row_fingerprints");
    await health.adoptFingerprints(await health.scan());
  });
  if (found !== 0) throw new Error(`the scan of an undamaged library reported ${found} finding(s)`);

  // For comparison only: the same images read and opened on this thread, as the scan did before the lane.
  inlineMs = (await measure(async () => {
    for (const row of d.statement("SELECT * FROM blobs").all() as Record<string, string | number | null>[]) {
      if ((await damagedColumns(cipher, "blobs", row)).length > 0) throw new Error("the comparison cell did not open");
    }
  })).freezeMs;
  // A repair of the biggest cell there is: the 20 MB image, damaged. The copy into set_aside is SQL on the lane, never a main-thread string.
  d.db.run("UPDATE blobs SET cell = substr(cell, 1, 10) || CASE substr(cell, 11, 1) WHEN 'A' THEN 'B' ELSE 'A' END || substr(cell, 12) WHERE length(cell) = (SELECT max(length(cell)) FROM blobs)");
  let finding: Awaited<ReturnType<typeof health.scan>>["findings"][number] | undefined;
  await run("scan a library with a damaged 20 MB image (lane)", async () => { finding = (await health.scan()).findings.find((f) => f.row.table === "blobs"); });
  if (!finding) throw new Error("the damaged image was not found");
  let cleared = false;
  await run("set the damaged 20 MB image aside (repair, lane)", async () => { cleared = (await health.repair({ kind: "set-aside", finding: finding! })).cleared; });
  if (!cleared) throw new Error("the repair did not clear the finding");
  d.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const over = results.filter((r) => r.freezeMs > BUDGET_MS);
console.log(`health check budget: no freeze over ${BUDGET_MS} ms (300 cards, a ~20 MB frozen snapshot, 200 messages, and a repair of it)`);
for (const r of results) console.log(`${r.freezeMs > BUDGET_MS ? "OVER" : "ok  "} ${r.action.padEnd(62)} longest freeze ${r.freezeMs.toFixed(0).padStart(4)} ms   total ${r.totalMs.toFixed(0).padStart(5)} ms`);
console.log(`     (for comparison, reading and opening the 20 MB image on the main thread: ${inlineMs.toFixed(0)} ms, not counted)`);
if (over.length > 0) {
  console.log(`perf-gate-health: ${over.length} action(s) froze the app past the budget`);
  process.exit(1);
}
console.log("perf-gate-health: the health check stays within budget");
