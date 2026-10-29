/** Theme lifecycle public-state regressions: confirmation, package digest, and revocation. */
import { describe, expect, test } from "bun:test";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { createThemeLifecycle } from "./theme-lifecycle";
import { exampleThemeInventory, themeInventory } from "./theme-inventory";

const theaterInput = (await themeInventory()).find((i) => (i.manifest as { id: string }).id === "theater")!;
const encoreInput = (await exampleThemeInventory())[0]!;
type Pkg = { manifest: Record<string, any>; assets: Record<string, string> };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
/** The shipped Encore example, minus its assets, styles, fonts and slots, at a chosen version and navigation pick. */
const imported = (version = "1.0.0", nav = "tab-bar"): Pkg => {
  const p = clone(encoreInput) as Pkg;
  p.manifest.version = version; p.manifest.assets = []; delete p.manifest.styles; delete p.manifest.fonts; delete p.manifest.slots; p.manifest.appearance.marks = {}; p.assets = {};
  p.manifest.requests = p.manifest.requests.filter((r: string) => !["appearance.assets", "appearance.styles", "appearance.fonts", "ui.slots"].includes(r));
  p.manifest.appearance.surfaces["shell.nav"] = nav;
  return p;
};
const builtin = theaterInput as unknown as Pkg;
const denied = async (p: Promise<unknown>): Promise<boolean> => (await p.then(() => null, () => false)) === false;
const wider = () => {
  const p = imported("2.0.0", "hud-bar");
  p.manifest.requests.push("appearance.assets");
  p.manifest.assets = [{ id: "badge", path: "assets/badge.svg", mediaType: "image/svg+xml" }];
  p.manifest.appearance.marks = { dock: "badge" };
  p.assets["assets/badge.svg"] = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1 1\"><path d=\"M0 0h1v1H0z\"/></svg>";
  return p;
};

