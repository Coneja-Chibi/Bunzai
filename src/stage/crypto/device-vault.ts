/**
 * The keyring's device vault in the app: Kit's key vault (src/kit/keystore), which seals
 * with the strongest lock this computer has (DPAPI, the macOS Keychain, the Linux keyring, or the
 * identity-file fallback) and opens by the tag it recorded, never by guessing.
 *
 * computerId() memoizes its answer against the id file's exact contents: the
 * vault round trip (about 350 ms of DPAPI on Windows) reruns only when the file's bytes have changed,
 * so the gate's 15 s status poll and repeated calls in one request answer instantly. The file is about
 * 150 bytes, so reading and comparing it is microseconds. Contents, not mtime and size: a copied-in id
 * file from another computer has the same length and can keep its source mtime, and would slip past a
 * stat check. Any change of bytes reruns the full check (readIdFile, checkOf, possibly writeNewId).
 * writeNewId is the only place that both writes the file and sets the memo, from what it just wrote.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { activeBackendId, open, seal } from "../../kit/keystore/keystore";
import type { Sealed } from "../../kit/keystore/types";
import type { DeviceVault } from "./keyring";
import { writeAtomicReplace } from "../../studio/atomic-file";

/** The one lock that is not held by the operating system: a key file beside the data. */
const WEAK = "identity-file";

const idPath = () => join(process.env["BUNZAI_HOME"] ?? homedir(), ".bunzai", "computer-id");

type IdFile = { id: string; check: Sealed };

/** The stored id and its check, or null when the file is missing or not one this build wrote. */
function readIdFile(): IdFile | null {
  const path = idPath();
  if (!existsSync(path)) return null;
  try {
    const stored = JSON.parse(readFileSync(path, "utf8")) as { id?: unknown; check?: unknown };
    if (typeof stored.id === "string" && typeof stored.check === "object" && stored.check !== null) {
      return { id: stored.id, check: stored.check as Sealed };
    }
  } catch {
    // Not JSON: treated like a missing file.
  }
  return null;
}

type IdMemo = { raw: string; id: string };
/** The last id verified against the id file it came from. Process-wide: BUNZAI_HOME does not change mid-process. */
let memo: IdMemo | null = null;

/** The id file's exact contents (about 150 bytes, microseconds to read). Null when the file is gone. */
function rawId(): string | null {
  try {
    return readFileSync(idPath(), "utf8");
  } catch {
    return null;
  }
}

async function writeNewId(): Promise<string> {
  const path = idPath();
  mkdirSync(join(path, ".."), { recursive: true });
  const id = randomUUID();
  const raw = `${JSON.stringify({ id, check: await seal(id) })}\n`;
  // Was a bare writeFileSync (B13 sibling gap): a crash mid-write could leave a truncated id file,
  // which readIdFile then treats as damaged and silently replaces with yet another fresh id.
  await writeAtomicReplace(path, raw);
  // Set from exactly what this write put on disk, so a caller right after never re-checks it.
  memo = { raw, id };
  return id;
}

/** "mine" when the check opens to the id, "other" when it opens to something else, "unknown" when it will not open. */
async function checkOf(file: IdFile): Promise<"mine" | "other" | "unknown"> {
  try {
    return (await open(file.check)) === file.id ? "mine" : "other";
  } catch {
    // A vault failing for a moment and a check sealed on another computer look the same here.
    return "unknown";
  }
}

/**
 * A random id for this computer and user, stored with a check sealed by this computer's vault. A
 * check that will not open is never a reason to change the id: a locked keychain or a DPAPI error
 * looks exactly like a copied folder, and changing the id then would strand this computer's copy
 * (the fourth review's blocker). The id changes only when the file is missing or damaged.
 *
 * Answers from the memo without touching the vault when the id file's bytes are exactly what produced
 * it; any difference (or no memo yet) runs the full check below, so a real change is never masked.
 */
async function computerId(): Promise<string> {
  const raw = rawId();
  if (raw !== null && memo && raw === memo.raw) return memo.id;
  const file = readIdFile();
  if (!file) return writeNewId();
  if ((await checkOf(file)) === "other") return writeNewId();
  // Memoized against the bytes read before the check, not a fresh read: a write landing between
  // the two would otherwise be trusted without ever being checked.
  if (raw !== null) memo = { raw, id: file.id };
  return file.id;
}

/**
 * The id to write a new copy under. Here a check that will not open does get a fresh id: the copy is
 * being written now with the person's proof in hand, so the cost is at most one spare copy, never an
 * overwritten one from another computer.
 */
async function computerIdForNewCopy(): Promise<string> {
  const file = readIdFile();
  if (file && (await checkOf(file)) === "mine") return file.id;
  return writeNewId();
}

const lockOf = (sealed: string) => {
  const lock = (JSON.parse(sealed) as Sealed).backend;
  return { lock, weak: lock === WEAK };
};

export const keystoreDeviceVault: DeviceVault = {
  seal: async (text) => JSON.stringify(await seal(text)),
  open: async (sealed) => open(JSON.parse(sealed) as Sealed),
  computerId,
  computerIdForNewCopy,
  computerLabel: async () => hostname(),
  lockOf,
  // Stronger means: this copy has the weak key-file lock, and an OS-held lock is available now.
  strongerThan: async (sealed) => lockOf(sealed).weak && (await activeBackendId()) !== WEAK,
};
