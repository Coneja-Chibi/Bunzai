/**
 * What happens to a vault whose key file was destroyed.
 *
 * THE RULE THIS PINS: a user must never be permanently unable to save a provider. The first version
 * of the identity backend refused to continue past a damaged key file, reasoning that replacing it
 * would destroy an existing vault. That was backwards - a file failing its integrity check is
 * holding a key that is already gone, so the vault was unopenable either way, and refusing only
 * meant every future save failed too. These tests hold the corrected behaviour: recover, preserve
 * both files, and say so out loud.
 *
 * The counterpart matters just as much: a vault that fails for any OTHER reason is still
 * recoverable by the right caller and must NOT be swept aside.
 *
 * The vault here is sealed through identityFileBackend DIRECTLY rather than through saveProvider,
 * because seal() picks the strongest backend for the host and on Windows that is DPAPI - which
 * would leave this suite silently testing nothing on the maintainer's own machine.
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { identityFileBackend } from "../keystore/backends/identity-file";

let home = "";
let priorHome: string | undefined;

beforeEach(async () => {
  priorHome = process.env["BUNZAI_HOME"];
  home = await mkdtemp(join(tmpdir(), "kit-vault-recovery-"));
  process.env["BUNZAI_HOME"] = home;
});

afterEach(async () => {
  if (priorHome === undefined) delete process.env["BUNZAI_HOME"];
  else process.env["BUNZAI_HOME"] = priorHome;
  await rm(home, { recursive: true, force: true });
});

/** Fresh module instances, so the vault's in-memory cache never hides a re-read. */
async function freshVault(): Promise<typeof import("./vault")> {
  const url = `./vault?recovery=${Math.random().toString(36).slice(2)}`;
  return import(url) as Promise<typeof import("./vault")>;
}

const dir = (): string => join(home, ".bunzai");
const KEY_PATH = (): string => join(dir(), "kit.identity");
const VAULT_PATH = (): string => join(dir(), "kit-vault.json");

const DAMAGED = (): Buffer => {
  const file = Buffer.alloc(104); // valid header, garbage body: the HMAC cannot verify
  Buffer.from([0x89, 0x48, 0x4c, 0x4b]).copy(file, 0);
  file[4] = 0x01;
  return file;
};

/** Seal a vault under the identity-file backend, creating that key file as a side effect. */
async function seedIdentityVault(apiKey: string): Promise<void> {
  await seedIdentityVaultBody({ providers: [{ id: "p1", kind: "anthropic", model: "m", apiKey }], activeId: "p1" });
}

async function seedIdentityVaultBody(body: unknown): Promise<void> {
  const payload = await identityFileBackend.seal(JSON.stringify(body), {});
  await mkdir(dir(), { recursive: true });
  await writeFile(VAULT_PATH(), `${JSON.stringify({ v: 1, backend: "identity-file", payload })}\n`);
}

test("a destroyed key file does not lock the user out of saving again", async () => {
  await seedIdentityVault("sk-original");
  await writeFile(KEY_PATH(), DAMAGED());

  const kit = await freshVault();
  const vault = await kit.readVault();

  // Not a throw, and not a silent empty: an explained empty.
  expect(vault.providers).toEqual([]);
  expect(vault.notice).toContain("key file was damaged");
  expect(vault.notice).toContain("Neither file was deleted");

  // And the whole point: saving works immediately afterwards.
  const saved = await kit.saveProvider({ kind: "openai", model: "gpt-4o", apiKey: "sk-replacement" });
  const reread = await kit.readVault();
  expect(reread.providers.map((p) => p.apiKey)).toEqual(["sk-replacement"]);
  expect(saved.id).toBeDefined();
  expect(reread.activeId).toBe(saved.id!);
});

test("both the dead key and the dead vault are preserved, never deleted", async () => {
  await seedIdentityVault("sk-original");
  const originalVaultBytes = await readFile(VAULT_PATH());
  const damaged = DAMAGED();
  await writeFile(KEY_PATH(), damaged);

  await (await freshVault()).readVault();

  const files = await readdir(dir());
  const quarantinedKey = files.find((f) => f.includes(".damaged-"));
  const quarantinedVault = files.find((f) => f.includes(".unopenable-"));
  expect(quarantinedKey).toBeDefined();
  expect(quarantinedVault).toBeDefined();

  // Byte-for-byte, so a determined recovery from the originals stays possible.
  expect((await readFile(join(dir(), quarantinedKey!))).equals(damaged)).toBe(true);
  expect((await readFile(join(dir(), quarantinedVault!))).equals(originalVaultBytes)).toBe(true);
});

