/** The "Make a theme" guide stays true: its starter validates, and it names every surface and variant the host registry lists. */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inspectThemePackage } from "./theme-contract";
import { SURFACES, type SurfaceId } from "./surface-registry";

const guide = readFileSync(new URL("../../docs/reference/extending/make-a-theme.md", import.meta.url), "utf8");

test("the copy-paste starter in the guide inspects as a valid package", async () => {
  const json = /```json\n([\s\S]*?)\n```/.exec(guide)?.[1];
  expect(json).toBeDefined();
  const preview = await inspectThemePackage({ manifest: JSON.parse(json!), assets: {} });
  expect(preview.id).toBe("bunraku.theme.starter");
  expect(preview.derivedScopes).not.toContain("appearance.assets");
});

test("the guide lists every surface id and every variant id in the registry", () => {
  for (const id of Object.keys(SURFACES) as SurfaceId[]) {
    expect(guide, id).toContain("`" + id + "`");
    for (const variant of SURFACES[id]) expect(guide, `${id}/${variant}`).toContain("`" + variant + "`");
  }
});
