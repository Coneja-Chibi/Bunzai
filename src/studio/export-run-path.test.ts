/**
 * The Export folder's path policy: the run folder and file names the server accepts, and the names it
 * mints from whatever the page asked for (path-policy.ts), plus the shared filename cleaner they rest on.
 */
import { expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { exportRunFileName, resolveStudioExportRunPath } from "./path-policy";
import { sanitizeDownloadBase } from "../core/download-name";

const root = join(tmpdir(), "studio");

test("a run folder and a file in it resolve under Export", () => {
  expect(resolveStudioExportRunPath(root, "2026-10-24 09-00-00 JanitorAI")).toBe(resolve(root, "Export", "2026-10-24 09-00-00 JanitorAI"));
  expect(resolveStudioExportRunPath(root, "run", "Vera.png")).toBe(resolve(root, "Export", "run", "Vera.png"));
});

test("anything that is not one plain segment, or not an export type, is refused", () => {
  for (const folder of ["..", ".", "a/..", "a/b", "a\\b", "C:", "con", "", " run"]) {
    expect(() => resolveStudioExportRunPath(root, folder)).toThrow();
  }
  for (const name of ["../x.json", "a/b.png", "a\\b.png", "C:x.json", "CON.png", ".json", "x.PNG", "x.exe", "noext", "a.json."]) {
    expect(() => resolveStudioExportRunPath(root, "run", name)).toThrow();
  }
});

test("the server mints a name every page request can use, and refuses only a type no export writes", () => {
  expect(exportRunFileName("Vera.png")).toBe("Vera.png");
  expect(exportRunFileName("Vera.PNG", 2)).toBe("Vera (2).png");
  expect(exportRunFileName("../../evil.json")).toBe("_.._evil.json");
  expect(() => resolveStudioExportRunPath(root, "run", "_.._evil.json")).not.toThrow();
  expect(exportRunFileName("CONOUT$.json")).toBe("_CONOUT$.json");
  expect(exportRunFileName("‮gnp.exe.json")).toBe("_gnp.exe.json");
  const long = exportRunFileName(`${"a".repeat(80)}.png`, 2);
  expect(Array.from(long.slice(0, -4)).length).toBe(80);
  expect(() => resolveStudioExportRunPath(root, "run", long)).not.toThrow();
  expect(exportRunFileName(`${"b".repeat(79)}\u{1F600}.png`)).toBe(`${"b".repeat(79)}\u{1F600}.png`);
  for (const bad of ["x.exe", "x.html", "noext", ".json"]) expect(() => exportRunFileName(bad)).toThrow();
});

test("the shared cleaner cuts by code points and settles in one pass", () => {
  expect(sanitizeDownloadBase(`${"x".repeat(79)}\u{1F600}tail`, "f")).toBe(`${"x".repeat(79)}\u{1F600}`);
  for (const raw of ["a .", "name. ", "  lead", "COM¹", "LPT³.txt"]) {
    const once = sanitizeDownloadBase(raw, "f");
    expect(sanitizeDownloadBase(once, "f")).toBe(once);
  }
  expect(sanitizeDownloadBase("COM¹", "f")).toBe("_COM¹");
});
