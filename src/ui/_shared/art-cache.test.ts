/**
 * The art cache's own contract, without a browser: dedupe, bounded eviction, and revoking - the
 * three guards M8 exists for. Real `fetch`, `Blob` and `URL.createObjectURL` are never exercised
 * here; `createArtCache`'s injectable deps stand in, the same shape `peek-queue.ts`'s factory uses.
 */
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { attachArtCacheLockListener, createArtCache, isAssetImageRef } from "./art-cache";

// A broken guard here means an `await` on a promise nothing ever settles (a dedupe or eviction bug
// makes a second fetch nobody resolves), which hangs rather than fails. A short default timeout
// turns that into an honest red instead of a stuck run.
setDefaultTimeout(5000);

interface FakeBlob { size: number }

function fakeDeps() {
  const fetched: string[] = [];
  const revoked: string[] = [];
  let nextId = 0;
  const resolvers = new Map<string, ((blob: FakeBlob) => void)[]>();
  const rejecters = new Map<string, ((err: unknown) => void)[]>();

  const fetchBlob = (url: string): Promise<FakeBlob> => {
    fetched.push(url);
    return new Promise<FakeBlob>((resolve, reject) => {
      const okList = resolvers.get(url) ?? [];
      okList.push(resolve);
      resolvers.set(url, okList);
      const badList = rejecters.get(url) ?? [];
      badList.push(reject);
      rejecters.set(url, badList);
    });
  };

  /** Answer every fetch in flight for `url` right now, with a blob of `bytes`. */
  const resolve = (url: string, bytes: number): void => {
    const list = resolvers.get(url) ?? [];
    resolvers.delete(url);
    rejecters.delete(url);
    for (const r of list) r({ size: bytes });
  };
  const fail = (url: string): void => {
    const list = rejecters.get(url) ?? [];
    resolvers.delete(url);
    rejecters.delete(url);
    for (const r of list) r(new Error("art fetch failed"));
  };

  const createUrl = (blob: FakeBlob): string => `obj:${String(nextId++)}:${String(blob.size)}`;
  const revokeUrl = (url: string): void => { revoked.push(url); };

  return {
    deps: { fetchBlob: fetchBlob as (url: string) => Promise<Blob>, createUrl: createUrl as (b: Blob) => string, revokeUrl },
    fetched,
    revoked,
    resolve,
    fail,
  };
}

/** Settle every already-scheduled microtask (a resolved fetch's `.then` chain, eviction's own `.then`). */
const flush = async (n = 6): Promise<void> => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const nextTurn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("createArtCache: dedupe", () => {
  test("in-flight URL aliases resolve all waiters to the merged hash entry", async () => {
    const resolvers = new Map<string, (value: { blob: Blob; sha: string }) => void>();
    const sha = "a".repeat(64);
    const cache = createArtCache({}, {
      fetchAsset: (url) => new Promise((resolve) => resolvers.set(url, resolve)),
      createUrl: () => "canonical-object-url",
      revokeUrl: () => undefined,
    });
    const first = cache.get("/a");
    const aliasOne = cache.get("/b");
    const aliasTwo = cache.get("/b");
    const blob = { size: 10 } as Blob;
    resolvers.get("/a")!({ blob, sha });
    await flush();
    resolvers.get("/b")!({ blob, sha });
    const [canonical, one, two] = await Promise.all([first, aliasOne, aliasTwo]);
    expect(one).toBe(canonical);
    expect(two).toBe(canonical);
  });

  test("alias metadata prunes independently of a live hash entry and a pruned URL is fetched again", async () => {
    const pending = new Map<string, ((value: { blob: Blob; sha: string }) => void)[]>();
    const fetched: string[] = [];
    const sha = "b".repeat(64);
    const cache = createArtCache({ maxEntries: 2 }, {
      fetchAsset: (url) => {
        fetched.push(url);
        return new Promise((resolve) => { const list = pending.get(url) ?? []; list.push(resolve); pending.set(url, list); });
      },
      createUrl: () => "shared-hash-object-url",
      revokeUrl: () => undefined,
    });
    const load = async (url: string, identity: string): Promise<string> => {
      const result = cache.get(url, identity);
      const resolver = pending.get(url)?.shift();
      if (!resolver) throw new Error("expected source-fixture request");
      resolver({ blob: { size: 1 } as Blob, sha });
      return result;
    };
    const original = await load("/portrait/0", "receipt:0");
    for (let i = 1; i <= 10; i++) await load(`/portrait/${String(i)}`, `receipt:${String(i)}`);
    const refreshed = await load("/portrait/0", "receipt:0");
    expect(refreshed).toBe(original);
    expect(fetched.filter((url) => url === "/portrait/0")).toHaveLength(2);
  });

  test("two concurrent gets for the same URL share one fetch", async () => {
    const { deps, fetched, resolve } = fakeDeps();
    const cache = createArtCache({}, deps);

    const p1 = cache.get("a");
    const p2 = cache.get("a");
    expect(fetched).toEqual(["a"]);

    resolve("a", 10);
    const [u1, u2] = await Promise.all([p1, p2]);
    expect(u1).toBe(u2);
  });

  test("a resolved URL is served from cache without fetching again", async () => {
    const { deps, fetched, resolve } = fakeDeps();
    const cache = createArtCache({}, deps);
    const p1 = cache.get("a");
    resolve("a", 10);
    await p1;
    const p2 = cache.get("a");
    // A no-op if this is the cache hit it should be (nothing is waiting on "a" any more); resolves
    // a real second fetch instead of hanging the test if dedupe is broken.
    resolve("a", 10);
    await p2;
    expect(fetched).toEqual(["a"]);
  });
});

