/** Theme HTTP reads, example export and revision-only cross-client polling. */
import { describe, expect, test } from "bun:test";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { createThemeLifecycle } from "../extensions/theme-lifecycle";
import type { ThemePackageInput } from "../extensions/theme-contract";
import { fixtureThemePackage } from "../extensions/theme-test-fixture";
import { DEFAULT_STUDIO_THEME } from "../studio/settings-shape";
import { createThemeRouteOwner, createThemeService, handleThemeReadRoutes, handleThemeRoutes } from "./server-theme-extensions";

const pkg = (id: string): Promise<ThemePackageInput> => fixtureThemePackage(id, id, "CC0 test license");
const settings = { read: async () => ({ theme: "theater" }) } as never;
const request = (path: string): [Request, URL] => {
  const url = new URL(`http://127.0.0.1${path}`);
  return [new Request(url), url];
};

describe("theme extension read routes", () => {
  test("one opened StateStore shares one lifecycle between local writers and remote readers", async () => {
    const state = memoryStateStore();
    const packaged = { themePackages: {}, exampleThemePackages: {} } as never;
    expect(createThemeService(state, packaged)).toBe(createThemeService(state, packaged));
  });

  test("example export returns a cloned, validated complete envelope", async () => {
    const lifecycle = await createThemeLifecycle(memoryStateStore(), [], [await pkg("bunraku.theme.example")]);
    const [req, url] = request("/api/themes/examples/bunraku.theme.example/package");
    const first = await handleThemeRoutes(req, url, lifecycle, settings);
    expect(first?.status).toBe(200);
    const envelope = await first!.json() as ThemePackageInput;
    expect(envelope.licenseText).toBe("CC0 test license");
    (envelope.manifest as { name: string }).name = "Changed outside lifecycle";
    const again = await handleThemeRoutes(req, url, lifecycle, settings);
    expect(((await again!.json()) as ThemePackageInput).manifest).toMatchObject({ name: "bunraku.theme.example" });
  });

  test("effective theme: a fresh install paints the default, a saved theme is kept", async () => {
    const lifecycle = await createThemeLifecycle(memoryStateStore(), [await pkg(DEFAULT_STUDIO_THEME), await pkg("theater")]);
    const [req, url] = request("/api/themes/effective");
    const themeId = async (saved: unknown): Promise<unknown> => ((await (await handleThemeReadRoutes(req, url, lifecycle, { read: async () => saved } as never))!.json()) as { themeId: string }).themeId;
    expect(await themeId({})).toBe(DEFAULT_STUDIO_THEME);
    expect(await themeId({ theme: "theater" })).toBe("theater");
  });

  test("revision polling exposes only a lifecycle epoch and committed revision", async () => {
    const lifecycle = await createThemeLifecycle(memoryStateStore(), [await pkg("theater")], [await pkg("bunraku.theme.example")]);
    const [req, url] = request("/api/themes/revision");
    const firstResponse = await handleThemeReadRoutes(req, url, lifecycle, settings);
    expect(firstResponse?.headers.get("cache-control")).toBe("no-store");
    const first = await firstResponse!.json() as { epoch: string; revision: number };
    expect(first.epoch).toMatch(/^[a-f0-9]{48}$/);
    expect(first.revision).toBe(0);
    expect(Object.keys(first).sort()).toEqual(["epoch", "revision"]);
    const approval = await lifecycle.inspectExample("bunraku.theme.example");
    await lifecycle.install(approval.challenge, approval.preview.digest, "approve");
    const changedResponse = await handleThemeReadRoutes(req, url, lifecycle, settings);
    const changed = await changedResponse!.json() as { epoch: string; revision: number };
    expect(changed).toEqual({ epoch: first.epoch, revision: 1 });
    await lifecycle.disable("bunraku.theme.example");
    expect((await (await handleThemeReadRoutes(req, url, lifecycle, settings))!.json()).revision).toBe(2);
    const restarted = await createThemeLifecycle(memoryStateStore(), [await pkg("theater")]);
    const restartStamp = await (await handleThemeReadRoutes(req, url, restarted, settings))!.json() as { epoch: string; revision: number };
    expect(restartStamp.revision).toBe(0);
    expect(restartStamp.epoch).not.toBe(first.epoch);
  });
});

describe("GET /api/themes/packages with bad stored state", () => {
  const packages = async (state: ReturnType<typeof memoryStateStore>): Promise<Response> => {
    const [req, url] = request("/api/themes/packages");
    return createThemeRouteOwner(undefined, settings)(req, url, state);
  };

  test("a stored row the validator rejects never turns the catalog into a 500", async () => {
    const state = memoryStateStore();
    const lifecycle = await createThemeService(state);
    const review = await lifecycle.inspectExample((await lifecycle.examples())[0]!.id);
    await lifecycle.install(review.challenge, review.preview.digest, "approve");
    const doc = JSON.parse((await state.read("themeExtensions"))!);
    const id = Object.keys(doc.entries)[0]!;
    delete doc.entries[id].input.manifest.appearance.palette;
    await state.write("themeExtensions", JSON.stringify(doc));
    const res = await packages(state);
    expect(res.status).toBe(200);
    const items = await res.json() as { id: string; builtIn: boolean; invalid?: string }[];
    expect(items.some((i) => i.builtIn)).toBe(true);
    expect(items.find((i) => i.id === id)?.invalid).toBeString();
  });

  test("an unreadable state document still lists the bundled themes with a state error", async () => {
    const state = memoryStateStore();
    await state.write("themeExtensions", "{broken");
    const res = await packages(state);
    expect(res.status).toBe(200);
    const items = await res.json() as { builtIn: boolean; enabled: boolean; stateError?: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.builtIn && !i.enabled && typeof i.stateError === "string")).toBe(true);
    expect(await state.read("themeExtensions")).toBe("{broken");
  });
});
