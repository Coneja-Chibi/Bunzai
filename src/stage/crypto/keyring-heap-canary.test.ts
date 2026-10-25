/**
 * The heap canary:
 * "no unregistered plaintext, proven by the heap." A cache registered with the registry and cleared
 * by `lockAll()` is not enough on faith - this seeds a real canary string through the token and lore
 * paths, locks the real keyring, forces collection, and inspects an actual heap snapshot for it.
 *
 * METHODOLOGY, and why it looks the way it does:
 * - The canary is never a source literal: `canaryFrom(seed)` rebuilds an identical string from a
 *   small integer seed. The only place the actual characters exist in this file's source is nowhere;
 *   they exist only at runtime, and only briefly, inside the code under test.
 * - The canary is rebuilt AFTER the snapshot is taken, from the same seed, never held across the
 *   gc/snapshot boundary - holding it in a local `const` the assertion later reads would itself keep
 *   it reachable and make the test pass vacuously regardless of what the caches under test do.
 * - A positive control (below) proves the snapshot format actually carries string content before
 *   trusting any negative result: `Bun.generateHeapSnapshot()`'s DEFAULT ("jsc") format does NOT
 *   (its own fields are `version/type/nodes/nodeClassNames/edges/edgeTypes/edgeNames` - no string
 *   table), so every call here passes `"v8"` explicitly, which does. Found empirically 2026-09-30
 *   against Bun 1.3.5 (this repo's pinned local version); record and re-check if the pin moves.
 * - `Bun.gc(true)` once was NOT reliably enough to collect a dropped string on this engine/version
 *   under `bun test` specifically - repeated trials of the SAME code flipped between found/not-found.
 *   Three passes with a pause between each, empirically, was stable across dozens of repeated trials
 *   under `bun test`; `settle()` below is that.
 *
 * FINDING that shaped `caches.ts`'s `lockAll()` (recorded 2026-09-30, S1): the first version of this
 * test, run under `bun test`, found the whole-word AND vetted-regex keyword canaries reachable AFTER
 * `clearKeywordRegexCaches()` ran, `ring.lock()` returned, and three GC passes completed - even
 * though `vettedRegexCache`/`wholeWordRegexCache` were provably empty Maps by then. Root cause,
 * isolated by direct inspection (not a heap snapshot): JSC (this runtime) implements the legacy,
 * deprecated `RegExp.input` / `RegExp['$_']` / `RegExp.lastMatch` / `RegExp.$1`..`$9` static
 * properties (ECMA-262 Annex B.2.4) - every successful `.test()`/`.exec()`/`.match()` anywhere in the
 * process overwrites them with THAT call's own input text and capture groups, reachable from the
 * global `RegExp` constructor regardless of any application object's reachability, until the next
 * match anywhere overwrites them. `caches.ts`'s `lockAll()` now runs one harmless `/x/.test("x")`
 * right after clearing every cache, which overwrites those statics with junk; this closes the window
 * for whatever the LAST real match happened to be before THIS lock. It does not, and structurally
 * cannot from this one call site, prevent a DIFFERENT regex match elsewhere in the app (chat
 * matching, macros, format detection - anything that runs a regex against decrypted text) from
 * refilling those same statics again before the NEXT lock: that is a wider, cross-cutting property of
 * every regex match in the whole codebase, not a cache-registry defect, and is reported to the lead
 * rather than guessed at further here (out of S1's bounded scope).
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import { compileBookKeyIndexCached, matchKeywordTrigger, __resetKeywordRegexCachesForTests, __resetLoreKeyIndexCacheForTests } from "../../core/lore/engine";
import { book, entry } from "../../core/lore/engine/_test-helpers";
import { countText, __resetTokenCacheForTests } from "../../core/tokens";
import { openStageDatabase, type StageDatabase } from "../store/sqlite/database";
import { MIGRATIONS } from "../store/sqlite/migrations";
import { fakeComputer } from "./fake-device-vault";
import { fastPasswords } from "./fake-password-lock";
import { createKeyring, type DeviceVault } from "./keyring";

/** Deterministic: the same seed always rebuilds byte-identical text, so nothing needs to hold the
 * original across the gc/snapshot boundary to search for it later. Short and alphanumeric (heap
 * snapshot string previews can truncate long values); the canary lives at the START of the string. */
