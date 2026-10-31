/** Website guides: slugs, link re-pointing, and rendering of a docs/guide page. */
import { describe, expect, test } from "bun:test";
import { guideSlug, relink, renderGuide } from "./guides";

describe("guideSlug", () => {
  test("flattens guide paths and names the READMEs after their folder", () => {
    expect(guideSlug("docs/guide/lorebooks.md")).toBe("lorebooks");
    expect(guideSlug("docs/guide/platforms/risu.md")).toBe("platforms-risu");
    expect(guideSlug("docs/guide/README.md")).toBe("index");
    expect(guideSlug("docs/guide/platforms/README.md")).toBe("platforms");
    expect(guideSlug("docs/reference/ui.md")).toBeNull();
  });
});

describe("relink", () => {
  const from = "docs/guide/getting-started.md";
  test("another guide becomes its site page, keeping the anchor", () => {
    expect(relink("importing.md", from)).toBe("importing.html");
    expect(relink("platforms/risu.md#cards", from)).toBe("platforms-risu.html#cards");
    expect(relink("../README.md", "docs/guide/platforms/risu.md")).toBe("index.html");
  });
  test("media points at the site's media folder, everything else at GitHub", () => {
    expect(relink("../media/shot-library.png", from)).toBe("../media/shot-library.png");
    expect(relink("../reference/ui.md#scenes", from)).toBe(
      "https://github.com/Vaudeville-Studios/Bunzai/blob/Mainstage/docs/reference/ui.md#scenes",
    );
  });
  test("absolute links and in-page anchors are left alone", () => {
    expect(relink("https://example.com/a.md", from)).toBe("https://example.com/a.md");
    expect(relink("#tips", from)).toBe("#tips");
  });
});

describe("renderGuide", () => {
  test("drops front matter and figure directives, keeps meta, re-points links", () => {
    const source = "---\ntitle: Get started\nsummary: Install it.\n---\n\n# Get started\n\n@fig boot\n\nSee [importing](importing.md).\n\n![Dock](../media/shot-dock.png)\n";
    const guide = renderGuide("docs/guide/getting-started.md", source)!;
    expect(guide.slug).toBe("getting-started");
    expect(guide.title).toBe("Get started");
    expect(guide.summary).toBe("Install it.");
    expect(guide.html).not.toContain("@fig");
    expect(guide.html).not.toContain("summary:");
    expect(guide.html).toContain('href="importing.html"');
    expect(guide.html).toContain('src="../media/shot-dock.png"');
  });
  test("a path outside the guide folder renders nothing", () => {
    expect(renderGuide("docs/reference/ui.md", "# UI")).toBeNull();
  });
});
