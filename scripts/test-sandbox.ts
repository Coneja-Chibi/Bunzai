/**
 * The test sandbox, preloaded before every `bun test` run (bunfig.toml): every place Bunraku keeps
 * per-user files points at one throwaway folder, so no test can write into the person's real home
 * or read their real credentials (a keyring test once left a real ~/.bunraku/computer-id behind).
 *
 * HOME and USERPROFILE are left alone, because child processes (PowerShell for DPAPI, git) need the
 * real profile. So the run also watches the real locations: a new entry in ~/.bunraku or the real
 * app-data folder, or a default studio folder that did not exist before, fails the run and names it.
 * The real Studio app running at the same time can cause a false alarm; rerun with it closed.
 */
import { afterAll } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { appDataDir } from "../src/app-data";

// Read the real locations before pointing anything elsewhere.
const realBunraku = join(process.env["BUNRAKU_HOME"] ?? homedir(), ".bunraku");
const realAppData = appDataDir();
const realStudio = join(homedir(), "Documents", "Bunraku Studio");
const entries = (dir: string) => (existsSync(dir) ? new Set(readdirSync(dir)) : new Set<string>());
const before = { bunraku: entries(realBunraku), appData: entries(realAppData), studio: existsSync(realStudio) };

const sandbox = mkdtempSync(join(tmpdir(), "bunraku-test-home-"));
const inSandbox = (name: string) => {
  const dir = join(sandbox, name);
  mkdirSync(dir, { recursive: true });
  return dir;
};
process.env["BUNRAKU_HOME"] = inSandbox("home");
process.env["CODEX_HOME"] = inSandbox("codex");
process.env["CLAUDE_CONFIG_DIR"] = inSandbox("claude");
process.env["LOCALAPPDATA"] = inSandbox("local-app-data");
process.env["XDG_STATE_HOME"] = inSandbox("xdg-state");

/**
 * Every Studio test runs on the encrypted database, as the app does (plan phase 1 exit bar): each
 * studio folder a test uses gets its own throwaway SQLite library under the sandbox, with a fresh
 * key, holding its pieces and the Studio's own documents. Tests that open a library themselves
 * register theirs on top, and the newest wins.
 */
{
  const { createHash } = await import("node:crypto");
  const { resolve } = await import("node:path");
  const { cellCipher } = await import("../src/stage/crypto/cell-cipher");
  const { newDataKey, subkeys } = await import("../src/stage/crypto/crypto");
  const { openStageDatabase } = await import("../src/stage/store/sqlite/database");
  const { MIGRATIONS } = await import("../src/stage/store/sqlite/migrations");
  const { createContentStore } = await import("../src/stage/store/content-store");
  const { sqliteDocumentBackend } = await import("../src/stage/store/sqlite/document-backend");
  const { sqliteStateStore } = await import("../src/stage/store/sqlite/state-store");
  const { sqliteChatStore } = await import("../src/stage/store/sqlite-chat-store");
  const { addLibrary } = await import("../src/studio/library-content");
  type Stores = import("../src/studio/library-content").LibraryStores;
  const libraries = new Map<string, { stores: Stores; close: () => void }>();
  const folder = inSandbox("libraries");
  // Never removed: tests that add their own libraries remove only theirs, so this stays underneath.
  addLibrary((root) => {
    const at = resolve(root);
    let library = libraries.get(at);
    if (!library) {
      const database = openStageDatabase(join(folder, `${createHash("sha256").update(at).digest("hex").slice(0, 16)}.db`), MIGRATIONS);
      const keys = subkeys(newDataKey());
      const cipher = cellCipher(() => keys);
      library = {
        stores: {
          content: createContentStore(sqliteDocumentBackend(database, cipher)),
          state: sqliteStateStore(database, cipher),
          chats: sqliteChatStore(database, cipher),
        },
        close: () => database.close(),
      };
      libraries.set(at, library);
    }
    return library.stores;
  });
  afterAll(() => {
    for (const library of libraries.values()) library.close();
  });
}

/** What a test run added to the person's real folders; empty when the sandbox held. */
function breaches(): string[] {
  const added = (dir: string, was: Set<string>) => [...entries(dir)].filter((name) => !was.has(name)).map((name) => join(dir, name));
  const found = [...added(realBunraku, before.bunraku), ...added(realAppData, before.appData)];
  if (!before.studio && existsSync(realStudio)) found.push(realStudio);
  return found;
}

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
  const found = breaches();
  if (found.length > 0) {
    throw new Error(
      `test sandbox: the run wrote into the real home folder: ${found.join(", ")}. ` +
        "Point the test at a temporary folder; the preload already sets BUNRAKU_HOME, CODEX_HOME, CLAUDE_CONFIG_DIR, LOCALAPPDATA, and XDG_STATE_HOME.",
    );
  }
});