describe("theme lifecycle", () => {
  test("an approval boolean without a live inspected digest challenge installs nothing", async () => {
    const store = memoryStateStore();
    const themes = await createThemeLifecycle(store, []);
    expect(await denied(themes.install("", "sha256", "approve"))).toBe(true);
    expect(await themes.effective("bunzai.theme.encore")).toMatchObject({ themeId: null, appearance: null, fallbackReason: "not-installed" });
    expect(await store.read("themeExtensions")).toBeNull();
  });

  test("approval is bound to inspected digest; widened updates and revocation cannot auto-apply", async () => {
    const themes = await createThemeLifecycle(memoryStateStore(), []);
    const first = await themes.inspect(imported());
    const installed = await themes.install(first.challenge, first.preview.digest, "approve");
    expect("enabled" in installed && installed.enabled).toBe(true);
    expect((await themes.effective("bunzai.theme.encore")).packageId).toBe("bunzai.theme.encore");
    const changed = await themes.inspect(wider());
    expect((await themes.effective("bunzai.theme.encore")).digest).toBe(first.preview.digest);
    expect(await denied(themes.install(changed.challenge, first.preview.digest, "approve"))).toBe(true);
    const approved = await themes.inspect(wider());
    await themes.install(approved.challenge, approved.preview.digest, "approve");
    expect((await themes.effective("bunzai.theme.encore")).digest).toBe(approved.preview.digest);
    expect((await themes.list()).find((item) => item.id === "bunzai.theme.encore")?.grantedScopes).toContain("appearance.assets");
    await themes.revoke("bunzai.theme.encore");
    expect(await themes.effective("bunzai.theme.encore")).toMatchObject({ appearance: null, fallbackReason: "revoked" });
    expect(await denied(themes.enable("bunzai.theme.encore"))).toBe(true);
  });

  test("a challenged immutable snapshot is installed, and concurrent changes do not lose revocation", async () => {
    const store = memoryStateStore();
    const themes = await createThemeLifecycle(store, [builtin]);
    const source = imported();
    const pending = await themes.inspect(source);
    source.manifest.name = "Mutated after preview";
    const install = themes.install(pending.challenge, pending.preview.digest, "approve");
    const revoke = themes.revoke("theater");
    await Promise.all([install, revoke]);
    expect((await themes.list()).find((entry) => entry.id === "bunzai.theme.encore")?.name).toBe("Encore");
    expect(await themes.effective("theater")).toMatchObject({ appearance: null, fallbackReason: "revoked" });
  });

  test("persisted builtin revocation wins over host entitlement on every resolver call", async () => {
    const store = memoryStateStore();
    const first = await createThemeLifecycle(store, [builtin]);
    expect((await first.effective("theater")).appearance?.surfaces["shell.nav"]).toBe("playbill-rail");
    await first.revoke("theater");
    const nextBoot = await createThemeLifecycle(store, [builtin]);
    expect(await nextBoot.effective("theater")).toMatchObject({ themeId: null, appearance: null, fallbackReason: "revoked" });
    expect((await nextBoot.list()).find((item) => item.id === "theater")?.grantedScopes).toEqual([]);
    await nextBoot.disable("theater");
    expect(await denied(nextBoot.enable("theater"))).toBe(true);
    expect(await nextBoot.effective("theater")).toMatchObject({ themeId: null, fallbackReason: "revoked" });
    const request = await nextBoot.inspectRestore("theater");
    expect(await denied(nextBoot.restore("theater", "", request.digest, "approve"))).toBe(true);
    await nextBoot.restore("theater", request.challenge, request.digest, "approve");
    expect((await nextBoot.effective("theater")).themeId).toBe("theater");
  });

  test("a newer host package stays revoked until explicitly restored", async () => {
    const store = memoryStateStore();
    const first = await createThemeLifecycle(store, [builtin]);
    await first.revoke("theater");
    const newer = { ...builtin, manifest: { ...builtin.manifest, version: "9.0.0", name: "Theater update" } };
    const updated = await createThemeLifecycle(store, [newer]);
    expect(await updated.effective("theater")).toMatchObject({ themeId: null, fallbackReason: "revoked" });
    await updated.disable("theater");
    expect(await denied(updated.enable("theater"))).toBe(true);
    const request = await updated.inspectRestore("theater");
    await updated.restore("theater", request.challenge, request.digest, "approve");
    expect((await updated.effective("theater")).digest).toBe(request.digest);
  });

  test("a changed host digest is inactive and listed for digest-bound review", async () => {
    const store = memoryStateStore();
    const first = await createThemeLifecycle(store, [builtin]);
    await first.disable("theater");
    const newer = { ...builtin, manifest: { ...builtin.manifest, version: "9.0.0", name: "Theater update" } };
    const updated = await createThemeLifecycle(store, [newer]);
    expect(await updated.effective("theater")).toMatchObject({ themeId: null, appearance: null, fallbackReason: "disabled" });
    expect((await updated.list()).find((item) => item.id === "theater")).toMatchObject({ enabled: false, updateAvailable: true });
    await updated.disable("theater");
    expect((await updated.list()).find((item) => item.id === "theater")).toMatchObject({ updateAvailable: true, enabled: false });
    expect(await denied(updated.enable("theater"))).toBe(true);
    const review = await updated.inspectRestore("theater");
    await updated.restore("theater", review.challenge, review.digest, "approve");
    expect((await updated.effective("theater")).digest).toBe(review.digest);
  });

  test("the catalog reports each theme's difference score and palette swatch, counting only variants no other listed theme picks", async () => {
    const themes = await createThemeLifecycle(memoryStateStore(), [builtin], [encoreInput]);
    expect((await themes.list())[0]).toMatchObject({ id: "theater", difference: 1, swatch: expect.arrayContaining([expect.stringMatching(/^#[0-9a-f]{6}$/)]) });
    expect((await themes.list())[0]!.swatch).toHaveLength(7);
    const twin = clone(builtin);
    twin.manifest.id = "bunzai.theme.twin";
    const review = await themes.inspect(twin);
    const installed = await themes.install(review.challenge, review.preview.digest, "approve");
    expect(installed).toMatchObject({ id: "bunzai.theme.twin", difference: 0 });
    expect((await themes.list()).find((entry) => entry.id === "theater")?.difference).toBe(0);
  });

  test("corrupt persisted state cannot regenerate bundled entitlements", async () => {
    const store = memoryStateStore();
    await store.write("themeExtensions", "{broken");
    const themes = await createThemeLifecycle(store, [builtin]);
    expect(await themes.effective("theater")).toMatchObject({ themeId: null, appearance: null, fallbackReason: "invalid-state" });
  });
});

describe("theme catalog survives a bad stored row", () => {
  /** Installs Encore, then rewrites the stored row so the current validator rejects it (an older package revision). */
  const withBrokenRow = async (mutateDoc: (row: any) => void = (row) => { delete row.input.manifest.appearance.palette; }) => {
    const store = memoryStateStore();
    const first = await createThemeLifecycle(store, [builtin]);
    const review = await first.inspect(imported());
    await first.install(review.challenge, review.preview.digest, "approve");
    const doc = JSON.parse((await store.read("themeExtensions"))!);
    mutateDoc(doc.entries["bunzai.theme.encore"]);
    await store.write("themeExtensions", JSON.stringify(doc));
    return { store, themes: await createThemeLifecycle(store, [builtin]) };
  };

  test("a row the validator rejects is listed disabled and flagged with a bounded reason, bundled themes still list, and it can be removed", async () => {
    const { store, themes } = await withBrokenRow();
    const items = await themes.list();
    expect(items.find((i) => i.id === "theater")).toMatchObject({ enabled: true, builtIn: true });
    const bad = items.find((i) => i.id === "bunzai.theme.encore")!;
    expect(bad).toMatchObject({ enabled: false, grantedScopes: [], difference: 0, swatch: [], builtIn: false, name: "Encore" });
    expect(bad.invalid!.length).toBeGreaterThan(0);
    expect(bad.invalid!.length).toBeLessThanOrEqual(200);
    expect(JSON.parse((await store.read("themeExtensions"))!).entries["bunzai.theme.encore"].enabled).toBe(true);
    expect(await themes.effective("bunzai.theme.encore")).toMatchObject({ themeId: null, fallbackReason: "invalid-state" });
    await themes.remove("bunzai.theme.encore");
    expect((await themes.list()).map((i) => i.id)).toEqual(["theater"]);
  });

  test("a digest mismatch and a scope mismatch are flagged and agree with effective()", async () => {
    for (const tamper of [(row: any) => { row.digest = "sha256:stale"; }, (row: any) => { row.scopes = ["appearance.assets"]; }]) {
      const { themes } = await withBrokenRow(tamper);
      expect((await themes.list()).find((i) => i.id === "bunzai.theme.encore")).toMatchObject({ enabled: false, grantedScopes: [] });
      expect((await themes.list()).find((i) => i.id === "bunzai.theme.encore")!.invalid).toBeString();
      expect((await themes.effective("bunzai.theme.encore")).fallbackReason).toBe("invalid-state");
    }
  });

  test("an unreadable state document lists bundled themes with a state error, enabled nowhere, and writes nothing", async () => {
    const store = memoryStateStore();
    await store.write("themeExtensions", "{broken");
    const themes = await createThemeLifecycle(store, [builtin]);
    const items = await themes.list();
    expect(items.map((i) => i.id)).toEqual(["theater"]);
    expect(items[0]).toMatchObject({ enabled: false, grantedScopes: [] });
    expect(items[0]!.stateError).toBeString();
    expect(await themes.effective("theater")).toMatchObject({ themeId: null, fallbackReason: "invalid-state" });
    expect(await store.read("themeExtensions")).toBe("{broken");
  });
});
