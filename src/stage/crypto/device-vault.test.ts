/**
 * The keyring's device vault over the real key vault on this machine: whatever backend the vault
 * picks here, a sealed data key opens again; the lock is read from the sealed copy itself; and the
 * computer id stays put through a vault failure, while a new copy on a folder from another computer
 * gets a fresh one. Runs in a temporary BUNZAI_HOME, never the person's real one.
 */
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { activeBackendId } from "../../kit/keystore/keystore";
import { keystoreDeviceVault } from "./device-vault";

let home = "";
const saved = process.env["BUNZAI_HOME"];
beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), "bunzai-devicevault-"));
  process.env["BUNZAI_HOME"] = home;
});
afterAll(() => {
  if (saved === undefined) delete process.env["BUNZAI_HOME"];
  else process.env["BUNZAI_HOME"] = saved;
  rmSync(home, { recursive: true, force: true });
});

test("seals through the real vault and opens again", async () => {
  const sealed = await keystoreDeviceVault.seal("a data key in base64");
  expect(sealed).not.toContain("a data key in base64");
  expect(await keystoreDeviceVault.open(sealed)).toBe("a data key in base64");
}, 30_000);

test("the lock is the one recorded on the copy, and a key-file copy is weak", async () => {
  const sealed = await keystoreDeviceVault.seal("x");
  expect(keystoreDeviceVault.lockOf(sealed).lock).toBe(await activeBackendId());
  const fileCopy = JSON.stringify({ v: 1, backend: "identity-file", payload: "..." });
  expect(keystoreDeviceVault.lockOf(fileCopy)).toEqual({ lock: "identity-file", weak: true });
  expect(await keystoreDeviceVault.strongerThan(fileCopy)).toBe((await activeBackendId()) !== "identity-file");
  expect(await keystoreDeviceVault.strongerThan(sealed)).toBe(false);
}, 30_000);

const idFile = () => join(home, ".bunzai", "computer-id");
/** A check no vault here can open: sealed on another computer, or a vault failing right now. */
const unopenable = { v: 1, backend: "not-on-this-computer", payload: "c29tZW9uZSBlbHNl" };

test("the computer id is stable", async () => {
  const id = await keystoreDeviceVault.computerId();
  expect(await keystoreDeviceVault.computerId()).toBe(id);
  expect(await keystoreDeviceVault.computerIdForNewCopy()).toBe(id);
}, 30_000);

test("a check that will not open never changes the id: a vault failing for a moment must not strand this computer's copy", async () => {
  const id = await keystoreDeviceVault.computerId();
  const damagedCheck = `${JSON.stringify({ id, check: unopenable })}\n`;
  writeFileSync(idFile(), damagedCheck);
  expect(await keystoreDeviceVault.computerId()).toBe(id);
  expect(readFileSync(idFile(), "utf8")).toBe(damagedCheck);
}, 30_000);

test("a new copy is written under a fresh id when the check will not open, so a copied folder never overwrites another computer's copy", async () => {
  const id = await keystoreDeviceVault.computerId();
  writeFileSync(idFile(), JSON.stringify({ id, check: unopenable }));
  const fresh = await keystoreDeviceVault.computerIdForNewCopy();
  expect(fresh).not.toBe(id);
  expect(await keystoreDeviceVault.computerId()).toBe(fresh);
}, 60_000);

test("a missing or unreadable id file gets a fresh id", async () => {
  const id = await keystoreDeviceVault.computerId();
  writeFileSync(idFile(), "not json");
  const fresh = await keystoreDeviceVault.computerId();
  expect(fresh).not.toBe(id);
  rmSync(idFile());
  expect(await keystoreDeviceVault.computerId()).not.toBe(fresh);
}, 60_000);
