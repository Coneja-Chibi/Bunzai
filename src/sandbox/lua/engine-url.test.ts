/** Browser wasm paths retain the project prefix on both the page and its worker. */
import { describe, expect, test } from "bun:test";
import { resolveBrowserWasmUri } from "./engine";

describe("resolveBrowserWasmUri", () => {
  test("resolves from a GitHub project page", () => {
    expect(resolveBrowserWasmUri("https://coneja-chibi.github.io/Bunzai/", true)).toBe(
      "https://coneja-chibi.github.io/Bunzai/sandbox/glue.wasm",
    );
  });

  test("resolves beside its worker", () => {
    expect(resolveBrowserWasmUri("https://coneja-chibi.github.io/Bunzai/sandbox/worker.js", false)).toBe(
      "https://coneja-chibi.github.io/Bunzai/sandbox/glue.wasm",
    );
  });
});
