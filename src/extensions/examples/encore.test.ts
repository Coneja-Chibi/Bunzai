/** Encore, the example package, stays a real use of every theme power: it passes the inspector, derives all nine scopes, and only aims at parts that exist. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inspectThemePackage, type ThemePackageInput } from "../theme-contract";
import { SLOT_IDS } from "../slot-registry";

const dir = new URL("./bunraku.theme.encore/", import.meta.url);
const text = (path: string): string => readFileSync(new URL(path, dir), "utf8");
const base64 = (path: string): string => readFileSync(new URL(path, dir)).toString("base64");

async function envelope(): Promise<ThemePackageInput> {
  const manifest = JSON.parse(text("manifest.json")) as { assets: { path: string; mediaType: string }[]; fonts: { path: string }[] };
  const assets: Record<string, string> = { "styles.css": text("styles.css") };
  for (const a of manifest.assets) assets[a.path] = a.mediaType === "image/svg+xml" ? text(a.path) : base64(a.path);
  for (const f of manifest.fonts) assets[f.path] = base64(f.path);
  return { manifest, assets, licenseText: text("LICENSE.txt") };
}

test("the package passes the inspector and uses every power", async () => {
  const preview = await inspectThemePackage(await envelope());
  expect(preview.derivedScopes).toEqual(expect.arrayContaining(["appearance.styles", "appearance.fonts", "appearance.assets", "ui.slots"]));
  expect(preview.derivedScopes).toHaveLength(9);
  expect(preview.styles).not.toBeNull();
  expect(preview.fonts).toHaveLength(1);
  expect(preview.assets.some((a) => a.mediaType === "image/png")).toBe(true);
  expect(Object.keys(preview.slots).length).toBeGreaterThanOrEqual(2);
});

test("its stylesheet aims at five or more parts, and every named part exists in the generated parts page", () => {
  const css = text("styles.css");
  const named = new Set([...css.matchAll(/data-part="([a-z.-]+)"/g)].map((m) => m[1]!));
  expect(named.size).toBeGreaterThanOrEqual(5);
  const page = readFileSync(new URL("../../../docs/generated/theme-parts.md", import.meta.url), "utf8");
  for (const part of named) expect(page, part).toContain("`" + part + "`");
});

test("its slot ids are real slots", async () => {
  const preview = await inspectThemePackage(await envelope());
  for (const id of Object.keys(preview.slots)) expect(SLOT_IDS as readonly string[]).toContain(id);
});