describe("createArtCache: bounded eviction revokes", () => {
  test("count bound: the oldest entry is evicted and revoked when a third arrives", async () => {
    const { deps, revoked, resolve, fetched } = fakeDeps();
    const cache = createArtCache({ maxEntries: 2 }, deps);

    const p1 = cache.get("a"); resolve("a", 5); await p1;
    const p2 = cache.get("b"); resolve("b", 5); await p2;
    expect(revoked).toEqual([]);

    const p3 = cache.get("c"); await nextTurn(); expect(fetched).toContain("c"); resolve("c", 5); await p3;
    await flush();
    expect(revoked).toEqual(["obj:0:5"]); // "a"'s object URL
  });

  test("byte bound: a big entry evicts as many oldest rows as it takes to fit", async () => {
    const { deps, revoked, resolve, fetched } = fakeDeps();
    const cache = createArtCache({ maxEntries: 100, maxBytes: 100 }, deps);

    const p1 = cache.get("a"); resolve("a", 40); await p1;
    const p2 = cache.get("b"); await nextTurn(); expect(fetched).toContain("b"); resolve("b", 40); await p2;
    expect(revoked).toEqual(["obj:0:40"]);

    const p3 = cache.get("c"); await nextTurn(); expect(fetched).toContain("c"); resolve("c", 90); await p3;
    await flush();
    // 40 + 40 + 90 = 170 > 100: both a and b must go before c alone (90) fits under the bound.
    expect(revoked.sort()).toEqual(["obj:0:40", "obj:1:40"]);
  });

  test("touching a hit on get() moves it to the front, so an accessed entry survives", async () => {
    const { deps, revoked, resolve, fetched } = fakeDeps();
    const cache = createArtCache({ maxEntries: 2 }, deps);

    const p1 = cache.get("a"); resolve("a", 5); await p1;
    const p2 = cache.get("b"); resolve("b", 5); await p2;
    await cache.get("a"); // touch: "a" is now more recent than "b"

    const p3 = cache.get("c"); await nextTurn(); expect(fetched).toContain("c"); resolve("c", 5); await p3;
    await flush();
    expect(revoked).toEqual(["obj:1:5"]); // "b" went, not "a"
  });

  test("the entry just inserted is never the one its own insert evicts", async () => {
    const { deps, revoked, resolve } = fakeDeps();
    const cache = createArtCache({ maxEntries: 1 }, deps);
    const p1 = cache.get("a");
    resolve("a", 5);
    const url = await p1;
    expect(url).toBe("obj:0:5");
    expect(revoked).toEqual([]);
  });
});

describe("createArtCache: only a definitive 404 or 410 is remembered", () => {
  const failing = (status: number) => {
    const fetched: string[] = [];
    const cache = createArtCache({}, {
      fetchAsset: (url) => { fetched.push(url); return Promise.reject(Object.assign(new Error("asset fetch failed"), { status })); },
      createUrl: () => "obj", revokeUrl: () => undefined,
    });
    return { fetched, cache, ask: (id = "id:1") => cache.get("/a", id).then(() => "ok", () => "failed") };
  };
  test("a 404 is fetched once across concurrent mounts and later asks; a new identity or clear() retries", async () => {
    const { fetched, cache, ask } = failing(404);
    expect(await Promise.all([ask(), ask(), ask()])).toEqual(["failed", "failed", "failed"]);
    await ask(); await ask();
    expect(fetched).toEqual(["/a"]);
    await ask("id:2");
    expect(fetched.length).toBe(2);
    cache.clear();
    await ask();
    expect(fetched.length).toBe(3);
  });
  test("410 is remembered too", async () => {
    const { fetched, ask } = failing(410);
    await ask(); await ask();
    expect(fetched.length).toBe(1);
  });
  test("a 503 is retried on the next ask, but concurrent asks share one in-flight request", async () => {
    const { fetched, ask } = failing(503);
    await Promise.all([ask(), ask(), ask()]);
    expect(fetched.length).toBe(1);
    await ask();
    expect(fetched.length).toBe(2);
  });
  test("a failure with no status is retried", async () => {
    let calls = 0;
    const bare = createArtCache({}, { fetchAsset: () => { calls++; return Promise.reject(new Error("network")); }, createUrl: () => "o", revokeUrl: () => undefined });
    await bare.get("/b").catch(() => undefined); await bare.get("/b").catch(() => undefined);
    expect(calls).toBe(2);
  });
});

