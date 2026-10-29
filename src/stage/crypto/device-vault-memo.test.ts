/**
 * The device vault's computer-id memo: a boot or the gate's 15 s status poll must not repeat the DPAPI (or keychain) round
 * trip when the id file has not changed since the last check. The memo is keyed on the id file's exact
 * contents, not on unlock or on mtime and size, so a real change - this computer enrolling, or a
 * folder copied in from another computer - is still caught and never answered with a stale id. Runs
 * against the real vault backend (whatever this machine has), with `seal`/`open` counted through a
 * module mock so a false cache hit shows up as a missing round trip, not just a wrong id.
 */
import { afterAll, beforeAll, beforeEach, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Sealed } from "../../kit/keystore/types";

let sealCalls = 0;
let openCalls = 0;

// Counts every real vault round trip while behaving exactly like ../../kit/keystore/keystore.ts, so
// device-vault.ts sees the same seal/open contract it always does.
mock.module("../../kit/keystore/keystore", () => {
  // Imported inside the factory: registry.ts is a different specifier, so it is never intercepted.
  const { backendById, pickBackend } = require("../../kit/keystore/registry") as typeof import("../../kit/keystore/registry");
  return {
    async seal(plaintext: string, unlock: Record<string, unknown> = {}): Promise<Sealed> {
      sealCalls++;
      const backend = await pickBackend();
      const payload = await backend.seal(plaintext, unlock);
      return { v: 1, backend: backend.id, payload };
    },
    async open(sealed: Sealed, unlock: Record<string, unknown> = {}): Promise<string> {
      openCalls++;
      const backend = backendById(sealed.backend);
      if (!backend) throw new Error(`keystore: no backend '${sealed.backend}' to open this vault`);
      return backend.open(sealed.payload, unlock);
    },
    async activeBackendId(): Promise<string> {
      return (await pickBackend()).id;
    },
  };
});

let home = "";
const saved = process.env["BUNZAI_HOME"];
const idFile = () => join(home, ".bunzai", "computer-id");

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "bunzai-devicevault-memo-"));
  process.env["BUNZAI_HOME"] = home;
});
afterAll(() => {
  if (saved === undefined) delete process.env["BUNZAI_HOME"];
  else process.env["BUNZAI_HOME"] = saved;
  rmSync(home, { recursive: true, force: true });
});
beforeEach(() => {
  sealCalls = 0;
  openCalls = 0;
});

test("repeated status polls do one vault round trip, not one per poll", async () => {
  const { keystoreDeviceVault } = await import("./device-vault");
  const id = await keystoreDeviceVault.computerId(); // first call: writes the file (a seal, no open)
  expect(sealCalls).toBe(1);
  expect(openCalls).toBe(0);

  sealCalls = 0;
  openCalls = 0;
  // Five more calls, as the gate's 15 s poll (and Settings, Security's status read) would make.
  for (let i = 0; i < 5; i++) expect(await keystoreDeviceVault.computerId()).toBe(id);
  expect(sealCalls).toBe(0);
  expect(openCalls).toBe(0);
}, 30_000);

test("a real change to the id file - a folder copied in from another computer - is never answered with the stale id", async () => {
  const { keystoreDeviceVault } = await import("./device-vault");
  const { seal } = (await import("../../kit/keystore/keystore")) as { seal: (t: string) => Promise<Sealed> };

  const id1 = await keystoreDeviceVault.computerId();
  expect(await keystoreDeviceVault.computerId()).toBe(id1); // memoized: no round trip below proves it

  const callsBeforeCopy = openCalls;
  // The file still names id1, but its check now opens to something else entirely: exactly what a
  // folder copied in from another computer looks like on disk.
  const foreignCheck = await seal("not-the-id-on-file");
  writeFileSync(idFile(), `${JSON.stringify({ id: id1, check: foreignCheck })}\n`);

  const id2 = await keystoreDeviceVault.computerId();
  expect(id2).not.toBe(id1); // never a stale "still enrolled as id1" answer after the real change
  expect(openCalls).toBeGreaterThan(callsBeforeCopy); // the check really ran again, not a false hit

  // The fresh id is memoized in its own turn.
  const callsAfterMint = openCalls;
  expect(await keystoreDeviceVault.computerId()).toBe(id2);
  expect(openCalls).toBe(callsAfterMint);
}, 30_000);

test("a same-size swap that keeps the old mtime is still caught (contents, not stat, key the memo)", async () => {
  const { keystoreDeviceVault } = await import("./device-vault");
  const { seal } = (await import("../../kit/keystore/keystore")) as { seal: (t: string) => Promise<Sealed> };

  const id1 = await keystoreDeviceVault.computerId();
  const before = statSync(idFile());
  // A foreign check sealed over a string the same length as the id, so the file keeps its size, and
  // the mtime put back the way a sync tool or a coarse filesystem would leave it.
  const foreignCheck = await seal("x".repeat(id1.length));
  const swapped = `${JSON.stringify({ id: id1, check: foreignCheck })}\n`;
  writeFileSync(idFile(), swapped);
  utimesSync(idFile(), before.atime, before.mtime);
  expect(readFileSync(idFile(), "utf8")).toBe(swapped);

  const callsBefore = openCalls;
  const id2 = await keystoreDeviceVault.computerId();
  expect(openCalls).toBeGreaterThan(callsBefore); // re-checked, not a stat-based false hit
  expect(id2).not.toBe(id1);
}, 30_000);
