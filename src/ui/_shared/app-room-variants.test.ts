/** app.room: every variant stylesheet of every room app sits under its own root attribute, stays square and token-only, and hides nothing. */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { SURFACES } from "../../extensions/surface-registry";

const roomFolders = ["../setup", "../apps/press", "../apps/agent", "../apps/css-workshop"].map((p) => new URL(`${p}/variants/app.room/`, import.meta.url));
const read = (dir: URL, file: string) => readFileSync(new URL(file, dir), "utf8");
const styled = SURFACES["app.room"].filter((v) => v !== "ledger-rail");

describe("app.room variant stylesheets", () => {
  test("each room app ships exactly the non-base variants, and ledger-rail stays the unstyled base", () => {
    for (const dir of roomFolders) expect(readdirSync(dir).sort(), dir.pathname).toEqual(styled.map((v) => `${v}.css`).sort());
  });

  for (const dir of roomFolders) for (const variant of styled) {
    const where = `${dir.pathname.split("/").filter(Boolean).slice(-3, -2).join("")}/${variant}`;
    const css = read(dir, `${variant}.css`).replace(/\/\*[\s\S]*?\*\//g, "");
    test(`${where} is scoped, square, token-only and hides nothing`, () => {
      const scope = `html[data-surface-app-room="${variant}"]`;
      const tops = css.split("\n").filter((line) => /^[^\s}@]/.test(line));
      expect(tops.length).toBeGreaterThan(0);
      for (const line of tops) expect(line.startsWith(scope), line).toBe(true);
      expect(css).not.toMatch(/border-radius:\s*(?:[^0\s;]|0[.\d])/);
      expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
      expect(css).not.toMatch(/outline:\s*(none|0)\b/);
      // only decoration may go: a pseudo-element or the setup stage ornaments, never a part a person uses
      for (const line of css.split("\n").filter((l) => /display:\s*none|visibility:\s*hidden/.test(l))) expect(line, line).toMatch(/::(before|after)|\.orn\b/);
    });
  }
});
