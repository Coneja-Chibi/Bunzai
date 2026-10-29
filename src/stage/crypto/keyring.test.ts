/**
 * The keyring: where the wrapped data key lives, and
 * every way to unlock, lock, recover, and change it. Each fake computer has its own key store, so a
 * copy made on one provably does not open on another.
 */
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStageDatabase, type StageDatabase } from "../store/sqlite/database";
import { MIGRATIONS } from "../store/sqlite/migrations";
import { WrongSecretError } from "./crypto";
import { fakeComputer } from "./fake-device-vault";
import { fastPasswords } from "./fake-password-lock";
import { createKeyring, KeyChangedError, LockedError, ProofRequiredError, type DeviceVault } from "./keyring";
import { keyringRows } from "./keyring-rows";

// Real Argon2id settings run here (about 2 s per password operation), not a weakened test copy.
setDefaultTimeout(60_000);

const open: StageDatabase[] = [];
const dirs: string[] = [];
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const db = (path = ":memory:") => {
  const d = openStageDatabase(path, MIGRATIONS);
  open.push(d);
  return d;
};
const secrets = (d: StageDatabase) => (d.db.query("SELECT kind FROM keyring ORDER BY kind").all() as { kind: string }[]).map((r) => r.kind);
const deviceCount = (d: StageDatabase) => (d.db.query("SELECT count(*) AS n FROM devices").get() as { n: number }).n;
const WORDS_NOBODY_HAS = "abandon ".repeat(11) + "about";
/** Keyring rules do not depend on how slow the password lock is, so these tests use the fast stand-in. */
const keyring = (d: StageDatabase, vault: DeviceVault, opts: { timer?: () => number } = {}) =>
  createKeyring(d, vault, { passwords: fastPasswords(), ...opts });

/** A fresh keyring with confirmed words, the precondition for setting a password. */
async function withWords(d: StageDatabase, vault: DeviceVault = fakeComputer(), timer?: () => number) {
  const ring = keyring(d, vault, timer ? { timer } : {});
  await ring.setup();
  const words = ring.beginWords();
  await ring.confirmWords(words);
  return { ring, words, vault };
}

