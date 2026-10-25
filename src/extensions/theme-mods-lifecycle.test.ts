/** The optional powers go through the same sealed lifecycle as every other scope: Gate approval, held updates, revoke, safe mode. */
import { describe, expect, test } from "bun:test";
import { memoryStateStore } from "../stage/store/memory/state-store";
import { createThemeLifecycle } from "./theme-lifecycle";
import { modThemePackage, png, pngBytes, woff2Bytes } from "./theme-mod-fixture";
import { fixtureThemePackage } from "./theme-test-fixture";
import type { ThemePackageInput } from "./theme-contract";

const ID = "bunraku.theme.modtest";
type Lifecycle = Awaited<ReturnType<typeof createThemeLifecycle>>;
const plain = async (): Promise<ThemePackageInput> => fixtureThemePackage(ID, "Mod test");
async function approve(themes: Lifecycle, input: ThemePackageInput): Promise<string> {
  const { preview, challenge } = await themes.inspect(input);
  await themes.install(challenge, preview.digest, "approve");
  return preview.digest;
}
const rejected = (p: Promise<unknown>): Promise<boolean> => p.then(() => false, () => true);

describe("scopes at the Gate", () => {
  test("the install confirmation lists every new scope the package uses, and nothing installs without approval", async () => {
    const store = memoryStateStore();
    const themes = await createThemeLifecycle(store, []);
    const { preview, challenge } = await themes.inspect(await modThemePackage());
    expect(preview.requestedScopes).toEqual(expect.arrayContaining(["appearance.styles", "appearance.fonts", "ui.slots"]));
    expect(await store.read("themeExtensions")).toBeNull();
    expect(await themes.effective(ID)).toMatchObject({ themeId: null, styles: null, fallbackReason: "not-installed" });
    await themes.install(challenge, preview.digest, "approve");
    expect((await themes.effective(ID)).grantedScopes).toEqual(preview.derivedScopes);
  });

  test("an update that adds styles, fonts and slots waits for the Gate: the old package keeps serving until approved, and a denial changes nothing", async () => {
    const themes = await createThemeLifecycle(memoryStateStore(), []);
    const first = await approve(themes, await plain());
    const before = await themes.effective(ID);
    expect(before.digest).toBe(first);
    expect(before.styles).toBeNull();
    const widened = await themes.inspect(await modThemePackage());
    expect(widened.preview.digest).not.toBe(first);
    expect(await themes.effective(ID)).toEqual(before);
    await themes.deny(widened.challenge, widened.preview.digest);
    expect(await themes.effective(ID)).toEqual(before);
    const again = await themes.inspect(await modThemePackage());
    expect(await rejected(themes.install(again.challenge, first, "approve"))).toBe(true);
    expect(await themes.effective(ID)).toEqual(before);
    await themes.install((await themes.inspect(await modThemePackage())).challenge, widened.preview.digest, "approve");
    expect((await themes.effective(ID)).styles).not.toBeNull();
  });

  test("stored data widened behind the lifecycle's back serves nothing", async () => {
    const store = memoryStateStore();
    const themes = await createThemeLifecycle(store, []);
    await approve(themes, await plain());
    const doc = JSON.parse((await store.read("themeExtensions"))!);
    doc.entries[ID].input = await modThemePackage();
    await store.write("themeExtensions", JSON.stringify(doc));
    expect(await themes.effective(ID)).toMatchObject({ themeId: null, styles: null, slots: {}, fallbackReason: "invalid-state" });
  });
});

