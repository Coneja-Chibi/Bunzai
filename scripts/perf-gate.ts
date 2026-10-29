/**
 * The speed budget, enforced: nothing may block the main thread for
 * more than 100 ms. Builds a realistic encrypted library on a real file (5,000 cards, read by the
 * Studio through the library as the app does, 20 chats of 250 messages), then runs each everyday
 * action while a heartbeat timer measures the longest time the event loop was held. Slow work that
 * runs in the background (the rebuild, a password check) may take longer in total, but must not
 * freeze. Prints a table and exits non-zero past the budget.
 *
 * The data this runner plays against lives in `perf-gate-data.ts`: today it is still the same 5,000
 * small cards this file always used, unchanged, so this gate's pass/fail is unchanged. That file
 * also holds realistic 1-3 MB bodies and a ~20 MB snapshot for `perf-browser.ts` and for whichever
 * later phase adds the open-count and total-time budgets those sizes make meaningful.
 *
 * Run: bun run perf:check
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cellCipher } from "../src/stage/crypto/cell-cipher";
import { fakeComputer } from "../src/stage/crypto/fake-device-vault";
import { createKeyring } from "../src/stage/crypto/keyring";
import { createContentStore } from "../src/stage/store/content-store";
import { openStageDatabase } from "../src/stage/store/sqlite/database";
import { createHealthCheck } from "../src/stage/store/sqlite/health-check";
import { createSnapshotStore } from "../src/stage/store/sqlite/snapshots";
import { sqliteChatStore } from "../src/stage/store/sqlite-chat-store";
import { sqliteDocumentBackend } from "../src/stage/store/sqlite/document-backend";
import { MIGRATIONS } from "../src/stage/store/sqlite/migrations";
import { sqliteStateStore } from "../src/stage/store/sqlite/state-store";
import { loadFormats } from "../src/core";
import { openStudio } from "../src/foreign-reader";
import { addLibrary } from "../src/studio/library-content";
import { cutInScene, listScenes, openScene, restoreInScene, sendToScene } from "../src/studio/scenes";
import { BUDGET_PORTRAIT_CHARS, CARDS, CHATS, MESSAGES, card, portraitMedia, reply } from "./perf-gate-data";
import { medianAssemblyMs } from "./perf-gate-assembly";
import { measure } from "./perf-measure";
import { medianLoreActivationMs } from "./perf-gate-lore";
import type { JsonObject } from "../src/stage/contracts/chat-store";

const BUDGET_MS = 100;

const dir = mkdtempSync(join(tmpdir(), "bunzai-perf-"));
const results: { action: string; freezeMs: number; totalMs: number }[] = [];
try {
  const d = openStageDatabase(join(dir, "perf.db"), MIGRATIONS);
  const vault = fakeComputer();
  const ring = createKeyring(d, vault);
  await ring.setup();
  const cipher = cellCipher(() => ring.keys());
  const library = createContentStore(sqliteDocumentBackend(d, cipher));
  const chats = sqliteChatStore(d, cipher);
  // As the app opens it: every write below signs the rows it changes, so the budget covers the seal.
  createHealthCheck({ database: d, cipher, path: join(dir, "perf.db"), content: library, keys: ring });
  // The Studio on the same encrypted file, as the app has it.
  await loadFormats();
  const studioRoot = join(dir, "studio");
  addLibrary(() => ({ content: library, state: sqliteStateStore(d, cipher), chats }));
  for (let i = 0; i < CARDS; i++) await library.save(card(i));
  const studio = openStudio(studioRoot);
  // Every scene below plays card-1, and opening a scene reads the library's copy of it to offer the
  // newer card, so that copy carries the same 1.5 MB portrait the frozen one does.
  const portrait = portraitMedia(BUDGET_PORTRAIT_CHARS);
  await library.save({ ...card(1), body: { ...card(1).body, media: portrait } }, { overwrite: true });

  let branch = "";
  let chatId = "";
  for (let c = 0; c < CHATS; c++) {
    // A real frozen card with a 1.5 MB portrait, the weight a scene's snapshot actually carries.
    const frozen = { ...card(c), body: { ...card(c).body, media: portraitMedia(BUDGET_PORTRAIT_CHARS) } };
    const chat = await chats.createChat({ title: `Chat ${c}`, cast: { character: { id: "card-1", version: 1 } }, snapshot: { character: frozen as unknown as JsonObject } });
    branch = chat.activeBranchId;
    chatId = chat.id;
    for (let m = 0; m < MESSAGES; m++) await chats.appendMessage(branch, { role: m % 2 ? "assistant" : "user", content: reply });
  }
  // Setup made tens of megabytes of throwaway strings; collect them now so a timing below measures
  // its own action, not a pause for the setup's garbage.
  Bun.gc(true);
  const words = ring.beginWords();
  await ring.confirmWords(words);

  const run = async (action: string, work: () => Promise<unknown>) => results.push({ action, ...(await measure(work)) });
  // P2: Send-time prompt assembly must not scale with a scene's whole stored
  // history. Run here, right after the GC above and before any of this file's own heavier actions
  // (Argon2id, the rebuild), so their residual memory pressure never noisily inflates this reading.
  // The median of several back-to-back calls, not `measure()`'s single-shot freeze detector: a lone
  // sample of a few tens of ms is noisy enough on a shared machine to make a 50 ms gate flaky either
  // way (medianAssemblyMs's own docblock), including the first, un-warmed-up call.
  const assembly400Ms = medianAssemblyMs(400);
  const assembly4000Ms = medianAssemblyMs(4_000);
  results.push({ action: "assemble a scene (400 messages, median of 7)", freezeMs: assembly400Ms, totalMs: assembly400Ms });
  results.push({ action: "assemble a scene (4,000 messages, median of 7)", freezeMs: assembly4000Ms, totalMs: assembly4000Ms });
  // M3.
  const lore = medianLoreActivationMs();
  results.push({ action: "lore activation (5,000 entries, 30k-token scan text, median of 9)", freezeMs: lore.ms, totalMs: lore.ms });
  await run("open a chat (latest 50 messages)", () => chats.readMessages(branch, { fromSeq: MESSAGES - 49, limit: 50 }));
  await run("send a message", () => chats.appendMessage(branch, { role: "user", content: reply }));
  await run("add a swipe", async () => {
    const page = await chats.readMessages(branch, { fromSeq: MESSAGES, limit: 1 });
    await chats.addSwipe(page.messages[0]!.id, { content: reply });
  });
  await run("rename a chat", () => chats.renameChat(chatId, "Renamed"));
  await run("list all chats", () => chats.listChats());
  await run(`list the Scenes (${CHATS} scenes)`, () => listScenes(chats));
  await run(`open a scene (all ${MESSAGES} messages)`, () => openScene(chats, studio, chatId));
  const { branchVersion } = await chats.readMessages(branch, { limit: 1 });
  await run("send in a scene (the route's whole path)", () => sendToScene(chats, studio, { chatId, content: reply, greetingIndex: 0, expectedVersion: branchVersion ?? 1 }));
  const opened = (await openScene(chats, studio, chatId))!;
  const last = opened.messages[opened.messages.length - 1]!;
  let cutId = "";
  await run("cut a message in a scene", async () => {
    cutId = (await cutInScene(chats, studio, { chatId, messageId: last.id, scope: "one", expectedVersion: opened.branchVersion }))!.messages.find((m) => m.cut)!.cut!.id;
  });
  await run("restore a cut in a scene", () => restoreInScene(chats, studio, { chatId, cutId, expectedVersion: opened.branchVersion + 1 }));
  // The longest cut there is: from the second message to the end, one statement at one time.
  await run(`cut from here across a scene (${MESSAGES - 1} messages)`, async () => {
    const whole = (await cutInScene(chats, studio, { chatId, messageId: opened.messages[1]!.id, scope: "from", expectedVersion: opened.branchVersion + 2 }))!;
    cutId = whole.messages.find((m) => m.cut)!.cut!.id;
  });
  await run(`restore that cut (${MESSAGES - 1} messages)`, () => restoreInScene(chats, studio, { chatId, cutId, expectedVersion: opened.branchVersion + 3 }));
  await run(`list the library (${CARDS} cards)`, () => library.list());
  await run(`list the Studio (${CARDS} cards)`, () => studio.list());
  await run("open a card in the Studio", () => studio.read("character", "card-500"));
  await run("open a card", () => library.read("character", "card-500"));
  await run("save a card", () => library.save({ ...card(500), body: { ...card(500).body, identity: { name: "Edited" } } }, { overwrite: true }));
  await run("set a password (Argon2id, then a rebuild)", () => ring.setPassword("perf gate password", { mode: "each-open" }));
  ring.lock();
  await run("unlock with the password (Argon2id)", () => ring.unlockWithPassword("perf gate password"));
  await run("rebuild the file (background lane)", () => d.rebuild());
  // D23 layer 2: all three run on the background lane, so none may freeze the app.
  const snapshots = createSnapshotStore({ database: d, path: join(dir, "perf.db"), dir: join(dir, "snapshots"), cipher });
  let snapshotId = "";
  await run("take a snapshot (background lane)", async () => { snapshotId = (await snapshots.take()).id; });
  await library.save({ ...card(1), body: { ...card(1).body, identity: { name: "Changed after the snapshot" } } }, { overwrite: true });
  await run("preview a restore (background lane)", () => snapshots.preview(snapshotId));
  await run("restore a snapshot (background lane)", () => snapshots.restore(snapshotId));
  d.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

/** P2's own, tighter budget for the 4,000-message assembly action (perf-gate-assembly.ts). */
const ASSEMBLY_BUDGET_MS = 50;
// M3's own tighter budget (perf-gate-lore.ts's docblock: the honest floor measured without the
// identity fast path, not the plan's 10 ms aspiration).
const LORE_BUDGET_MS = 30;
const budgetFor = (action: string) => {
  if (action === "assemble a scene (4,000 messages, median of 7)") return ASSEMBLY_BUDGET_MS;
  if (action.startsWith("lore activation")) return LORE_BUDGET_MS;
  return BUDGET_MS;
};
const over = results.filter((r) => r.freezeMs > budgetFor(r.action));
console.log(`speed budget: no freeze over ${BUDGET_MS} ms (${CARDS} cards, ${CHATS * MESSAGES} messages); assembly at 4,000 messages over ${ASSEMBLY_BUDGET_MS} ms; lore activation over ${LORE_BUDGET_MS} ms`);
for (const r of results) {
  const mark = r.freezeMs > budgetFor(r.action) ? "OVER" : "ok  ";
  console.log(`${mark} ${r.action.padEnd(44)} longest freeze ${r.freezeMs.toFixed(0).padStart(4)} ms   total ${r.totalMs.toFixed(0).padStart(5)} ms`);
}
if (over.length > 0) {
  console.log(`perf-gate: ${over.length} action(s) froze the app past the budget`);
  process.exit(1);
}
console.log("perf-gate: every action within budget");
