/**
 * `bunzai export` (cli-export.ts) end to end on throwaway studios with a fake computer vault, never
 * the real keychain: it exports an existing library, never makes one where there is none, and
 * refuses a library that needs its password, writing nothing either way.
 */
import { afterEach, expect, spyOn, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CANONICAL_SCHEMA_VERSION } from "./core/canonical";
import { fakeComputer } from "./stage/crypto/fake-device-vault";
import { fastPasswords } from "./stage/crypto/fake-password-lock";
import { LIBRARY_FILE } from "./studio/fs-backend";
import { openLibrary } from "./ui/library-root";
import { runExport } from "./cli-export";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const temp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "bunzai-cli-export-"));
  dirs.push(d);
  return d;
};
const card = (id: string) =>
  JSON.stringify({ schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "character", id, body: { identity: { name: id }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } });
const quiet = () => [spyOn(console, "log").mockImplementation(() => {}), spyOn(console, "error").mockImplementation(() => {})];

test("exports an existing library as a plain folder the import reads", async () => {
  const base = temp();
  const studio = join(base, "studio");
  mkdirSync(join(studio, "character"), { recursive: true });
  for (const id of ["vera", "nuit"]) writeFileSync(join(studio, "character", `${id}.json`), card(id));
  const vault = fakeComputer();
  const opts = { vault, sessionsDir: join(base, "sessions") };
  (await openLibrary(studio, opts)).close();

  const spies = quiet();
  const out = join(base, "out");
  expect(await runExport(out, studio, opts)).toBe(0);
  for (const s of spies) s.mockRestore();
  expect(readdirSync(join(out, "character")).sort()).toEqual(["nuit.json", "vera.json"]);
  expect(JSON.parse(readFileSync(join(out, "character", "vera.json"), "utf8"))).toMatchObject({ kind: "character", id: "vera" });
});

test("never makes a library where there is none, and writes nothing", async () => {
  const base = temp();
  const spies = quiet();
  expect(await runExport(join(base, "out"), join(base, "empty-studio"), { vault: fakeComputer() })).toBe(1);
  for (const s of spies) s.mockRestore();
  expect(existsSync(join(base, "empty-studio", LIBRARY_FILE))).toBe(false);
  expect(existsSync(join(base, "out"))).toBe(false);
});

test("a library that needs its password is refused, and nothing is written", async () => {
  const base = temp();
  const studio = join(base, "studio");
  const vault = fakeComputer();
  const opts = { vault, sessionsDir: join(base, "sessions"), keyring: { passwords: fastPasswords() } };
  const first = await openLibrary(studio, opts);
  await first.keyring.confirmWords(first.keyring.beginWords());
  await first.keyring.setPassword("moonlit harbor", { mode: "each-open" });
  first.close();

  const spies = quiet();
  expect(await runExport(join(base, "out"), studio, opts)).toBe(1);
  for (const s of spies) s.mockRestore();
  expect(existsSync(join(base, "out"))).toBe(false);
});
