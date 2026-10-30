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
import { inflateSync } from "node:zlib";
import extract from "png-chunks-extract";
import type { PackagedAssets } from "./assets";
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

describe("/app.webmanifest: installable to a phone's home screen", () => {
  const pngSize = async (res: Response): Promise<string> => {
    const head = new DataView(await res.arrayBuffer());
    return `${head.getUint32(16)}x${head.getUint32(20)}`;
  };
  const manifest = async (): Promise<{ start_url: string; scope: string; display: string; icons: { src: string; sizes: string; type: string }[] }> =>
    (await (await handleAssetRoutes("/app.webmanifest", undefined))!.json()) as never;

  test("names a start URL, a scope and the 192 and 512 icons Chrome's install check asks for", async () => {
    const m = await manifest();
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
    expect(m.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  test("every icon it names is served at the size it claims, from source and from baked asset data", async () => {
    const { icons } = await manifest();
    const dev = await Promise.all(icons.map(async (i) => (await handleAssetRoutes(i.src, undefined))!));
    const baked: Record<string, string> = {};
    for (const [i, icon] of icons.entries()) baked[icon.src.slice(1)] = Buffer.from(await dev[i]!.clone().arrayBuffer()).toString("base64");
    const packaged = { iconsB64: baked } as unknown as PackagedAssets;
    for (const [i, icon] of icons.entries()) {
      expect(dev[i]!.headers.get("content-type")).toBe(icon.type);
      expect(await pngSize(dev[i]!)).toBe(icon.sizes);
      expect(await pngSize((await handleAssetRoutes(icon.src, packaged))!)).toBe(icon.sizes);
    }
  });

  test("an absent baked icon is an error instead of an empty successful response", async () => {
    const response = await handleAssetRoutes("/icon-192.png", { iconsB64: {} } as unknown as PackagedAssets);
    expect(response?.status).toBe(404);
  });

  test("maskable icons keep every painted pixel inside the central safe circle on an opaque ground", async () => {
    for (const icon of (await manifest()).icons) {
      const response = (await handleAssetRoutes(icon.src, undefined))!;
      const chunks = extract(new Uint8Array(await response.arrayBuffer()));
      const header = chunks.find((chunk) => chunk.name === "IHDR")!.data;
      const size = new DataView(header.buffer, header.byteOffset).getUint32(0);
      const pixels = inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.name === "IDAT").map((chunk) => Buffer.from(chunk.data))));
      let radius = 0, transparent = 0, filtered = 0;
      for (let y = 0; y < size; y++) {
        if (pixels[y * (size * 4 + 1)] !== 0) filtered++;
        for (let x = 0; x < size; x++) {
          const i = y * (size * 4 + 1) + 1 + x * 4;
          if (pixels[i + 3] !== 255) transparent++;
          if (pixels[i] !== 17 || pixels[i + 1] !== 17 || pixels[i + 2] !== 19) radius = Math.max(radius, Math.hypot(x + .5 - size / 2, y + .5 - size / 2));
        }
      }
      expect(filtered).toBe(0); // The house generator deliberately writes unfiltered RGBA rows.
      expect(transparent).toBe(0);
      expect(radius).toBeGreaterThan(size * .2);
      expect(radius).toBeLessThanOrEqual(size * .4);
    }
  });
});
