/**
 * The encryption spec's strongest promise, tested the way an attacker would check it: write known
 * phrases through both stores on a real file, close it, and search every byte of the database and
 * its WAL for them. Then lock the keyring and prove the stores refuse instead of answering.
 */
import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bytesToBase64 } from "../../core/base64";
import { CANONICAL_SCHEMA_VERSION } from "../../core/canonical";
import { hashHex } from "../../core/sha256";
import { DEFAULT_RESOURCES } from "../../core/trackers/resources";
import { blankDirector } from "../contracts/chat-store.contract-director";
import { cellCipher } from "../crypto/cell-cipher";
import { fakeComputer } from "../crypto/fake-device-vault";
import { createKeyring, LockedError } from "../crypto/keyring";
import { createContentStore } from "./content-store";
import { openStageDatabase } from "./sqlite/database";
import { sqliteChatStore } from "./sqlite-chat-store";
import { sqliteDocumentBackend } from "./sqlite/document-backend";
import { MIGRATIONS } from "./sqlite/migrations";
import { varsOf } from "../../core/scene-state/vars-bridge";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** One fake computer for the whole test, so the library reopens on the computer that made it. */
const vault = fakeComputer();

/** Distinctive phrases, one per thing the spec says is sealed. */
const SECRET = {
  cardId: "zephyrine-quillfeather",
  cardName: "Zephyrine Quillfeather",
  chatTitle: "Moonlit Orchard Heist",
  branchName: "Velvet Alternate Ending",
  swipe: "The lantern flickered over the brass astrolabe",
  edited: "Cobalt tide swallowed the pier",
  model: "orchid-sampler-model",
  persona: "Marigold Tinkersmith",
  checkpoint: "Saffron gondola drifting past the weir",
  checkpointTrace: "Obsidian lighthouse ledger",
  summaryText: "Bramblewood keeper of the amber lantern",
  requestId: "req-periwinkle-harbor",
  trace: "Juniper clocktower inventory",
  variableName: "cardamom_velvet_counter",
  variableValue: "Tangerine Semaphore",
  connectionId: "conn-hibiscus-ferry",
  connectionModel: "tamarind-ledger-model",
  presetId: "preset-marigold-loft",
  presetToggleKey: "opening_notes_visible_saffron",
  loreAddedId: "book-periwinkle-atlas",
  loreOffId: "book-saffron-almanac",
  propOnId: "prop-saffron-weathervane",
  requestText: "Persimmon violin cadenza",
  folderName: "Wisteria Late-Night Heists",
  compendiumGuidance: "Prefer harbor lanterns and quiet debts",
  compendiumLanguage: "Old Marigold Dialect",
  participantName: "Quillon Thistlewick",
  regexSet: "set-vermilion-scrubber",
  finalCutNote: "Never soften the harbormaster, she sneers",
  trackerNeed: "Hollow-Marigold-Hunger",
  summaryPrompt: "Recap the harbor lanterns in lilac ink",
  chatSummaryText: "Mauve gulls circled the cracked bell",
  summaryError: "Teal fog swallowed the summary model",
  directorNote: "Cinnabar tidewatcher keeps the second ledger",
  directorInstructions: "Never let the lamplighter speak first",
  compendiumBook: "book-vermilion-compendium",
  receiptBook: "book-cerulean-ledger",
  receiptValue: "Pewter heron with a cracked bell",
  receiptModel: "quince-filing-model",
  receiptReason: "Mulberry ledger stopped early",
};

// Card art (holistic 4.2's blob store, S4b): canonical base64 so it extracts as a shared blob rather
// than staying inline, over the 16 KB threshold (16,384 base64 chars decode to 12,288 bytes). Its
// bytes are never a phrase a human would type, so the no-plaintext scan instead checks the one thing
// that WOULD leak identity if `blobs.key` were ever the plain hash instead of a keyed one: the raw
// SHA-256 hex of those bytes must not appear anywhere in the file either.
const ART_BYTES = new Uint8Array(12_288).map((_, i) => (i * 37 + 11) % 256);
const ART_DATA_URI = `data:image/png;base64,${bytesToBase64(ART_BYTES)}`;
const ART_SHA = hashHex(ART_BYTES);

