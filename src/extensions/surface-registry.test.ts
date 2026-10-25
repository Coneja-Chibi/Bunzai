/** The registry is the one id list; variant folders and manifests are checked against it so they cannot drift. */
import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CORE_VARIANT, isSurfaceId, isSurfaceVariant, SURFACES, surfaceAttribute, type SurfaceId } from "./surface-registry";

const ids = Object.keys(SURFACES) as SurfaceId[];

/** Every file under a `variants/<surface>/` folder anywhere in src/ui, as [surface, variant]. */
function variantFiles(dir: string, out: [string, string][] = []): [string, string][] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name === "variants") for (const surface of readdirSync(path)) {
      for (const file of readdirSync(join(path, surface))) out.push([surface, file.replace(/\.module\.css$|\.[a-z]+$/, "")]);
    } else variantFiles(path, out);
  }
  return out;
}

describe("surface registry", () => {
  test("30 surfaces, four distinct variants each, none named like the core fallback", () => {
    expect(ids).toHaveLength(30);
    for (const id of ids) {
      expect(new Set(SURFACES[id]).size, id).toBe(4);
      expect(SURFACES[id] as readonly string[], id).not.toContain(CORE_VARIANT);
    }
  });

  test("ids parse closed: prototype keys and near misses are not surfaces", () => {
    expect(isSurfaceId("shell.nav")).toBe(true);
    for (const bad of ["__proto__", "constructor", "shell.Nav", "shell-nav", ""]) expect(isSurfaceId(bad)).toBe(false);
    expect(isSurfaceVariant("shell.nav", "tab-bar")).toBe(true);
    expect(isSurfaceVariant("shell.nav", "core")).toBe(false);
    expect(surfaceAttribute("shell.nav")).toBe("data-surface-shell-nav");
  });

  test("every variants/<surface>/<variant> file in src/ui names a registered surface and variant", () => {
    for (const [surface, variant] of variantFiles(new URL("../ui", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) {
      expect(isSurfaceId(surface), `${surface} is not a surface id`).toBe(true);
      expect(isSurfaceVariant(surface as SurfaceId, variant), `${surface}/${variant} is not a registered variant`).toBe(true);
    }
  });
});
