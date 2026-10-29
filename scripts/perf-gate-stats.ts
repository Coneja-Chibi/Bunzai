/**
 * The persona counters' speed budget: the one-time backfill of a scene
 * that predates the counters must not hold the main thread past 100 ms, however big the scene is. One large
 * legacy scene (20,000 user messages, each carrying its sealed persona stamp, across several takes) is counted
 * with the same hand-back the Studio uses; the longest freeze and the totals are checked.
 *
 * Run: bun run perf:check (chained after perf-gate-health.ts)
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cellCipher } from "../src/stage/crypto/cell-cipher";
import { fakeComputer } from "../src/stage/crypto/fake-device-vault";
import { createKeyring } from "../src/stage/crypto/keyring";
import { openStageDatabase } from "../src/stage/store/sqlite/database";
import { MIGRATIONS } from "../src/stage/store/sqlite/migrations";
import { sqliteChatStore } from "../src/stage/store/sqlite-chat-store";
import { measure } from "./perf-measure";

const BUDGET_MS = 100;
const MESSAGES = 20_000;
const dir = mkdtempSync(join(tmpdir(), "bunzai-perf-stats-"));
let result: { freezeMs: number; totalMs: number } | undefined;
let counted = { messages: 0, scenes: 0 };
let slices = 0;
try {
  const d = openStageDatabase(join(dir, "perf.db"), MIGRATIONS);
  const ring = createKeyring(d, fakeComputer());
  await ring.setup();
  const chats = sqliteChatStore(d, cellCipher(() => ring.keys()));
  const persona = { id: "nuit", version: 1, name: "Nuit" };
  const chat = await chats.createChat({
    title: "A very long scene",
    cast: { character: { id: "vera", version: 1 }, persona },
    snapshot: { character: { kind: "character", id: "vera", body: {} }, persona: { kind: "persona", id: "nuit", body: { name: "Nuit" } } },
  });
  const inputs = Array.from({ length: MESSAGES }, (_, i) => ({ role: i % 2 === 0 ? ("user" as const) : ("assistant" as const), content: `line ${i}` }));
  for (let at = 0; at < inputs.length; at += 2_000) await chats.appendMessages(chat.activeBranchId, inputs.slice(at, at + 2_000));
  const messages = (await chats.readMessages(chat.activeBranchId, { limit: 3 })).messages;
  for (const name of ["take two", "take three"]) await chats.fork(chat.activeBranchId, messages[2]!.id, { name });
  d.db.run("DELETE FROM persona_stats");
  d.db.run("UPDATE chats SET stats_state = 0");
  Bun.gc(true);
  result = await measure(async () => { await chats.backfillPersonaStats(async () => { slices += 1; await new Promise((r) => setImmediate(r)); }); });
  const stats = await chats.personaStats("nuit");
  counted = { messages: stats.messages, scenes: stats.scenes };
  d.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const expected = MESSAGES / 2;
console.log(`persona counters budget: no freeze over ${BUDGET_MS} ms (one legacy scene of ${MESSAGES} messages, 3 takes)`);
console.log(`${result!.freezeMs > BUDGET_MS ? "OVER" : "ok  "} backfill in ${slices} slices  longest freeze ${result!.freezeMs.toFixed(0).padStart(4)} ms   total ${result!.totalMs.toFixed(0).padStart(5)} ms`);
if (counted.messages !== expected || counted.scenes !== 1) {
  console.log(`perf-gate-stats: counted ${counted.messages} messages and ${counted.scenes} scene(s), expected ${expected} and 1 (forks must not count again)`);
  process.exit(1);
}
if (result!.freezeMs > BUDGET_MS) {
  console.log("perf-gate-stats: the backfill froze the app past the budget");
  process.exit(1);
}
console.log("perf-gate-stats: the backfill stays within budget");
