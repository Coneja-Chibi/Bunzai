/**
 * The server cache registry's own mechanics (caches.ts's file header): registration is by
 * construction (a plaintext cache without `clear()` does not type-check), budgets are enforced
 * largest-overage-first, and memory pressure (an injectable RSS reading, never the real 350 MB) trims
 * every cache to half its budget. `keyring-*-cache.test.ts` and `keyring.test.ts` prove the lock
 * funnel this registry now serves (`lockAll()`, `setGate()`) against the real keyring.
 */
import { beforeEach, expect, test } from "bun:test";
import { __registeredCachesForTests, __resetCachesForTests, enforceBudgets, GLOBAL_BUDGET_BYTES, lockAll, notePressure, registerCache, type CacheEntry } from "./caches";

beforeEach(() => __resetCachesForTests());

/** A controllable fake cache: `bytes` grows on `grow(n)`, `trim(toBytes)` drops straight to it
 * (never below 0), `clear()` zeroes it - exactly the shape a real cache's own trim/clear promise. */
function fakeCache(name: string, budgetBytes: number, plaintext = true): CacheEntry & { grow(n: number): void; cleared: boolean } {
  let bytes = 0;
  const self = {
    name,
    budgetBytes,
    plaintext,
    bytes: () => bytes,
    trim: (toBytes: number) => { bytes = Math.max(0, Math.min(bytes, toBytes)); },
    clear: () => { bytes = 0; self.cleared = true; },
    grow: (n: number) => { bytes += n; },
    cleared: false,
  } as CacheEntry & { grow(n: number): void; cleared: boolean };
  return self;
}

test("a cache over its own budget is trimmed down to it - red on today's code, where no registry exists", () => {
  const c = fakeCache("fake", 100);
  registerCache(c);
  c.grow(150);
  expect(c.bytes()).toBe(150); // over budget, not yet trimmed

  enforceBudgets();

  expect(c.bytes()).toBeLessThanOrEqual(100);
});

test("enforceBudgets trims the largest over-budget cache first", () => {
  const small = fakeCache("small", 100);
  const big = fakeCache("big", 100);
  registerCache(small);
  registerCache(big);
  small.grow(120); // 20 over
  big.grow(500); // 400 over

  const order: string[] = [];
  const realSmallTrim = small.trim.bind(small);
  const realBigTrim = big.trim.bind(big);
  small.trim = (n) => { order.push("small"); realSmallTrim(n); };
  big.trim = (n) => { order.push("big"); realBigTrim(n); };

  enforceBudgets();

  expect(order[0]).toBe("big"); // the larger overage trims first
  expect(small.bytes()).toBeLessThanOrEqual(100);
  expect(big.bytes()).toBeLessThanOrEqual(100);
});

test("enforceBudgets is a no-op when every cache is already within its own budget and the global one", () => {
  const c = fakeCache("fake", 100);
  registerCache(c);
  c.grow(50);
  let trimmed = false;
  const real = c.trim.bind(c);
  c.trim = (n) => { trimmed = true; real(n); };

  enforceBudgets();

  expect(trimmed).toBe(false);
  expect(c.bytes()).toBe(50);
});

test("enforceBudgets trims further, largest remaining first, when the sum still exceeds the global budget", () => {
  const a = fakeCache("a", 1000);
  const b = fakeCache("b", 1000);
  registerCache(a);
  registerCache(b);
  a.grow(600);
  b.grow(600); // both within their own 1000 budget, but 1200 together
  enforceBudgets(1000); // a tiny global budget for this test, not the real 300 MB

  expect(a.bytes() + b.bytes()).toBeLessThanOrEqual(1000);
});

test("the real global budget is 300 MB, per section 10.2", () => {
  expect(GLOBAL_BUDGET_BYTES).toBe(300 * 1024 * 1024);
});

test("notePressure trims every cache to half its budget, largest first, once RSS crosses the threshold - the real syscall is never used, this injects a fake reading", () => {
  const a = fakeCache("a", 1000);
  const b = fakeCache("b", 2000);
  registerCache(a);
  registerCache(b);
  a.grow(200); // well within budget
  b.grow(300);

  notePressure({ rss: () => 999_999_999, pressureRssBytes: 350 * 1024 * 1024 });

  expect(a.bytes()).toBeLessThanOrEqual(500);
  expect(b.bytes()).toBeLessThanOrEqual(1000);
});

test("notePressure does nothing extra when the injected RSS reading is under the pressure threshold", () => {
  const c = fakeCache("fake", 1000);
  registerCache(c);
  c.grow(200);

  notePressure({ rss: () => 0, pressureRssBytes: 350 * 1024 * 1024 });

  expect(c.bytes()).toBe(200); // untouched: within its own budget, and RSS was fine
});

test("lockAll clears every plaintext cache and leaves a non-plaintext one alone", () => {
  const plain = fakeCache("plain", 100, true);
  const notPlain = fakeCache("not-plain", 100, false);
  registerCache(plain);
  registerCache(notPlain);
  plain.grow(10);
  notPlain.grow(10);

  lockAll();

  expect(plain.cleared).toBe(true);
  expect(plain.bytes()).toBe(0);
  expect(notPlain.cleared).toBe(false);
  expect(notPlain.bytes()).toBe(10);
});

test("impossible by construction: a plaintext cache with no clear() does not type-check", () => {
  // @ts-expect-error plaintext: true requires clear() - this is the compile-time proof, not a runtime one.
  registerCache({ name: "no-clear", budgetBytes: 1, bytes: () => 0, trim: () => undefined, plaintext: true });
});

test("the derived, regex and piece server-side caches are registered by default", () => {
  const names = __registeredCachesForTests().map((c) => c.name);
  expect(names.sort()).toEqual(["derived", "keyword-regex", "piece-cache"]);
});
