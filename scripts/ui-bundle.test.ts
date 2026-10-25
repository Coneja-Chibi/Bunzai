/**
 * bundleBrowser's production-React opts: minify + NODE_ENV
 * production must strip React's dev build out of the vendor bundle, and the default call (what
 * build-pages.ts and build-site.ts still use) must stay exactly as unminified as before - those
 * scripts are outside this change's scope and are not touched.
 */
import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { bundleBrowser, PROD_REACT_DEFINE, VENDOR_SPECS } from "./ui-bundle";

const reactDomEntry = fileURLToPath(VENDOR_SPECS["react-dom-client"]!.entryUrl);
const reactDomExternal = VENDOR_SPECS["react-dom-client"]!.external;

describe("bundleBrowser production React", () => {
  test("default call ships development React unminified (build-pages/build-site's shape, unchanged)", async () => {
    const code = await bundleBrowser(reactDomEntry, reactDomExternal);
    // react-dom-client.development.js carries its own filename in a header comment that survives
    // an unminified bundle - the same marker scripts/build-desktop.ts's bake gate checks for.
    expect(code).toContain(".development");
  });

  test("minify + PROD_REACT_DEFINE strips the development build out of the vendor bundle", async () => {
    const dev = await bundleBrowser(reactDomEntry, reactDomExternal);
    const prod = await bundleBrowser(reactDomEntry, reactDomExternal, { minify: true, define: PROD_REACT_DEFINE });
    expect(prod).not.toContain(".development");
    // Budget guard on R3's measured win (921 KB dev -> 184 KB prod for this exact bundle): not the
    // literal byte count, but the shape of the win, so a regression that quietly stops minifying
    // still fails this.
    expect(prod.length).toBeLessThan(dev.length / 2);
  });
});
