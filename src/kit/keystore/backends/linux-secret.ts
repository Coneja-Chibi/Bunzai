/**
 * Linux Secret Service keystore backend: the vault key, and the marker that one was made, live in
 * the desktop keyring (GNOME Keyring, KWallet, KeePassXC) through `secret-tool` from libsecret.
 * `secret-tool store` reads the secret from stdin, so the key never appears in a process listing. A
 * headless box with no secret service makes the read fail, and the registry falls through to the
 * next backend.
 */
import { keychainKeyBackend, type Item, type KeyStoreTool } from "./keychain-key";
import { keychainAddress } from "./keychain-address";

/** A diagnostic may use its own service without sharing the application's vault entries. */
export function linuxSecretToolFor(namespace?: string): KeyStoreTool {
  const { service, accounts } = keychainAddress(namespace);
  const attributes = (item: Item) => ["service", service, "account", accounts[item]] as const;
  return {
    platform: "linux",
    async read(run, item) {
      const r = await run("secret-tool", ["lookup", ...attributes(item)]);
      // `lookup` exits 1 with no output when nothing matches; any stderr means the service failed. A
      // locked keyring may also answer this way, which is why keychain-key.ts proves the store is
      // writable, and checks the marker, before it ever makes a key.
      if (r.code === 1 && r.stdout === "" && r.stderr.trim() === "") return null;
      if (r.code !== 0) throw new Error(`keystore: secret-tool lookup exited ${r.code}: ${r.stderr.trim()}`);
      return r.stdout.trim();
    },
    async create(run, item, value) {
      // `store` replaces silently, so this runs only under the shared lock file, after a fresh read
      // found nothing (keychain-key.ts).
      const r = await run("secret-tool", ["store", `--label=Bunzai vault ${item}`, ...attributes(item)], value);
      if (r.code !== 0) throw new Error(`keystore: secret-tool store exited ${r.code}: ${r.stderr.trim()}`);
      return "created";
    },
  };
}

export const linuxSecretTool = linuxSecretToolFor();

export const linuxSecretBackend = keychainKeyBackend("linux-secret", "Linux keyring (Secret Service)", linuxSecretTool);
