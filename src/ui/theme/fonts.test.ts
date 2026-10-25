/**
 * The shipped fonts (theme/fonts.ts): the list, the folder, the @font-face rules in tokens.css, and
 * the licenses agree, and the server serves exactly the listed files and nothing else.
 */
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { handleAssetRoutes } from "../server-static";
import { FONT_FILES } from "./fonts";

const dir = fileURLToPath(new URL("./fonts/", import.meta.url));
const tokens = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");

test("every font file on disk is on the list, and every listed file is on disk", () => {
  expect(readdirSync(dir).filter((f) => f.endsWith(".woff2")).sort()).toEqual([...FONT_FILES].sort());
});

test("tokens.css declares each listed file once, and nothing else from the fonts folder", () => {
  const used = [...tokens.matchAll(/url\("fonts\/([^"]+)"\)/g)].map((m) => m[1]);
  expect([...used].sort()).toEqual([...FONT_FILES].sort());
});

test("every font ships with its license", () => {
  const families = new Set(FONT_FILES.map((f) => f.replace(/-latin(-ext)?-(normal|italic)(-\d{3})?\.woff2$/, "")));
  for (const family of families) expect(readFileSync(`${dir}OFL-${family}.txt`, "utf8")).toContain("SIL Open Font License");
});

test("the server serves the listed fonts as woff2, and refuses any other name", async () => {
  const ok = (await handleAssetRoutes("/fonts/cinzel-latin-normal.woff2"))!;
  expect(ok.status).toBe(200);
  expect(ok.headers.get("content-type")).toBe("font/woff2");
  expect(new Uint8Array(await ok.arrayBuffer()).slice(0, 4)).toEqual(new Uint8Array([0x77, 0x4f, 0x46, 0x32])); // "wOF2"
  for (const bad of ["/fonts/OFL-cinzel.txt", "/fonts/../tokens.css", "/fonts/evil.woff2", "/fonts/"]) {
    expect(await handleAssetRoutes(bad)).toBeNull();
  }
});

test("a packaged build serves the fonts it baked", async () => {
  const packaged = { fontsB64: { "cinzel-latin-normal.woff2": Buffer.from("wOF2-baked").toString("base64") } } as never;
  const res = (await handleAssetRoutes("/fonts/cinzel-latin-normal.woff2", packaged))!;
  expect(await res.text()).toBe("wOF2-baked");
  expect(await handleAssetRoutes("/fonts/archivo-latin-normal.woff2", packaged)).toBeNull();
});
