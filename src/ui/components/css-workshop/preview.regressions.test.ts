/**
 * Regression: a second dangerouslySetInnerHTML-equivalent call site must sanitize from the one
 * seal-policy authority, not its own hand-copied tag list - a hand-copied list is exactly how a
 * sanitized call site and an unsanitized sibling can silently drift apart. This proves the
 * CssWorkshop preview still forbids every tag the shared policy forbids.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { installDom, type InstalledDom } from "../../_shared/test-dom";
import { SEALED_FORBID_TAGS } from "../../../core/render/seal-policy";

describe("CssWorkshop's sealed srcDoc strips the same tags seal-policy forbids", () => {
  let buildCssWorkshopSrcDoc: (mockHtml: string, authorCss: string) => string;
  let installed: InstalledDom;

  beforeAll(async () => {
    installed = installDom("");
    ({ buildCssWorkshopSrcDoc } = await import("./preview"));
  });

  afterAll(() => installed.teardown());

  test("every tag on the shared forbidden list is absent from the generated body", () => {
    const mockHtml = SEALED_FORBID_TAGS.map((tag) => `<${tag}>x</${tag}>`).join("");
    const srcDoc = buildCssWorkshopSrcDoc(mockHtml, "");
    const body = srcDoc.slice(srcDoc.indexOf("<body>"));
    for (const tag of SEALED_FORBID_TAGS) {
      expect(body.toLowerCase()).not.toContain(`<${tag}`);
    }
  });

  test("a script tag never reaches the sealed document", () => {
    const srcDoc = buildCssWorkshopSrcDoc("<script>alert(1)</script><p>safe</p>", "");
    expect(srcDoc.toLowerCase()).not.toContain("<script");
    expect(srcDoc).toContain("safe");
  });
});