describe("setup", () => {
  test("first run makes a data key this computer holds: unlocking again needs nothing", async () => {
    const d = db();
    const vault = fakeComputer();
    const ring = keyring(d, vault);
    expect(await ring.status()).toMatchObject({ state: "new", cleanupPending: null });
    await ring.setup();
    expect(await ring.status()).toMatchObject({ state: "unlocked", hasPassword: false, hasWords: false });
    const content = Buffer.from(ring.keys().content);
    ring.lock();
    expect(() => ring.keys()).toThrow(LockedError);
    expect(await ring.unlock()).toBe(true);
    expect(ring.keys().content.equals(content)).toBe(true);
  });

  test("the data key is never stored in the clear", async () => {
    const d = db();
    const ring = keyring(d, fakeComputer());
    await ring.setup();
    const all = JSON.stringify([d.db.query("SELECT * FROM keyring").all(), d.db.query("SELECT * FROM devices").all()]);
    expect(all).not.toContain(ring.keys().content.toString("base64"));
  });

  test("setup twice is refused: it would orphan everything encrypted with the first key", async () => {
    const ring = keyring(db(), fakeComputer());
    await ring.setup();
    await expect(ring.setup()).rejects.toThrow();
  });

  test("two setups at once on one file: exactly one wins, and the loser holds no key", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bunzai-ring-"));
    dirs.push(dir);
    const path = join(dir, "b.db");
    const [a, b] = [db(path), db(path)];
    const ringA = keyring(a, fakeComputer({ delayMs: 20 }));
    const ringB = keyring(b, fakeComputer({ delayMs: 20 }));
    const results = await Promise.allSettled([ringA.setup(), ringB.setup()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = results[0]!.status === "rejected" ? ringA : ringB;
    expect(() => loser.keys()).toThrow(LockedError);
    expect(deviceCount(a)).toBe(1);
  });

  test("setup is refused on a database that already holds encrypted content", async () => {
    const d = db();
    d.db.run("INSERT INTO chats (id, title, character_id, cast_json, cast_snapshot_json, active_branch_id, created_at, updated_at) VALUES ('c', 'e1:x', 'h', 'e1:x', 'e1:x', 'b', 1, 1)");
    await expect(keyring(d, fakeComputer()).setup()).rejects.toThrow();
    expect(deviceCount(d)).toBe(0);
  });

  test("setup writes nothing when this computer's key store does not give the key back", async () => {
    const d = db();
    const broken: DeviceVault = { ...fakeComputer(), open: async () => "AAAA" };
    await expect(keyring(d, broken).setup()).rejects.toThrow(/did not give the key back/);
    expect(deviceCount(d)).toBe(0);
  });
});

describe("passwords, words, and proof", () => {
  test("a password needs recovery words first, so forgetting it can never lose the library", async () => {
    const ring = keyring(db(), fakeComputer());
    await ring.setup();
    await expect(ring.setPassword("moonlit", { mode: "each-open" })).rejects.toThrow(/recovery words/);
  });

  test("setting a password removes every computer's copy, so the password is then required", async () => {
    const d = db();
    const { ring, words } = await withWords(d);
    await keyring(d, fakeComputer()).unlockWithWords(words, { rememberComputer: true });
    expect(deviceCount(d)).toBe(2);
    const content = Buffer.from(ring.keys().content);
    expect(await ring.setPassword("moonlit", { mode: "each-open" })).toEqual({ cleanup: "done" });
    expect(deviceCount(d)).toBe(0);
    ring.lock();
    expect(await ring.unlock()).toBe(false);
    await expect(ring.unlockWithPassword("wrong")).rejects.toBeInstanceOf(WrongSecretError);
    await ring.unlockWithPassword("moonlit");
    expect(ring.keys().content.equals(content)).toBe(true);
    expect(secrets(d)).toEqual(["password", "recovery"]);
  });

  test("removing the password gives this computer its copy back", async () => {
    const d = db();
    const { ring } = await withWords(d);
    await ring.setPassword("moonlit", { mode: "each-open" });
    expect(await ring.removePassword()).toEqual({ cleanup: "done" });
    ring.lock();
    expect(await ring.unlock()).toBe(true);
    expect(await ring.status()).toMatchObject({ hasPassword: false });
  });

  test("words must be typed back before they count", async () => {
    const ring = keyring(db(), fakeComputer());
    await ring.setup();
    const words = ring.beginWords();
    await expect(ring.confirmWords(words.split(" ").reverse().join(" "))).rejects.toBeInstanceOf(WrongSecretError);
    expect(await ring.status()).toMatchObject({ hasWords: false });
    await ring.confirmWords(words);
    expect(await ring.status()).toMatchObject({ hasWords: true });
  });

  test("with a password set, changes need a proof from the last five minutes", async () => {
    let now = 0;
    const d = db();
    const { ring } = await withWords(d, fakeComputer(), () => now);
    await ring.setPassword("moonlit", { mode: "each-open" });
    now += 6 * 60_000;
    await expect(ring.removePassword()).rejects.toBeInstanceOf(ProofRequiredError);
    await expect(ring.confirmWords(ring.beginWords())).rejects.toBeInstanceOf(ProofRequiredError);
    await expect(ring.setPassword("mine now", { mode: "each-open" })).rejects.toBeInstanceOf(ProofRequiredError);
    await expect(ring.prove({ password: "wrong" })).rejects.toBeInstanceOf(WrongSecretError);
    await expect(ring.prove({ words: WORDS_NOBODY_HAS })).rejects.toBeInstanceOf(WrongSecretError);
    await ring.prove({ password: "moonlit" });
    await ring.removePassword();
  });

  test("the proof window runs on the monotonic timer: setting the wall clock back does not extend it", async () => {
    let now = 0;
    const { ring } = await withWords(db(), fakeComputer(), () => now);
    await ring.setPassword("moonlit", { mode: "each-open" });
    const realNow = Date.now;
    try {
      Date.now = () => 0;
      now += 6 * 60_000;
      await expect(ring.removePassword()).rejects.toBeInstanceOf(ProofRequiredError);
    } finally {
      Date.now = realNow;
    }
  });

  test("with no password, this computer's unlock is proof enough: lost words can be replaced", async () => {
    const d = db();
    const vault = fakeComputer();
    const { ring, words: lost } = await withWords(d, vault);
    ring.forget();
    const later = keyring(d, vault);
    expect(await later.unlock()).toBe(true);
    const fresh = later.beginWords();
    expect(await later.confirmWords(fresh)).toEqual({ cleanup: "done" });
    expect(await later.setPassword("new start", { mode: "each-open" })).toEqual({ cleanup: "done" });
    later.lock();
    await expect(later.unlockWithWords(lost, { rememberComputer: false })).rejects.toBeInstanceOf(WrongSecretError);
    await later.unlockWithWords(fresh, { rememberComputer: false });
  });

  test("removePassword changes nothing when the vault fails to give this computer its copy", async () => {
    let fail = false;
    const d = db();
    const { ring } = await withWords(d, fakeComputer({ failSeal: () => fail }));
    await ring.setPassword("moonlit", { mode: "each-open" });
    fail = true;
    await expect(ring.removePassword()).rejects.toThrow("vault");
    expect(secrets(d)).toEqual(["password", "recovery"]);
    expect(deviceCount(d)).toBe(0);
  });
});

describe("computers", () => {
  test("new computer: the words open it, and remembering it is the person's choice", async () => {
    const d = db();
    const { ring, words } = await withWords(d);
    const content = Buffer.from(ring.keys().content);
    const laptop = fakeComputer();
    const elsewhere = keyring(d, laptop);
    expect(await elsewhere.unlock()).toBe(false);
    await elsewhere.unlockWithWords(words, { rememberComputer: false });
    expect(elsewhere.keys().content.equals(content)).toBe(true);
    expect(await keyring(d, laptop).unlock()).toBe(false);
    await keyring(d, laptop).unlockWithWords(words, { rememberComputer: true });
    expect(await keyring(d, laptop).unlock()).toBe(true);
  });

  test("several computers stay remembered side by side, listed by name, and one can be forgotten", async () => {
    const d = db();
    const desktop = fakeComputer();
    const { ring, words } = await withWords(d, desktop);
    const laptop = fakeComputer({ lock: "macos-keychain" });
    await keyring(d, laptop).unlockWithWords(words, { rememberComputer: true });
    expect(await keyring(d, desktop).unlock()).toBe(true);
    const list = await ring.rememberedComputers();
    expect(list).toHaveLength(2);
    expect(list.filter((c) => c.thisComputer).map((c) => c.id)).toEqual([await desktop.computerId()]);
    expect(list.every((c) => c.label.startsWith("Test computer"))).toBe(true);
    // Each computer reports the lock on its own copy, not this computer's.
    expect(list.map((c) => [c.thisComputer, c.lock])).toEqual([[true, "dpapi"], [false, "macos-keychain"]]);
    expect(JSON.stringify(d.db.query("SELECT label FROM devices").all())).not.toContain("Test computer");
    expect(await ring.forgetComputer(await laptop.computerId())).toEqual({ cleanup: "done" });
    expect(await keyring(d, laptop).unlock()).toBe(false);
  });

  test("the last way in cannot be forgotten", async () => {
    const d = db();
    const vault = fakeComputer();
    const ring = keyring(d, vault);
    await ring.setup();
    await expect(ring.forgetComputer(await vault.computerId())).rejects.toThrow(/only way/);
    expect(deviceCount(d)).toBe(1);
  });

  test("a computer is never remembered while a password is set", async () => {
    const d = db();
    const { ring, words } = await withWords(d);
    await ring.setPassword("moonlit", { mode: "each-open" });
    const laptop = fakeComputer();
    await keyring(d, laptop).unlockWithWords(words, { rememberComputer: true });
    expect(await keyring(d, laptop).unlock()).toBe(false);
    expect(deviceCount(d)).toBe(0);
  });

  test("B33: seal runs before computerIdForNewCopy, and a failed seal never reaches it (no id-file move)", async () => {
    const d = db();
    const { words } = await withWords(d);
    const order: string[] = [];
    let failSeal = false;
    const base = fakeComputer();
    const vault: DeviceVault = {
      ...base,
      seal: async (text) => { order.push("seal"); if (failSeal) throw new Error("vault unavailable"); return base.seal(text); },
      computerIdForNewCopy: async () => { order.push("computerIdForNewCopy"); return base.computerIdForNewCopy(); },
    };
    await keyring(d, vault).unlockWithWords(words, { rememberComputer: true });
    expect(order).toEqual(["seal", "computerIdForNewCopy"]);
    order.length = 0; failSeal = true;
    await expect(keyring(d, vault).unlockWithWords(words, { rememberComputer: true })).rejects.toThrow();
    expect(order).toEqual(["seal"]); // never reached computerIdForNewCopy
  });

  test("the weak-lock report reads the copy's recorded lock, and upgrading moves it to the stronger one", async () => {
    const d = db();
    let lock = "identity-file";
    const base = fakeComputer({ strongerAvailable: () => lock !== "identity-file" });
    const seal = async (text: string) => JSON.stringify({ ...(JSON.parse(await base.seal(text)) as object), lock });
    const ring = keyring(d, { ...base, seal });
    await ring.setup();
    expect(await ring.deviceLock()).toEqual({ lock: "identity-file", weak: true, strongerAvailable: false });
    lock = "macos-keychain";
    expect(await ring.deviceLock()).toEqual({ lock: "identity-file", weak: true, strongerAvailable: true });
    expect(await ring.upgradeDeviceLock()).toEqual({ cleanup: "done" });
    expect(await ring.deviceLock()).toEqual({ lock: "macos-keychain", weak: false, strongerAvailable: false });
  });
});

describe("key changes at the same time (R1)", () => {
  const onFile = () => {
    const dir = mkdtempSync(join(tmpdir(), "bunzai-race-"));
    dirs.push(dir);
    return join(dir, "b.db");
  };
  const passwordBesideDevice = (d: StageDatabase) => secrets(d).includes("password") && deviceCount(d) > 0;

  test("in one app: moving to a stronger lock while a password is set never leaves a copy beside it", async () => {
    const d = db();
    let stronger = false;
    const vault = fakeComputer({ lock: "identity-file", strongerAvailable: () => stronger, delayMs: 30 });
    const { ring } = await withWords(d, vault);
    stronger = true;
    await Promise.allSettled([ring.upgradeDeviceLock(), ring.setPassword("moonlit", { mode: "each-open" })]);
    expect(passwordBesideDevice(d)).toBe(false);
    ring.lock();
    expect(await keyring(d, vault).unlock()).toBe(false);
  });

  test("across two apps: remembering a computer while another sets a password never leaves a copy beside it", async () => {
    const path = onFile();
    const [a, b] = [db(path), db(path)];
    const { ring, words } = await withWords(a);
    // The laptop's key store is slower than the password step, so "remember" lands after it.
    const laptop = fakeComputer({ delayMs: 300 });
    const other = keyring(b, laptop);
    await Promise.allSettled([other.unlockWithWords(words, { rememberComputer: true }), ring.setPassword("moonlit", { mode: "each-open" })]);
    expect(passwordBesideDevice(a)).toBe(false);
    expect(await keyring(a, laptop).unlock()).toBe(false);
  });

  test("across two apps: moving to a stronger lock while another sets a password never leaves a copy beside it", async () => {
    const path = onFile();
    const [a, b] = [db(path), db(path)];
    let stronger = false;
    const timing: { delayMs: number } = { delayMs: 0 };
    const vault = fakeComputer({ lock: "identity-file", strongerAvailable: () => stronger, ...timing });
    const slowVault = { ...vault, seal: async (text: string) => { await new Promise((r) => setTimeout(r, timing.delayMs)); return vault.seal(text); } };
    const { ring } = await withWords(a, slowVault);
    const same = keyring(b, slowVault);
    expect(await same.unlock()).toBe(true);
    stronger = true;
    timing.delayMs = 300;
    await Promise.allSettled([same.upgradeDeviceLock(), ring.setPassword("moonlit", { mode: "each-open" })]);
    expect(passwordBesideDevice(a)).toBe(false);
  });

  test("across two apps: a stale 'remove password' never removes a password set meanwhile", async () => {
    const path = onFile();
    const [a, b] = [db(path), db(path)];
    const timing = { delayMs: 0 };
    const { ring, words } = await withWords(a, fakeComputer(timing));
    await ring.setPassword("first", { mode: "each-open" });
    const other = keyring(b, fakeComputer());
    await other.unlockWithWords(words, { rememberComputer: false });
    // This app's key store is slow to seal, so the other app's password lands in between.
    timing.delayMs = 300;
    const removing = ring.removePassword();
    await other.setPassword("second", { mode: "each-open" });
    await expect(removing).rejects.toBeInstanceOf(KeyChangedError);
    expect(secrets(a)).toContain("password");
    ring.lock();
    await ring.unlockWithPassword("second");
  });
});

describe("the lost-something table", () => {
  test("forgotten password, words kept: the words unlock and a new password replaces the old", async () => {
    const d = db();
    const { ring, words } = await withWords(d);
    await ring.setPassword("forgotten", { mode: "each-open" });
    ring.lock();
    await ring.unlockWithWords(words, { rememberComputer: false });
    await ring.setPassword("new one", { mode: "each-open" });
    ring.lock();
    await expect(ring.unlockWithPassword("forgotten")).rejects.toBeInstanceOf(WrongSecretError);
    await ring.unlockWithPassword("new one");
  });

  test("words lost, password kept: new words replace the old ones", async () => {
    const d = db();
    const { ring, words: old } = await withWords(d);
    await ring.setPassword("moonlit", { mode: "each-open" });
    ring.lock();
    await ring.unlockWithPassword("moonlit");
    const fresh = ring.beginWords();
    await ring.confirmWords(fresh);
    ring.lock();
    await expect(ring.unlockWithWords(old, { rememberComputer: false })).rejects.toBeInstanceOf(WrongSecretError);
    await ring.unlockWithWords(fresh, { rememberComputer: false });
  });

  test("computer lost with no password and no words: nothing else can open it", async () => {
    const d = db();
    await keyring(d, fakeComputer()).setup();
    const elsewhere = keyring(d, fakeComputer());
    expect(await elsewhere.unlock()).toBe(false);
    await expect(elsewhere.unlockWithWords(WORDS_NOBODY_HAS, { rememberComputer: false })).rejects.toBeInstanceOf(WrongSecretError);
    await expect(elsewhere.unlockWithPassword("anything")).rejects.toBeInstanceOf(WrongSecretError);
  });

  test("password and words both lost: every way in is refused", async () => {
    const d = db();
    const { ring } = await withWords(d);
    await ring.setPassword("moonlit", { mode: "each-open" });
    ring.lock();
    const elsewhere = keyring(d, fakeComputer());
    expect(await elsewhere.unlock()).toBe(false);
    await expect(elsewhere.unlockWithPassword("guess")).rejects.toBeInstanceOf(WrongSecretError);
    await expect(elsewhere.unlockWithWords(WORDS_NOBODY_HAS, { rememberComputer: false })).rejects.toBeInstanceOf(WrongSecretError);
  });
});

describe("unlock choices", () => {
  test("idle lock: the keyring locks itself once idle longer than the chosen time", async () => {
    let now = 0;
    const { ring } = await withWords(db(), fakeComputer(), () => now);
    expect((await ring.status()).lockPolicy).toBeNull();
    await ring.setPassword("moonlit", { mode: "idle", idleMinutes: 30 });
    expect((await ring.status()).lockPolicy).toEqual({ mode: "idle", idleMinutes: 30 });
    now += 29 * 60_000;
    ring.touch();
    now += 29 * 60_000;
    expect(ring.lockIfIdle()).toBe(false);
    now += 2 * 60_000;
    expect(ring.lockIfIdle()).toBe(true);
    expect(() => ring.keys()).toThrow(LockedError);
  });

  test("changing keys needs an unlocked keyring, and a bad policy is refused", async () => {
    const ring = keyring(db(), fakeComputer());
    await expect(ring.setPassword("x", { mode: "each-open" })).rejects.toBeInstanceOf(LockedError);
    expect(() => ring.beginWords()).toThrow(LockedError);
    const { ring: ready } = await withWords(db());
    await expect(ready.setPassword("x", { mode: "stay", stayHours: 8 } as never)).rejects.toThrow();
    await expect(ready.setPassword("x", { mode: "idle", idleMinutes: 1.5 })).rejects.toThrow();
  });

  test("lock and forget clear the key bytes they held", async () => {
    const ring = keyring(db(), fakeComputer());
    await ring.setup();
    const held = ring.keys().content;
    ring.lock();
    expect(held.every((b) => b === 0)).toBe(true);
    await ring.unlock();
    const again = ring.keys().index;
    ring.forget();
    expect(again.every((b) => b === 0)).toBe(true);
  });
});

describe("this computer's copy survives trouble (the fourth review)", () => {
  test("a key store that fails for a moment never locks out a library with no password and no words", async () => {
    const d = db();
    let down = false;
    const vault = fakeComputer({ failOpen: () => down });
    await keyring(d, vault).setup();
    down = true;
    expect(await keyring(d, vault).unlock()).toBe(false);
    down = false;
    expect(await keyring(d, vault).unlock()).toBe(true);
  });

  test("a lost computer id never locks the person out: a copy this computer can open still unlocks", async () => {
    const d = db();
    let id = "first-id";
    const vault = fakeComputer({ computerId: () => id });
    await keyring(d, vault).setup();
    id = "fresh-id-after-the-file-was-lost";
    expect(await keyring(d, vault).unlock()).toBe(true);
    expect(await keyring(d, fakeComputer()).unlock()).toBe(false);
  });

  test("a cleanup clears only its own record: a change another app makes meanwhile stays owed", async () => {
    const d = db();
    const other = keyringRows(d);
    // Another app on the same file changes a key while this app's cleanup is rebuilding the file.
    const busy: StageDatabase = { ...d, rebuild: async () => (other.markOwed("another app's change"), d.rebuild()) };
    const { ring } = await withWords(busy);
    const words = ring.beginWords();
    expect(await ring.confirmWords(words)).toEqual({ cleanup: "done" });
    expect((await ring.status()).cleanupPending).toBe("another app's change");
  });
});

describe("rehearsing the words", () => {
  test("the words' dates are in the status, and a rehearsal records itself only when the words are right", async () => {
    const d = db();
    const { ring, words } = await withWords(d);
    const before = await ring.status();
    expect(typeof before.wordsWrittenAt).toBe("number");
    expect(before.wordsRehearsedAt).toBe(before.wordsWrittenAt);

    await expect(ring.rehearse(words.split(" ").reverse().join(" "))).rejects.toBeInstanceOf(WrongSecretError);
    expect((await ring.status()).wordsRehearsedAt).toBe(before.wordsWrittenAt);

    await Bun.sleep(5);
    await ring.rehearse(words);
    const after = await ring.status();
    expect(after.wordsRehearsedAt!).toBeGreaterThan(before.wordsWrittenAt!);
    expect(after.wordsWrittenAt).toBe(before.wordsWrittenAt);
  });

  test("without words there is nothing to rehearse", async () => {
    const ring = keyring(db(), fakeComputer());
    await ring.setup();
    expect(await ring.status()).toMatchObject({ wordsWrittenAt: null, wordsRehearsedAt: null });
  });
});
