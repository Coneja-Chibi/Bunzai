/**
 * The library root (library-root.ts): a new studio folder gets an encrypted library this computer
 * opens by itself; reopening unlocks silently; a locked library makes every Studio call refuse; a
 * plain folder is imported and left exactly as it was, and an import that cannot finish changes
 * nothing and leaves no library. Runs in throwaway folders with a fake computer vault, never a real
 * studio.
 */
import { afterEach, expect, setSystemTime, test } from "bun:test";
import { Database } from "bun:sqlite";

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeComputer } from "../stage/crypto/fake-device-vault";
import { isLibraryLocked } from "../studio/errors";
import { COPYING_FILE, LIBRARY_FILE } from "../studio/fs-backend";
import { readStudioFolder } from "../studio/folder-reader";
import { ImportStoppedError } from "../studio/folder-import";
import { libraryChatsFor, type LibraryStores } from "../studio/library-content";
import { SettingsStore } from "../studio/settings";
import { StudioStore } from "../studio/store";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { emptyTrash, openLibrary, type OpenedLibrary } from "./library-root";
import { createSessionStore } from "../kit/sessions/store";
import { __resetTokenCacheForTests, __tokenCacheStatsForTests, countText } from "../core/tokens/base";
import { removeTempDir } from "../studio/test-temp-dir";

const opened: OpenedLibrary[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const l of opened.splice(0)) l.close();
  await Promise.all(dirs.splice(0).map(removeTempDir));
});
const studio = () => {
  const d = mkdtempSync(join(tmpdir(), "bunzai-library-root-"));
  dirs.push(d);
  return join(d, "Bunzai Studio");
};
const card = (id: string) =>
  ({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id, body: { identity: { name: id }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } }) as never;

test("a new studio folder gets an encrypted library, and the Studio saves into it, not onto disk", async () => {
  const dir = studio();
  const library = (await openLibrary(dir, { vault: fakeComputer() }))!;
  opened.push(library);
  expect(library.state).toBe("unlocked");
  const store = new StudioStore(dir);
  await store.save(card("vera"));
  expect(await store.read("character", "vera")).not.toBeNull();
  expect(readdirSync(dir).filter((n) => !n.startsWith(LIBRARY_FILE))).toEqual([]);
});

test("reopening on the same computer unlocks by itself; another computer finds it locked", async () => {
  const dir = studio();
  const here = fakeComputer();
  const first = (await openLibrary(dir, { vault: here }))!;
  await new StudioStore(dir).save(card("vera"));
  first.close();
  const again = (await openLibrary(dir, { vault: here }))!;
  opened.push(again);
  expect(again.state).toBe("unlocked");
  expect(await new StudioStore(dir).read("character", "vera")).not.toBeNull();
  again.close();
  opened.splice(0);
  const elsewhere = (await openLibrary(dir, { vault: fakeComputer() }))!;
  opened.push(elsewhere);
  expect(elsewhere.state).toBe("locked");
  const err = await new StudioStore(dir).list().catch((e: unknown) => e);
  expect(isLibraryLocked(err)).toBe(true);
});

/** A plain folder library as the Studio writes it: two cards and a settings file. */
function plainFolder(dir: string) {
  mkdirSync(join(dir, "character"), { recursive: true });
  const files: Record<string, string> = {
    [join("character", "vera.json")]: JSON.stringify(card("vera")),
    [join("character", "nuit.json")]: JSON.stringify(card("nuit")),
    ["settings.json"]: '{"theme":"stage"}',
  };
  for (const [rel, text] of Object.entries(files)) writeFileSync(join(dir, rel), text);
  const snapshot = () => Object.fromEntries(Object.keys(files).map((rel) => [rel, readFileSync(join(dir, rel), "utf8")]));
  return { snapshot, before: snapshot() };
}

test("a plain folder is imported into the library, and the folder itself is left exactly as it was", async () => {
  const dir = studio();
  const folder = plainFolder(dir);
  const progress: number[] = [];
  const library = (await openLibrary(dir, { vault: fakeComputer(), onProgress: (done) => progress.push(done) }))!;
  opened.push(library);
  expect(library.state).toBe("unlocked");
  expect(progress).toEqual([1, 2]); // one step per piece; the settings document comes in beside them
  expect((await new StudioStore(dir).list()).map((e) => e.id).sort()).toEqual(["nuit", "vera"]);
  expect(folder.snapshot()).toEqual(folder.before);
  expect(existsSync(join(dir, COPYING_FILE))).toBe(false);
});

test("an imported folder's pieces are versioned in the library, and its settings come with them", async () => {
  const dir = studio();
  plainFolder(dir);
  const library = (await openLibrary(dir, { vault: fakeComputer() }))!;
  opened.push(library);
  const store = new StudioStore(dir);
  expect((await store.readVersioned("character", "vera"))?.version).toBe(1);
  expect((await new SettingsStore(dir).read()).theme).toBe("stage");
  expect((await store.save({ ...(card("vera") as object), body: { identity: { name: "vera", description: "edited" }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } }, { overwrite: true })).version).toBe(2);
});