function canaryFrom(seed: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "cnry";
  let x = seed >>> 0;
  for (let i = 0; i < 28; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    s += chars[x % chars.length];
  }
  return s;
}

/** Empirically stable under `bun test` on Bun 1.3.5 (see file header); a single Bun.gc(true) was not,
 * and this file's own tests alone needed fewer passes than running alongside the rest of
 * src/stage/crypto's suite in one process did - more total heap churn from other files made a
 * recently-freed string's physical memory take longer to actually get reused/overwritten, even
 * though it was no longer JS-reachable. Churning some throwaway allocations between gc passes speeds
 * that reuse along instead of just waiting on it. */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    Bun.gc(true);
    // Throwaway allocations, dropped immediately: gives the allocator pages to reuse for the memory
    // a just-cleared cache held, instead of leaving it untouched until unrelated later activity does.
    for (let j = 0; j < 200; j++) void `churn-${String(i)}-${String(j)}-${"x".repeat(64)}`;
    await new Promise((r) => setTimeout(r, 30));
  }
}

function snapshot(): string {
  return Bun.generateHeapSnapshot("v8");
}

const open: StageDatabase[] = [];
beforeEach(() => {
  __resetTokenCacheForTests();
  __resetKeywordRegexCachesForTests();
  __resetLoreKeyIndexCacheForTests();
});
afterEach(() => {
  for (const d of open.splice(0)) d.close();
  __resetTokenCacheForTests();
  __resetKeywordRegexCachesForTests();
  __resetLoreKeyIndexCacheForTests();
});
const db = (): StageDatabase => {
  const d = openStageDatabase(":memory:", MIGRATIONS);
  open.push(d);
  return d;
};
const keyring = (vault: DeviceVault) => createKeyring(db(), vault, { passwords: fastPasswords() });

/** Seeds every registered server cache, plus the keyword-regex cache's OTHER path (isRegex: true),
 * each with its own canary so a red result names its path. */
function seedAllPaths(): void {
  countText(canaryFrom(1));
  matchKeywordTrigger({ keyword: canaryFrom(2), isRegex: false }, `x ${canaryFrom(2)} y`, { caseSensitive: false, matchWholeWords: true });
  matchKeywordTrigger({ keyword: canaryFrom(3), isRegex: true }, `x ${canaryFrom(3)} y`, { caseSensitive: false, matchWholeWords: false });
  const b = book(`book-${canaryFrom(4)}`, [entry("e0", { triggers: [{ keyword: canaryFrom(4), isRegex: false }] })]);
  compileBookKeyIndexCached(b);
}

test("positive control: the snapshot format actually carries string content, and gc alone does not remove a still-reachable string", async () => {
  const held = canaryFrom(1);
  countText(held);
  await settle();
  const snap = snapshot();
  expect(snap.includes(canaryFrom(1))).toBe(true); // still referenced by `held` above - must be found
});

test("locking empties the token cache, both keyword-regex paths, and the lore key-index cache: every canary is unreachable after lock, gc, and a real heap snapshot", async () => {
  const ring = keyring(fakeComputer());
  await ring.setup();

  seedAllPaths();
  ring.lock();
  await settle();
  const snap = snapshot();

  expect(snap.includes(canaryFrom(1))).toBe(false); // token cache (countText)
  expect(snap.includes(canaryFrom(2))).toBe(false); // keyword-regex cache, whole-word path
  expect(snap.includes(canaryFrom(3))).toBe(false); // keyword-regex cache, vetted-regex path (the JSC statics finding above)
  expect(snap.includes(canaryFrom(4))).toBe(false); // lore key-index cache
});

test("mutation check: a cache the lock funnel forgot to clear IS caught (proves this test can fail, not just pass)", async () => {
  const ring = keyring(fakeComputer());
  await ring.setup();

  countText(canaryFrom(1)); // seeded but never cleared below - lock() is never called
  await settle();
  const snap = snapshot();

  expect(snap.includes(canaryFrom(1))).toBe(true); // still reachable: nothing locked, nothing cleared
});
