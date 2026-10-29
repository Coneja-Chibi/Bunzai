/** Preview server containment rejects URL and Windows traversal spellings. */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { resolvePagesPreviewPath } from "./pages-preview-path";

const root = resolve("dist/pages");

describe("resolvePagesPreviewPath", () => {
  test("serves the project root and nested assets", () => {
    expect(resolvePagesPreviewPath(root, "/Bunzai/")).toBe(resolve(root, "index.html"));
    expect(resolvePagesPreviewPath(root, "/Bunzai/docs/a.md")).toBe(resolve(root, "docs/a.md"));
  });

  test.each([
    "/Bunzai/../package.json",
    "/Bunzai/..%5Cpackage.json",
    "/Bunzai/C:%5CWindows%5Cwin.ini",
    "/Bunzai/%E0%A4%A",
  ])("rejects %s", (pathname) => expect(resolvePagesPreviewPath(root, pathname)).toBeNull());
});