describe("createArtCache: delivery reservations and clear", () => {
  test("a completed entry reaches its waiter before a queued fetch evicts it", async () => {
    const { deps, fetched, resolve } = fakeDeps();
    const cache = createArtCache({ maxEntries: 1 }, deps);

    const first = cache.get("a").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    const second = cache.get("b").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    expect(fetched).toEqual(["a"]);
    resolve("a", 5);
    const settledFirst = await first;
    // A is delivered and its lease released before queued B evicts its cache entry.
    await nextTurn();
    expect(fetched).toEqual(["a", "b"]);
    expect(settledFirst.status).toBe("fulfilled");
    resolve("b", 5);
    expect((await second).status).toBe("fulfilled");
  });

  test("two active reservations plus a third request preserve completed delivery within the byte cap", async () => {
    const { deps, fetched, resolve } = fakeDeps();
    const cache = createArtCache({ maxEntries: 2, maxBytes: 64 * 1024 * 1024 }, deps);
    const first = cache.get("a").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    const second = cache.get("b").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    const third = cache.get("c").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    expect(fetched).toEqual(["a", "b"]);
    resolve("a", 1024 * 1024);
    resolve("b", 1024 * 1024);
    expect((await first).status).toBe("fulfilled");
    expect((await second).status).toBe("fulfilled");
    await nextTurn();
    expect(fetched).toEqual(["a", "b", "c"]);
    expect(cache.bytes()).toBeLessThanOrEqual(64 * 1024 * 1024);
    resolve("c", 1024 * 1024);
    expect((await second).status).toBe("fulfilled");
    expect((await third).status).toBe("fulfilled");
  });

  test("joined canonical waiters stay protected together under queue pressure", async () => {
    const pending = new Map<string, (value: { blob: Blob; sha: string }) => void>();
    const fetched: string[] = [];
    const cache = createArtCache({ maxEntries: 2, maxBytes: 64 * 1024 * 1024 }, {
      fetchAsset: (url) => { fetched.push(url); return new Promise((resolve) => pending.set(url, resolve)); },
      createUrl: () => "canonical-delivery",
      revokeUrl: () => undefined,
    });
    const first = cache.get("a").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    const joined = cache.get("b").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    const third = cache.get("c").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    const sha = "c".repeat(64), blob = { size: 1 } as Blob;
    pending.get("a")!({ blob, sha });
    pending.get("b")!({ blob, sha });
    const [one, two] = await Promise.all([first, joined]);
    expect(one).toEqual({ status: "fulfilled", url: "canonical-delivery" });
    expect(two).toEqual(one);
    await nextTurn();
    expect(fetched).toEqual(["a", "b", "c"]);
    pending.get("c")!({ blob, sha: "d".repeat(64) });
    expect((await third).status).toBe("fulfilled");
  });

  test("clear() revokes every held URL, including one still in flight", async () => {
    const { deps, revoked, resolve } = fakeDeps();
    const cache = createArtCache({}, deps);

    const p1 = cache.get("a"); resolve("a", 5); await p1;
    const p2 = cache.get("b").then((url) => ({ status: "fulfilled" as const, url }), (error: unknown) => ({ status: "rejected" as const, error }));
    cache.clear();
    resolve("b", 5);
    const outcome = await p2;
    await flush();
    expect(outcome.status).toBe("rejected");
    expect(revoked).toEqual(["obj:0:5"]);
  });
});