test("too little free space refuses the import: the folder is unchanged, no library is left, and nothing runs on the folder", async () => {
  const dir = studio();
  const folder = plainFolder(dir);
  const refused = await openLibrary(dir, { vault: fakeComputer(), freeSpace: () => 10 }).catch((e: unknown) => e);
  expect(refused).toBeInstanceOf(ImportStoppedError);
  expect((refused as ImportStoppedError).code).toBe("no-room");
  expect(existsSync(join(dir, LIBRARY_FILE))).toBe(false);
  expect(existsSync(join(dir, COPYING_FILE))).toBe(false);
  expect(folder.snapshot()).toEqual(folder.before);
});

test("only pieces and the Studio's own documents are imported, pictures and exports stay put, and pieces with a stray byte or a UTF-16 save come across as the folder reads them", async () => {
  const dir = studio();
  const folder = plainFolder(dir);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00]);
  writeFileSync(join(dir, "character", "vera.png"), png);
  mkdirSync(join(dir, "exports"));
  writeFileSync(join(dir, "exports", "vera.json"), JSON.stringify(card("an-export")));
  // A hand-edited card with one Windows-1252 byte (0xE9, an e-acute) in it: not valid UTF-8, but the
  // Studio reads it anyway (the byte shows as a replacement character), so the copy must too.
  const cafe = Buffer.from(JSON.stringify(card("cafe")).replace('"name":"cafe"', '"name":"caf#"'), "utf8");
  cafe[cafe.indexOf("#")] = 0xe9;
  writeFileSync(join(dir, "character", "cafe.json"), cafe);
  // Windows Notepad's "Unicode" save: UTF-16LE with its byte-order mark. The Studio reads it.
  writeFileSync(join(dir, "character", "notepad.json"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(JSON.stringify(card("notepad")), "utf16le")]));
  const read = await readStudioFolder(dir);
  const shownBefore = read.pieces.find((p) => p.entity.id === "cafe")?.entity.body;
  const notepadBefore = read.pieces.find((p) => p.entity.id === "notepad")?.entity.body;
  expect(shownBefore).toBeDefined();
  expect(notepadBefore).toBeDefined();

  const library = (await openLibrary(dir, { vault: fakeComputer() }))!;
  opened.push(library);
  expect(library.imported).toEqual({ pieces: 4, renamed: [], damaged: [], leftInFolder: 2 });
  expect((await new StudioStore(dir).list()).map((e) => e.id).sort()).toEqual(["cafe", "notepad", "nuit", "vera"]);
  expect((await new StudioStore(dir).read("character", "cafe"))?.body).toEqual(shownBefore!);
  expect((await new StudioStore(dir).read("character", "notepad"))?.body).toEqual(notepadBefore!);
  expect(folder.snapshot()).toEqual(folder.before);
  expect(readFileSync(join(dir, "character", "vera.png"))).toEqual(png);
});

test("an import interrupted earlier is thrown away and done again", async () => {
  const dir = studio();
  plainFolder(dir);
  writeFileSync(join(dir, COPYING_FILE), "half a library from an import that was killed");
  const library = (await openLibrary(dir, { vault: fakeComputer() }))!;
  opened.push(library);
  expect((await new StudioStore(dir).list()).map((e) => e.id).sort()).toEqual(["nuit", "vera"]);
});

test("Kit's old transcript files are copied in once, sealed, and a transcript deleted later stays deleted", async () => {
  const dir = studio();
  const sessionsDir = join(dir, "..", "sessions");
  mkdirSync(sessionsDir, { recursive: true });
  const transcript = { version: 1, id: "s1", title: "moonlit harbor transcript", createdAt: 1, updatedAt: 2, parent: null, turns: [], rail: null };
  writeFileSync(join(sessionsDir, "s1.json"), JSON.stringify(transcript));
  const here = fakeComputer();
  const first = (await openLibrary(dir, { vault: here, sessionsDir }))!;
  const kit = createSessionStore();
  expect((await kit.read("s1"))?.title).toBe("moonlit harbor transcript");
  for (const file of [LIBRARY_FILE, `${LIBRARY_FILE}-wal`].map((n) => join(dir, n)).filter(existsSync)) {
    expect(readFileSync(file).includes(Buffer.from("moonlit harbor"))).toBe(false);
  }
  expect(readFileSync(join(sessionsDir, "s1.json"), "utf8")).toBe(JSON.stringify(transcript));
  expect(await kit.remove("s1")).toBe(true);
  first.close();
  const again = (await openLibrary(dir, { vault: here, sessionsDir }))!;
  opened.push(again);
  expect(await createSessionStore().read("s1")).toBeNull();
});

