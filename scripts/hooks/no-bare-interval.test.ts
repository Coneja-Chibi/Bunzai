/**
 * Red first: before useVisibleInterval existed, this
 * failed with every row of the idle audit table (the gate poll, Kit's animation intervals, the
 * favorites carousel). Green once each is routed through the helper or named in the allowlist.
 */
import { expect, test } from "bun:test";
import { bareIntervalHits } from "./no-bare-interval";

test("src/ui and src/kit/render call setInterval only through useVisibleInterval or a named, reasoned exception", () => {
  expect(bareIntervalHits()).toEqual([]);
});
