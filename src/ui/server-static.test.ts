/**
 * The dev-bundle memo: bundleModule/bundleVendor/boot.js must
 * NOT rebundle on every request once a build exists, and must go stale the moment
 * invalidateDevBundleCache runs (the file watcher's job in production; called directly here so the
 * test needs no real filesystem watch). Not named server-bundle.test.ts - that file already covers
 * an unrelated concept (format-bundle inspect/export/save over the loopback API).
 */
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { bundleModule, bundleVendor, DEV_WATCH_ROOT, handleAssetRoutes, invalidateDevBundleCache } from "./server-static";

/** Vendor/boot bundle content is identical on every rebuild (fixed repo source, nothing edited), so
 * a memo hit is invisible in the returned string. Count real Bun.build calls instead - the only
 * thing that actually distinguishes "served from cache" from "rebuilt". */
function spyOnBunBuild(): { calls: () => number; restore: () => void } {
  const anyBun = globalThis.Bun as unknown as { build: typeof Bun.build };
  const original = anyBun.build;
  let count = 0;
  anyBun.build = ((...args: Parameters<typeof Bun.build>) => {
    count++;
    return original(...args);
  }) as typeof Bun.build;
  return { calls: () => count, restore: () => { anyBun.build = original; } };
}

describe("dev-bundle memo", () => {
  test("bundleModule: a cached build survives an on-disk edit until invalidateDevBundleCache runs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-bundle-memo-"));
    const entrypoint = join(dir, "index.ts");
    await writeFile(entrypoint, "export const MARK = 1;\n");
    const mod = { id: "memo-test-app", entrypoint };

    const first = await bundleModule(mod);
    expect(first).toContain("1");

    await writeFile(entrypoint, "export const MARK = 2;\n");
    const stillCached = await bundleModule(mod);
    expect(stillCached).toBe(first); // memo hit: the edit on disk has not been picked up yet

    invalidateDevBundleCache();
    const fresh = await bundleModule(mod);
    expect(fresh).toContain("2");
    expect(fresh).not.toBe(first);

    await rm(dir, { recursive: true, force: true });
  });

  test("bundleModule: apps, setup steps, and tours share one id namespace but must not share a cache slot", async () => {
    // discoverApps/discoverSetupSteps/discoverTours are three separate folders and reuse ids across
    // them today ("library" and "docs" are both an app id and a tour id) - a cache keyed on mod.id
    // alone would serve one module's bundle for the other.
    const dirApp = await mkdtemp(join(tmpdir(), "vaude-bundle-collide-app-"));
    const dirTour = await mkdtemp(join(tmpdir(), "vaude-bundle-collide-tour-"));
    const entryApp = join(dirApp, "index.ts");
    const entryTour = join(dirTour, "index.ts");
    await writeFile(entryApp, 'export const WHOSE = "app";\n');
    await writeFile(entryTour, 'export const WHOSE = "tour";\n');

    const appCode = await bundleModule({ id: "library", entrypoint: entryApp });
    const tourCode = await bundleModule({ id: "library", entrypoint: entryTour });

    expect(appCode).toContain("app");
    expect(tourCode).toContain("tour");
    expect(tourCode).not.toBe(appCode);

    await rm(dirApp, { recursive: true, force: true });
    await rm(dirTour, { recursive: true, force: true });
  });

  test("bundleModule: an invalidate mid-build must not be masked by the finished build's own generation stamp", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vaude-bundle-race-"));
    const entrypoint = join(dir, "index.ts");
    await writeFile(entrypoint, "export const MARK = 1;\n");
    const mod = { id: "memo-test-race", entrypoint };

    // bundleModule runs synchronously up to its `await Bun.build(...)` before returning control here,
    // so the generation it will stamp its result with must already be captured by the time this next
    // line runs. Invalidating here simulates the watcher firing WHILE that build is still in flight.
    const pending = bundleModule(mod);
    invalidateDevBundleCache();
    await pending;

    const spy = spyOnBunBuild();
    try {
      await bundleModule(mod);
      // the in-flight build was superseded before it finished, so its result must be treated as
      // stale on arrival - a following call has to rebuild, not read it back from the cache.
      expect(spy.calls()).toBe(1);
    } finally {
      spy.restore();
    }

    await rm(dir, { recursive: true, force: true });
  });

  test("bundleVendor: a cached build is not rebundled until invalidateDevBundleCache runs", async () => {
    const spy = spyOnBunBuild();
    try {
      const first = await bundleVendor("strength");
      expect(first).not.toBeNull();
      expect(spy.calls()).toBe(1);

      const second = await bundleVendor("strength");
      expect(second).toBe(first);
      expect(spy.calls()).toBe(1); // memo hit: no second Bun.build call

      invalidateDevBundleCache();
      const third = await bundleVendor("strength");
      expect(third).not.toBeNull();
      expect(spy.calls()).toBe(2); // invalidated: rebuilt
    } finally {
      spy.restore();
    }
  });

  test("/boot.js goes through the same memo (handleAssetRoutes, unpackaged)", async () => {
    const spy = spyOnBunBuild();
    try {
      const first = await handleAssetRoutes("/boot.js", undefined);
      expect(first?.status).toBe(200);
      expect(spy.calls()).toBe(1);

      const second = await handleAssetRoutes("/boot.js", undefined);
      expect(second?.status).toBe(200);
      expect(spy.calls()).toBe(1); // memo hit: no second build

      invalidateDevBundleCache();
      const third = await handleAssetRoutes("/boot.js", undefined);
      expect(third?.status).toBe(200);
      expect(spy.calls()).toBe(2);
    } finally {
      spy.restore();
    }
  });
});

test("the dev watcher covers all of src, since an app bundle imports core, stage, entities and studio", () => {
  // A src/ui-only root let an edit in src/core serve a stale memoized bundle until restart.
  for (const dir of ["ui", "core", "stage", "entities", "studio", "formats"]) expect(existsSync(join(DEV_WATCH_ROOT, dir))).toBe(true);
});
