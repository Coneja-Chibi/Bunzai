/**
 * Every registered variant of the shell, Library, Scenes and shared ui.* surfaces is built (a file beside its
 * surface), and no variant stylesheet reaches around the contract: square corners, no raw color, no theme-id
 * selector, no dark-only premiere token (Paper is light).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SURFACES, type SurfaceId } from "../../extensions/surface-registry";

const BUILT: SurfaceId[] = ["shell.nav", "shell.status", "shell.title", "library.grid", "library.card", "scenes.list", "ui.dialog", "ui.icons", "ui.panel", "ui.meter", "ui.toast", "ui.empty", "ui.toolbar", "library.decks", "ui.section-header", "ui.tabs", "ui.label-type"]; // grows as each surface lands; the final list is all twelve
/** The variant its owning component draws itself (the current rendering, which is also the fallback), so it has no file of its own. */
const DRAWN_BY_COMPONENT: Partial<Record<SurfaceId, string>> = { "shell.title": "proscenium" };
const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function variantFiles(dir: string, out: { surface: string; variant: string; path: string }[] = []): typeof out {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) continue;
    if (name === "variants") for (const surface of readdirSync(path)) for (const file of readdirSync(join(path, surface))) out.push({ surface, variant: file.replace(/\.module\.css$|\.[a-z]+$/, ""), path: join(path, surface, file) });
    else variantFiles(path, out);
  }
  return out;
}
const files = variantFiles(ROOT);

describe("built variants", () => {
  for (const id of BUILT) test(`${id}: all ${SURFACES[id].length} variants exist`, () => {
    const have = new Set(files.filter((f) => f.surface === id).map((f) => f.variant));
    for (const variant of SURFACES[id].filter((v) => v !== DRAWN_BY_COMPONENT[id])) expect(have.has(variant), `${id}/${variant}`).toBe(true);
  });

  test("variant stylesheets keep the contract", () => {
    for (const f of files.filter((f) => f.path.endsWith(".css") && (BUILT as string[]).includes(f.surface))) {
      const css = readFileSync(f.path, "utf8");
      const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
      expect(/border-radius\s*:(?!\s*(?:0\b|var\(--bk-dot-radius\)|50%))/.test(stripped), `${f.path} rounds a corner`).toBe(false);
      expect(/#[0-9a-fA-F]{3,8}\b/.test(stripped.replace(/url\([^)]*\)/g, "")), `${f.path} has a raw color`).toBe(false);
      expect(/data-theme/.test(stripped), `${f.path} selects on a theme id`).toBe(false);
      expect(/--premiere-/.test(stripped), `${f.path} reads a dark-only token`).toBe(false);
    }
  });
});