describe("revoke and broken", () => {
  test("revoke drops the styles, fonts and slots at once, and enabling again needs fresh approval", async () => {
    const themes = await createThemeLifecycle(memoryStateStore(), []);
    await approve(themes, await modThemePackage());
    expect((await themes.effective(ID)).styles).not.toBeNull();
    await themes.revoke(ID);
    expect(await themes.effective(ID)).toMatchObject({ themeId: null, styles: null, fonts: [], slots: {}, fallbackReason: "revoked" });
    expect(await rejected(themes.enable(ID))).toBe(true);
  });

  test("a protected-layer failure marks the painted digest broken (audited), a stale digest marks nothing", async () => {
    const store = memoryStateStore();
    const themes = await createThemeLifecycle(store, []);
    const digest = await approve(themes, await modThemePackage());
    await themes.markBroken(ID, "0".repeat(64));
    expect((await themes.effective(ID)).digest).toBe(digest);
    await themes.markBroken(ID, digest);
    expect(await themes.effective(ID)).toMatchObject({ themeId: null, fallbackReason: "revoked" });
    expect(await rejected(themes.enable(ID))).toBe(true);
    expect(JSON.parse((await store.read("themeExtensions"))!).audit.map((a: { action: string }) => a.action)).toContain("broken");
    await approve(themes, await modThemePackage());
    expect((await themes.effective(ID)).digest).toBe(digest);
  });
});

describe("safe mode", () => {
  test("the launch flag resolves every theme to core through the disabled path and changes nothing stored", async () => {
    const store = memoryStateStore();
    const normal = await createThemeLifecycle(store, []);
    await approve(normal, await modThemePackage());
    const stored = await store.read("themeExtensions");
    const safe = await createThemeLifecycle(store, [], [], { safeMode: true });
    expect(await safe.effective(ID)).toMatchObject({ themeId: null, styles: null, slots: {}, fallbackReason: "disabled" });
    expect(await store.read("themeExtensions")).toBe(stored);
    expect((await createThemeLifecycle(store, [])).effective(ID)).resolves.toMatchObject({ themeId: ID });
  });

  const launch = async (store: ReturnType<typeof memoryStateStore>): Promise<Lifecycle> => createThemeLifecycle(store, []);
  test("after three launches that served a styled theme and never reached a healthy page, the styled themes are disabled, not revoked", async () => {
    const store = memoryStateStore();
    await approve(await launch(store), await modThemePackage());
    for (let i = 0; i < 3; i++) expect((await (await launch(store)).effective(ID)).themeId).toBe(ID);
    const fourth = await launch(store);
    expect(await fourth.effective(ID)).toMatchObject({ themeId: null, fallbackReason: "disabled" });
    const row = JSON.parse((await store.read("themeExtensions"))!).entries[ID];
    expect(row.enabled).toBe(false);
    expect(row.scopes).toContain("appearance.styles");
    expect(JSON.parse((await store.read("themeExtensions"))!).audit.map((a: { action: string }) => a.action)).toContain("crash-loop");
    await fourth.enable(ID);
    expect((await fourth.effective(ID)).styles).not.toBeNull();
  });

  test("a healthy page resets the count, and a theme without styles never counts", async () => {
    const store = memoryStateStore();
    await approve(await launch(store), await modThemePackage());
    for (let i = 0; i < 6; i++) { const t = await launch(store); expect((await t.effective(ID)).themeId).toBe(ID); await t.confirmHealthy(); }
    const plainStore = memoryStateStore();
    await approve(await launch(plainStore), await plain());
    for (let i = 0; i < 6; i++) expect((await (await launch(plainStore)).effective(ID)).themeId).toBe(ID);
    expect(JSON.parse((await plainStore.read("themeExtensions"))!).boot).toBeUndefined();
  });
});

describe("serving package files", () => {
  test("serves each file with its own type, only for the digest that is in force", async () => {
    const themes = await createThemeLifecycle(memoryStateStore(), []);
    const digest = await approve(themes, await modThemePackage());
    const image = await themes.asset(ID, "backdrop", digest);
    expect(image!.type).toBe("image/png");
    expect(Array.from(image!.body as Uint8Array)).toEqual(pngBytes());
    expect((await themes.asset(ID, "face", digest))!.type).toBe("font/woff2");
    expect(Array.from((await themes.asset(ID, "face", digest))!.body as Uint8Array)).toEqual(woff2Bytes());
    expect((await themes.asset(ID, "badge", digest))!.type).toBe("image/webp");
    expect(await themes.asset(ID, "nothing", digest)).toBeNull();
    expect(await themes.asset(ID, "backdrop", "f".repeat(64))).toBeNull();
    expect(png().length).toBeGreaterThan(0);
    await themes.revoke(ID);
    expect(await themes.asset(ID, "backdrop", digest)).toBeNull();
  });
});
