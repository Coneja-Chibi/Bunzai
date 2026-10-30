/**
 * Runs the macOS Keychain or Linux Secret Service keystore backend against the REAL tool on this
 * machine (CI's keychain job), because the unit tests only prove it against fakes. Checks: the
 * backend is available; two first-time seals at once both open (one key, not two); a second
 * instance, as a second process would be, opens them too; and the real tool's "not found" answer is
 * the one the backend expects. Prints what it observed and exits non-zero on any failure.
 *
 * Run: bun scripts/probe-keychain.ts   (on macOS, or Linux inside a D-Bus session with a keyring)
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { keychainKeyBackend, spawnRunner, type KeyStoreTool } from "../src/kit/keystore/backends/keychain-key";
import { linuxSecretToolFor } from "../src/kit/keystore/backends/linux-secret";
import { macosKeychainToolFor } from "../src/kit/keystore/backends/macos-keychain";
import { keychainAddress } from "../src/kit/keystore/backends/keychain-address";
import { toErrorMessage } from "../src/error-message";

const address = keychainAddress(`bunzai-keychain-probe-${randomUUID()}`);
const tool: KeyStoreTool | null = process.platform === "darwin" ? macosKeychainToolFor(address.service) : process.platform === "linux" ? linuxSecretToolFor(address.service) : null;
if (!tool) {
  console.log(`probe-keychain: nothing to probe on ${process.platform}`);
  process.exit(0);
}

const home = mkdtempSync(join(tmpdir(), "bunzai-keychain-probe-"));
const failures: string[] = [];
const check = async (name: string, fn: () => Promise<string>) => {
  try {
    console.log(`ok   ${name}: ${await fn()}`);
  } catch (error) {
    failures.push(name);
    console.log(`FAIL ${name}: ${toErrorMessage(error)}`);
  }
};

/** Removes only this invocation's isolated probe entries. */
const forget = async () => {
  const errors: string[] = [];
  for (const account of Object.values(address.accounts)) {
    try {
      const result = process.platform === "darwin"
        ? await spawnRunner("security", ["delete-generic-password", "-s", address.service, "-a", account])
        : await spawnRunner("secret-tool", ["clear", "service", address.service, "account", account]);
      const missing = process.platform === "darwin" ? result.code === 44 : result.code === 1 && result.stderr.trim() === "";
      if (result.code !== 0 && !missing) throw new Error(`cleanup of ${account} exited ${result.code}: ${result.stderr.trim()}`);
    } catch (error) {
      errors.push(toErrorMessage(error));
    }
  }
  if (errors.length) throw new Error(errors.join("; "));
};

try {
  await forget();
  await check("the real tool's 'not found' is read as no key", async () => {
    const value = await tool.read(spawnRunner, "key");
    if (value !== null) throw new Error(`expected no key, read ${value.length} characters`);
    return "no key";
  });
  const first = keychainKeyBackend(address.service, "probe", tool, { home });
  await check("available on this machine", async () => {
    if (!(await first.available())) throw new Error("the backend says it is unavailable");
    return "yes";
  });
  const sealed: string[] = [];
  await check("two first-time seals at once both open", async () => {
    sealed.push(...(await Promise.all([first.seal("one", {}), first.seal("two", {})])));
    const opened = await Promise.all(sealed.map((s) => first.open(s, {})));
    if (opened.join(",") !== "one,two") throw new Error(`opened ${opened.join(",")}`);
    return "one key";
  });
  await check("a second instance, like a second process, opens them", async () => {
    const second = keychainKeyBackend(address.service, "probe", tool, { home });
    const opened = await Promise.all(sealed.map((s) => second.open(s, {})));
    if (opened.join(",") !== "one,two") throw new Error(`opened ${opened.join(",")}`);
    return "yes";
  });
} finally {
  try {
    await check("remove this probe's keychain entries", async () => { await forget(); return "removed"; });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  console.log(`probe-keychain: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("probe-keychain: every check passed");