test("a failed session import releases the partially opened library and its derived-cache lease", async () => {
  const dir = studio();
  const vault = fakeComputer();
  const initial = await openLibrary(dir, { vault, skipOpenMaintenance: true });
  initial.close();
  const db = new Database(join(dir, LIBRARY_FILE));
  db.run("CREATE TRIGGER fail_kit_session_insert BEFORE INSERT ON kit_sessions BEGIN SELECT RAISE(ABORT, 'fixture failure'); END");
  db.close();
  const sessionsDir = join(dir, "..", "sessions");
  mkdirSync(sessionsDir, { recursive: true });
  const transcript = { version: 1, id: "s1", title: "failed open", createdAt: 1, updatedAt: 2, parent: null, turns: [], rail: null };
  writeFileSync(join(sessionsDir, "s1.json"), JSON.stringify(transcript));

  const failure = await openLibrary(dir, { vault, sessionsDir }).then(() => null, (error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  const repair = new Database(join(dir, LIBRARY_FILE));
  repair.run("DROP TRIGGER fail_kit_session_insert");
  repair.close();

  __resetTokenCacheForTests();
  const reopened = await openLibrary(dir, { vault });
  opened.push(reopened);
  countText("partial open must not retain a derived-cache lease");
  countText("partial open must not retain a derived-cache lease");
  expect(__tokenCacheStatsForTests().realEncodes).toBe(1);
});

test("opening the library empties the Trash of scenes deleted more than 3 days ago, and keeps newer ones", async () => {
  const dir = studio();
  const vault = fakeComputer();
  const DAY = 24 * 60 * 60 * 1000;
  const start = Date.now();
  const cut = async (title: string) => {
    const chats = libraryChatsFor(dir)!;
    const chat = await chats.createChat({ title, cast: { character: { id: "vera", version: 1 } }, snapshot: { character: {} } });
    await chats.deleteChat(chat.id);
  };
  const first = (await openLibrary(dir, { vault }))!;
  await cut("Old");
  first.close();
  try {
    setSystemTime(new Date(start + 2 * DAY));
    const second = (await openLibrary(dir, { vault }))!;
    await cut("Recent");
    second.close();
    setSystemTime(new Date(start + 4 * DAY));
    opened.push((await openLibrary(dir, { vault }))!);
    expect((await libraryChatsFor(dir)!.chatGraveyard()).chats.map((c) => c.title)).toEqual(["Recent"]);
  } finally {
    setSystemTime();
  }
});

test("a Trash purge that fails is logged and the other purge still runs, so the library opens", async () => {
  let scenesPurged = false;
  const stores = {
    content: { purge: () => Promise.reject(new Error("cipher failed")) },
    chats: { purgeChats: () => { scenesPurged = true; return Promise.resolve(0); } },
  } as unknown as LibraryStores;
  const quiet = console.error;
  console.error = () => {};
  try {
    await emptyTrash(stores);
  } finally {
    console.error = quiet;
  }
  expect(scenesPurged).toBe(true);
});

test("opening the library purges a message cut more than 1 day ago, keeps a newer cut, and still keeps a 2-day-old deleted scene", async () => {
  const dir = studio();
  const vault = fakeComputer();
  const DAY = 24 * 60 * 60 * 1000;
  const start = Date.now();
  const first = (await openLibrary(dir, { vault }))!;
  const chats = libraryChatsFor(dir)!;
  const chat = await chats.createChat({ title: "Live", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: {} } });
  const gone = await chats.createChat({ title: "Deleted two days ago", cast: { character: { id: "vera", version: 1 } }, snapshot: { character: {} } });
  const old = await chats.appendMessage(chat.activeBranchId, { role: "user", content: "cut long ago" });
  const fresh = await chats.appendMessage(chat.activeBranchId, { role: "user", content: "cut lately" });
  await chats.cutMessages(chat.activeBranchId, old!.id, "one");
  first.close();
  try {
    setSystemTime(new Date(start + 1.5 * DAY));
    const second = (await openLibrary(dir, { vault }))!;
    await libraryChatsFor(dir)!.cutMessages(chat.activeBranchId, fresh!.id, "one");
    await libraryChatsFor(dir)!.deleteChat(gone.id);
    second.close();
    setSystemTime(new Date(start + 2.5 * DAY));
    opened.push((await openLibrary(dir, { vault }))!);
    const kept = (await libraryChatsFor(dir)!.readMessages(chat.activeBranchId, { limit: 10 })).messages;
    expect(kept.map((m) => m.swipes[0]!.content)).toEqual(["cut lately"]);
    expect((await libraryChatsFor(dir)!.chatGraveyard()).chats.map((c) => c.title)).toEqual(["Deleted two days ago"]);
  } finally {
    setSystemTime();
  }
});