describe("attachArtCacheLockListener", () => {
  test("revokes everything when the target raises the library-locked event", async () => {
    const { deps, revoked, resolve } = fakeDeps();
    const cache = createArtCache({}, deps);
    const p1 = cache.get("a"); resolve("a", 5); await p1;

    const listeners: [string, () => void][] = [];
    const fakeTarget = {
      addEventListener: (type: string, fn: () => void) => { listeners.push([type, fn]); },
      removeEventListener: () => undefined,
    };
    attachArtCacheLockListener(fakeTarget as unknown as typeof window, cache);
    expect(listeners).toHaveLength(1);
    expect(listeners[0]?.[0]).toBe("bunzai:library-locked");

    listeners[0]?.[1]();
    await flush();
    expect(revoked).toEqual(["obj:0:5"]);

    const p2 = cache.get("a"); // cleared, so this is a fresh fetch, not the old cached row
    resolve("a", 5);
    await p2;
  });
});

describe("createArtCache: displayed art is never revoked", () => {
  const MIB = 1024 * 1024;

  test("eleven 3 MiB portraits loaded together all stay valid while displayed", async () => {
    const revoked: string[] = [];
    let next = 0;
    const cache = createArtCache({}, {
      reportsSize: true,
      fetchAsset: async (_url, _signal, admit) => {
        await admit?.(3 * MIB);
        await nextTurn();
        return { blob: { size: 3 * MIB } as Blob };
      },
      createUrl: () => `obj:${String(next++)}`,
      revokeUrl: (url) => { revoked.push(url); },
    });
    const leases = await Promise.all(Array.from({ length: 11 }, (_, i) => cache.lease(`/p/${String(i)}`)));
    await nextTurn();
    expect(new Set(leases.map((lease) => lease.url)).size).toBe(11);
    expect(revoked).toEqual([]);
    expect(cache.bytes()).toBe(11 * 3 * MIB);
  });

  test("a request that needs room waits for a release instead of revoking a leased entry", async () => {
    const { deps, revoked, resolve, fetched } = fakeDeps();
    const cache = createArtCache({ maxEntries: 2 }, deps);
    const a = cache.lease("a"); resolve("a", 5); const leaseA = await a;
    const b = cache.lease("b"); await nextTurn(); resolve("b", 5); const leaseB = await b;
    const c = cache.lease("c");
    await nextTurn(); await nextTurn();
    expect(fetched).toEqual(["a", "b"]);
    expect(revoked).toEqual([]);
    leaseA.release();
    await nextTurn();
    expect(fetched).toContain("c");
    expect(revoked).toEqual([leaseA.url]);
    resolve("c", 5);
    expect((await c).url).not.toBe(leaseB.url);
  });

  test("an unreleased lease survives trim()", async () => {
    const { deps, revoked, resolve } = fakeDeps();
    const cache = createArtCache({}, deps);
    const held = cache.lease("a"); resolve("a", 5); const lease = await held;
    await nextTurn();
    cache.trim(0);
    expect(revoked).toEqual([]);
    lease.release();
    cache.trim(0);
    expect(revoked).toEqual([lease.url]);
  });
});

describe("createArtCache: primed bytes", () => {
  test("art the editor just staged previews from its own bytes, with no fetch of a blob the server does not serve yet", async () => {
    const { deps, fetched } = fakeDeps();
    const cache = createArtCache({}, deps);
    const staged = { size: 7 } as Blob;
    cache.prime("sha:abc:full", staged);
    const lease = await cache.lease("/api/asset/abc?size=full", "sha:abc:full");
    expect(lease.url).toBe("obj:0:7");
    expect(fetched).toEqual([]);
    expect(cache.bytes()).toBe(7);
  });

  test("priming never displaces a leased entry and skips when the budget has no room", async () => {
    const { deps, revoked, resolve } = fakeDeps();
    const cache = createArtCache({ maxEntries: 1 }, deps);
    const held = cache.get("a"); resolve("a", 5); await held;
    const lease = await cache.lease("a");
    cache.prime("sha:abc:full", { size: 7 } as Blob);
    expect(revoked).toEqual([]);
    expect(cache.bytes()).toBe(5);
    lease.release();
  });
});

describe("isAssetImageRef reads an uploaded reference the way the store writes it", () => {
  const sha = "c".repeat(64);
  test("any image media type counts, not only a narrow character class", () => {
    expect(isAssetImageRef(`\u0000b:u:image/png:${sha}`)).toBe(true);
    expect(isAssetImageRef(`\u0000b:u:image/vnd.x_y:${sha}`)).toBe(true);
  });
  test("video, a bare hash reference and a short hash are not images", () => {
    expect(isAssetImageRef(`\u0000b:u:video/mp4:${sha}`)).toBe(false);
    expect(isAssetImageRef(`\u0000b:b:${sha}`)).toBe(false);
    expect(isAssetImageRef(`\u0000b:u:image/png:${sha.slice(1)}`)).toBe(false);
  });
});
