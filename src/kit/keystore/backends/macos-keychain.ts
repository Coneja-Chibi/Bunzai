/**
 * macOS Keychain keystore backend: the vault key, and the marker that one was made, live in the
 * login keychain as generic password items, through Apple's `security` tool. Writing goes through
 * `security -i`, which reads its commands from stdin, so the key never appears in a process listing.
 * The items trust `/usr/bin/security`, so any process running as this user can read the key without
 * a prompt: the same trust level as DPAPI on Windows, and stated as such in the security reference.
 */
import { keychainKeyBackend, type Item, type KeyStoreTool } from "./keychain-key";

const SERVICE = "bunraku-kit";
const ACCOUNT: Record<Item, string> = { key: "vault-key", marker: "vault-key-made" };
/** `security` exits 44 when the item does not exist, and 45 when adding one that already does. */
const NOT_FOUND = 44;
const DUPLICATE = 45;

export const macosKeychainTool: KeyStoreTool = {
  platform: "darwin",
  async read(run, item) {
    const r = await run("security", ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT[item], "-w"]);
    if (r.code === NOT_FOUND) return null;
    if (r.code !== 0) throw new Error(`keystore: security find-generic-password exited ${r.code}: ${r.stderr.trim()}`);
    return r.stdout.trim();
  },
  async create(run, item, value) {
    // No -U: an existing item is never replaced; it is reported, and the caller reads that one.
    const r = await run("security", ["-i"], `add-generic-password -s ${SERVICE} -a ${ACCOUNT[item]} -w ${value}\n`);
    if (r.code === DUPLICATE || /already exists/i.test(r.stderr)) return "exists";
    if (r.code !== 0) throw new Error(`keystore: security add-generic-password exited ${r.code}: ${r.stderr.trim()}`);
    return "created";
  },
};

export const macosKeychainBackend = keychainKeyBackend("macos-keychain", "macOS Keychain", macosKeychainTool);