test("nothing written through the stores can be found in the database files", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bunraku-rest-"));
  dirs.push(dir);
  const path = join(dir, "bunraku.db");
  const d = openStageDatabase(path, MIGRATIONS);
  const ring = createKeyring(d, vault);
  await ring.setup();
  const cipher = cellCipher(() => ring.keys());
  const documents = sqliteDocumentBackend(d, cipher);
  const library = createContentStore(documents);
  const chats = sqliteChatStore(d, cipher);

  const card = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: SECRET.cardId,
    body: {
      identity: { name: SECRET.cardName },
      persona: {},
      prompts: {},
      greetings: {},
      examples: {},
      media: { portrait: { role: "portrait" as const, ref: ART_DATA_URI } },
      attribution: {},
      discovery: {},
    },
  };
  await library.save(card);
  // The portrait is untouched by this edit: the blob it extracted to must be sealed exactly once.
  await library.save({ ...card, body: { ...card.body, identity: { name: `${SECRET.cardName} II` } } }, { overwrite: true });
  // The summary is sealed exactly like every other cell.
  expect(await documents.rewriteSummary("character", SECRET.cardId, 2, { text: SECRET.summaryText, derivedVersion: "1" }, Date.now())).toBe(
    true,
  );
  const chat = await chats.createChat({
    title: SECRET.chatTitle,
    cast: { character: { id: SECRET.cardId, version: 1 }, persona: { id: "me", version: 1 } },
    snapshot: { character: card, persona: { name: SECRET.persona } },
  });
  const m = await chats.appendMessage(chat.activeBranchId, {
    role: "assistant",
    content: SECRET.swipe,
    generation: { model: SECRET.model },
  });
  await chats.editSwipe(m!.id, m!.swipes[0]!.id, SECRET.edited);
  const take = await chats.fork(chat.activeBranchId, m!.id, { name: SECRET.branchName });
  const reply = await chats.beginTurn(take!.id, { kind: "reply" });
  const committed = await chats.commitTurn(reply!.id, { content: "reply", trace: { note: SECRET.trace }, request: { texts: [SECRET.requestText] } });
  const open = await chats.beginTurn(take!.id, { kind: "reply" });
  await chats.saveCheckpoint(open!.id, { content: SECRET.checkpoint, trace: { note: SECRET.checkpointTrace }, providerRequestId: SECRET.requestId });
  await chats.recordMessageDeltas(take!.id, committed!.id, [{ slot: "vars", path: [SECRET.variableName], value: SECRET.variableValue, at: 1 }]);
  await chats.setConnection(chat.id, { id: SECRET.connectionId, model: SECRET.connectionModel });
  await chats.setPreset(chat.id, { kind: "preset", id: SECRET.presetId, toggles: { [SECRET.presetToggleKey]: true }, samplers: { temperature: 0.8 } });
  await chats.setLore(chat.id, { added: [SECRET.loreAddedId], off: [SECRET.loreOffId] });
  await chats.setProps(chat.id, { on: [SECRET.propOnId] });
  const folder = await chats.createFolder(SECRET.folderName);
  await chats.setFolder(chat.id, folder.id);
  await chats.setFavorite(chat.id, true);
  await chats.updateParticipants(chat.id, { op: "add", run: "r1", people: [{ name: SECRET.participantName }] });
  await chats.setRegex(chat.id, { sets: [SECRET.regexSet] });
  await chats.setFinalCut(chat.id, { on: true, passes: [{ id: "post-editor", type: "editor", order: 0, failureMode: "fallback", guideContent: SECRET.finalCutNote }] });
  await chats.setTracker(chat.id, "resources", { data: { ...DEFAULT_RESOURCES, needs: { [SECRET.trackerNeed]: { value: 3, maxValue: 9 } } } });
  await chats.setSummarySettings(chat.id, { prompt: SECRET.summaryPrompt });
  await chats.setSummaryError(chat.id, SECRET.summaryError);
  await chats.setSummary(chat.activeBranchId, { text: SECRET.chatSummaryText, through: 1 });
  await chats.setDirectorSettings(chat.id, { instructions: SECRET.directorInstructions });
  await chats.putDirector(chat.id, committed!.id, { ...blankDirector(SECRET.directorNote) }, { expectedVersion: null });
  await chats.setCompendium(chat.id, { on: true, language: SECRET.compendiumLanguage, writeBook: SECRET.compendiumBook, books: { [SECRET.compendiumBook]: { access: "read_write" } }, recall: { guidance: SECRET.compendiumGuidance } });
  const receipt = await chats.appendReceipt(chat.id, {
    branchId: chat.activeBranchId, kind: "filing", status: "partly_filed", model: SECRET.receiptModel, reason: SECRET.receiptReason,
    writes: [{ bookId: SECRET.receiptBook, entryId: "e1", op: "update", fields: { before: { tagline: "old" }, after: { tagline: SECRET.receiptValue } } }],
  });

  // While the app is open, the newest writes sit in the WAL: the realistic moment for a theft.
  const whileOpen = [path, `${path}-wal`].map((f) => readFileSync(f));
  expect(whileOpen[1]!.length).toBeGreaterThan(0);
  d.close();
  const afterClose = [path, `${path}-wal`].filter(existsSync).map((f) => readFileSync(f));
  for (const phrase of Object.values(SECRET)) {
    for (const file of [...whileOpen, ...afterClose]) expect(file.includes(Buffer.from(phrase, "utf8"))).toBe(false);
  }
  // The art's raw bytes stay unsearchable (a `data:` URI's own base64 is itself the content, so a
  // phrase scan would not catch an unkeyed hash leaking it): `blobs.key` must be a keyed hash of the
  // sha, never the plain sha256 hex, or two libraries holding the same public image would show the
  // same value on disk.
  for (const file of [...whileOpen, ...afterClose]) {
    expect(file.includes(Buffer.from(bytesToBase64(ART_BYTES), "utf8"))).toBe(false);
    expect(file.includes(Buffer.from(ART_SHA, "utf8"))).toBe(false);
  }

  // And it all reads back once unlocked, so the scan above is not passing on empty data.
  const again = openStageDatabase(path, MIGRATIONS);
  try {
    const reopened = createKeyring(again, vault);
    expect(await reopened.unlock()).toBe(true);
    const c = cellCipher(() => reopened.keys());
    const documentsAgain = sqliteDocumentBackend(again, c);
    const lib = createContentStore(documentsAgain);
    const st = sqliteChatStore(again, c);
    expect((await lib.list()).map((s) => s.id)).toEqual([SECRET.cardId]);
    expect((await documentsAgain.summaries()).rows[0]).toMatchObject({ id: SECRET.cardId, summary: SECRET.summaryText, derivedVersion: "1" });
    expect((await st.getChat(chat.id))?.title).toBe(SECRET.chatTitle);
    expect((await st.listChats({ characterId: SECRET.cardId })).chats.map((x) => x.id)).toEqual([chat.id]);
    expect(await st.swipeHistory(m!.id, m!.swipes[0]!.id)).toEqual([SECRET.swipe]);
    expect(await st.swipeTrace(committed!.id, committed!.swipes[0]!.id)).toEqual({ note: SECRET.trace });
    expect((await st.resumeIncomplete()).map((c) => [c.content, c.trace, c.providerRequestId])).toEqual([
      [SECRET.checkpoint, { note: SECRET.checkpointTrace }, SECRET.requestId],
    ]);
    expect(varsOf(await st.sceneState(take!.id)).get(SECRET.variableName)!.value).toBe(SECRET.variableValue);
    expect((await st.getChat(chat.id))?.connection).toEqual({ id: SECRET.connectionId, model: SECRET.connectionModel });
    expect((await st.getChat(chat.id))?.preset).toEqual({
      kind: "preset",
      id: SECRET.presetId,
      toggles: { [SECRET.presetToggleKey]: true },
      samplers: { temperature: 0.8 },
    });
    expect((await st.getChat(chat.id))?.lore).toEqual({ added: [SECRET.loreAddedId], off: [SECRET.loreOffId] });
    expect((await st.getChat(chat.id))?.props).toEqual({ on: [SECRET.propOnId] });
    expect(await st.lastRequest(take!.id)).toEqual({ messageId: committed!.id, swipeId: committed!.swipes[0]!.id, texts: [SECRET.requestText] });
    expect((await st.listFolders())[0]).toMatchObject({ id: folder.id, name: SECRET.folderName });
    expect((await st.getChat(chat.id))?.folderId).toBe(folder.id);
    expect((await st.getChat(chat.id))?.favoredAt).toBeGreaterThan(0);
    expect((await st.getChat(chat.id))?.compendium).toMatchObject({ language: SECRET.compendiumLanguage, writeBook: SECRET.compendiumBook, recall: { guidance: SECRET.compendiumGuidance } });
    expect((await st.getChat(chat.id))?.participants?.people[0]?.name).toBe(SECRET.participantName);
    expect((await st.getChat(chat.id))?.regex?.sets).toEqual([SECRET.regexSet]);
    expect((await st.getChat(chat.id))?.finalCut?.passes?.[0]?.guideContent).toBe(SECRET.finalCutNote);
    expect(Object.keys(((await st.getChat(chat.id))?.trackers?.resources?.data as { needs: object }).needs)).toEqual([SECRET.trackerNeed]);
    expect((await st.getChat(chat.id))?.summary).toEqual({ settings: { prompt: SECRET.summaryPrompt }, error: SECRET.summaryError });
    expect((await st.summaryOf(chat.activeBranchId))?.text).toBe(SECRET.chatSummaryText);
    expect((await st.getChat(chat.id))?.director).toEqual({ instructions: SECRET.directorInstructions });
    expect((await st.getDirector(chat.id, committed!.id))?.state.notes[0]?.content).toBe(SECRET.directorNote);
    expect(await st.receipt(receipt!.id)).toMatchObject({ model: SECRET.receiptModel, reason: SECRET.receiptReason, writes: [{ bookId: SECRET.receiptBook, fields: { after: { tagline: SECRET.receiptValue } } }] });

    reopened.lock();
    await expect(lib.list()).rejects.toBeInstanceOf(LockedError);
    await expect(st.getChat(chat.id)).rejects.toBeInstanceOf(LockedError);
    await expect(st.appendMessage(chat.activeBranchId, { role: "user", content: "x" })).rejects.toBeInstanceOf(LockedError);
    await expect(lib.save({ ...card, id: "written-while-locked" })).rejects.toBeInstanceOf(LockedError);
    await expect(st.renameChat(chat.id, "Renamed While Locked")).rejects.toBeInstanceOf(LockedError);
    await expect(documentsAgain.summaries()).rejects.toBeInstanceOf(LockedError);
    await expect(documentsAgain.rewriteSummary("character", SECRET.cardId, 2, { text: "x", derivedVersion: "1" }, 1)).rejects.toBeInstanceOf(
      LockedError,
    );
    expect((again.db.query("SELECT compendium_json FROM chats").get() as { compendium_json: string }).compendium_json.startsWith("e1:")).toBe(true);
    expect((again.db.query("SELECT participants_json FROM chats").get() as { participants_json: string }).participants_json.startsWith("e1:")).toBe(true);
    expect((again.db.query("SELECT regex_json FROM chats").get() as { regex_json: string }).regex_json.startsWith("e1:")).toBe(true);
    expect((again.db.query("SELECT final_cut_json FROM chats").get() as { final_cut_json: string }).final_cut_json.startsWith("e1:")).toBe(true);
    expect((again.db.query("SELECT trackers_json FROM chats").get() as { trackers_json: string }).trackers_json.startsWith("e1:")).toBe(true);
    expect((again.db.query("SELECT summary_json FROM chats").get() as { summary_json: string }).summary_json.startsWith("e1:")).toBe(true);
    expect((again.db.query("SELECT director_json FROM chats").get() as { director_json: string }).director_json.startsWith("e1:")).toBe(true);
    expect((again.db.query("SELECT cell FROM director_states").get() as { cell: string }).cell.startsWith("e1:")).toBe(true);
    expect((again.db.query("SELECT cell FROM compendium_receipts").get() as { cell: string }).cell.startsWith("e1:")).toBe(true);
    const rawTitle = (again.db.query("SELECT title FROM chats").get() as { title: string }).title;
    expect(rawTitle.startsWith("e1:")).toBe(true);
    const rawSummary = (again.db.query("SELECT summary_cell FROM document_summaries").get() as { summary_cell: string }).summary_cell;
    expect(rawSummary.startsWith("e1:")).toBe(true);
    // The card's body now lives in piece_parts (S4a), never documents: sealed exactly like every
    // other cell, and the no-plaintext scan above already covers its content through SECRET.cardName.
    const rawPart = (again.db.query("SELECT cell FROM piece_parts LIMIT 1").get() as { cell: string }).cell;
    expect(rawPart.startsWith("e1:")).toBe(true);
    // The portrait now lives in `blobs` (S4b), sealed exactly the same way, covered by the raw-sha
    // and raw-base64 checks above (a sentinel's own text is tiny; the no-plaintext scan on SECRET
    // phrases alone would never have exercised this table).
    const rawBlob = (again.db.query("SELECT cell FROM blobs LIMIT 1").get() as { cell: string }).cell;
    expect(rawBlob.startsWith("e1:")).toBe(true);
    // The current frozen cast adds four parts and two refs to the same encrypted blob.
    // Refused means nothing was written, not written and then hidden. The card's one "h" part was
    // closed and reinserted once (the overwrite that appended " II"), so two rows: one closed, one
    // live. The portrait is unchanged across that overwrite, so exactly one blob was ever sealed, and
    // the no-plaintext scan's orphan-free promise (holistic 4.2) holds: nothing to orphan yet.
    const counts = again.db
      .query(
        "SELECT (SELECT count(*) FROM messages) AS m, (SELECT count(*) FROM documents) AS d, (SELECT count(*) FROM document_summaries) AS s, (SELECT count(*) FROM piece_parts) AS p, (SELECT count(*) FROM blobs) AS bl, (SELECT count(*) FROM blob_refs) AS br",
      )
      .get();
    expect(counts).toEqual({ m: 3, d: 1, s: 1, p: 6, bl: 1, br: 4 });
  } finally {
    again.close();
  }
});