test("an unopenable vault whose key is FINE is never swept aside", async () => {
  // Tampered ciphertext with a healthy key file: the data may still be recoverable and the failure
  // is not ours to discard. This must throw, and must leave the vault file exactly where it is.
  await seedIdentityVault("sk-original");

  const sealed = JSON.parse(await readFile(VAULT_PATH(), "utf8")) as { payload: string };
  const parts = JSON.parse(Buffer.from(sealed.payload, "base64").toString("utf8")) as { ct: string };
  const ct = Buffer.from(parts.ct, "base64");
  ct[0] = ct[0]! ^ 0xff;
  const tampered = {
    ...sealed,
    payload: Buffer.from(JSON.stringify({ ...parts, ct: ct.toString("base64") })).toString("base64"),
  };
  await writeFile(VAULT_PATH(), JSON.stringify(tampered));

  const kit = await freshVault();
  await expect(kit.readVault()).rejects.toThrow();

  const files = await readdir(dir());
  expect(files.some((f) => f.includes(".unopenable-"))).toBe(false);
  expect(JSON.parse(await readFile(VAULT_PATH(), "utf8"))).toEqual(tampered);
});

test("the notice survives a later save, so it is not lost before anyone reads it", async () => {
  // Recovery can be triggered by any caller, including a provider-backed turn resolving its config.
  // writeVault replaces the cached Vault wholesale, so a notice carried only on that one object
  // could be overwritten before the user ever opened settings.
  await seedIdentityVault("sk-original");
  await writeFile(KEY_PATH(), DAMAGED());

  const kit = await freshVault();
  expect((await kit.readVault()).notice).toContain("key file was damaged");

  await kit.saveProvider({ kind: "openai", model: "gpt-4o", apiKey: "sk-new" });
  expect((await kit.readVault()).notice).toContain("key file was damaged");
});

test("a recovery triggered by resolveProviderConfig is still reported to a later reader", async () => {
  await seedIdentityVault("sk-original");
  await writeFile(KEY_PATH(), DAMAGED());

  const kit = await freshVault();
  await kit.resolveProviderConfig(); // the path a turn takes, not the settings screen
  expect((await kit.readVault()).notice).toContain("key file was damaged");
});

test("a healthy vault reports no notice and keeps its providers", async () => {
  await seedIdentityVault("sk-fine");
  const vault = await (await freshVault()).readVault();
  expect(vault.notice).toBeUndefined();
  expect(vault.providers.map((p) => p.apiKey)).toEqual(["sk-fine"]);
});

for (const [name, bytes] of [
  ["truncated JSON", "{\"v\":1"],
  ["an invalid envelope", JSON.stringify({ v: 2, backend: "identity-file", payload: "kept-for-recovery" })],
  ["a missing envelope", "null"],
] as const) {
  test(`a present vault with ${name} refuses reads and saves without replacing its bytes`, async () => {
    await mkdir(dir(), { recursive: true });
    await writeFile(VAULT_PATH(), bytes);
    const kit = await freshVault();
    await expect(kit.readVault()).rejects.toThrow(/vault/i);
    await expect(kit.saveProvider({ kind: "local", model: "fixture" })).rejects.toThrow(/vault/i);
    expect(await readFile(VAULT_PATH(), "utf8")).toBe(bytes);
  });
}

test("a vault read error is not treated as a new empty vault", async () => {
  await mkdir(VAULT_PATH(), { recursive: true });
  const kit = await freshVault();
  await expect(kit.readVault()).rejects.toThrow(/vault/i);
  await expect(kit.saveProvider({ kind: "local", model: "fixture" })).rejects.toThrow(/vault/i);
  expect(await readdir(VAULT_PATH())).toEqual([]);
});

for (const [name, body] of [
  ["an invalid decrypted object", null],
  ["a damaged provider beside a healthy provider", { providers: [{ kind: "local", model: "fixture" }, { apiKey: "recoverable-fixture" }], activeId: null }],
  ["a damaged Spotify link", { providers: [], activeId: null, spotify: { refreshToken: 42 } }],
] as const) {
  test(`a vault containing ${name} refuses to discard data on a later save`, async () => {
    await seedIdentityVaultBody(body);
    const original = await readFile(VAULT_PATH(), "utf8");
    const kit = await freshVault();
    await expect(kit.readVault()).rejects.toThrow(/vault/i);
    await expect(kit.saveProvider({ kind: "local", model: "fixture" })).rejects.toThrow(/vault/i);
    expect(await readFile(VAULT_PATH(), "utf8")).toBe(original);
  });
}
