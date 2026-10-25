/**
 * Loads react-dom once, before any test file, with a DOM present (bunfig.toml preload).
 *
 * react-dom decides at load whether a browser exists (canUseDOM, and whether the `input` event is
 * supported), and every test file in a `bun test` run shares that one loaded copy. A file that
 * imports react-dom at its top, before its own beforeAll installs a JSDOM window, used to load it
 * with no DOM; from then on every later file's text inputs silently stopped firing onChange, so a
 * test's pass or fail depended on file order. Loading it here, inside a throwaway window that is
 * removed again afterwards, fixes that decision once. Each test file still installs its own DOM.
 */
import { JSDOM } from "jsdom";

const KEYS = ["window", "document", "navigator"] as const;
const g = globalThis as unknown as Record<string, unknown>;
const had = KEYS.map((k) => [k, k in g, g[k]] as const);

const dom = new JSDOM("<!doctype html><html><body></body></html>");
g["window"] = dom.window;
g["document"] = dom.window.document;
g["navigator"] = dom.window.navigator;
await import("react-dom");
await import("react-dom/client");

for (const [k, present, value] of had) {
  if (present) g[k] = value;
  else delete g[k];
}
dom.window.close();
