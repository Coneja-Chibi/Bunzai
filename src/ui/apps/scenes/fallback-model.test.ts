/** The stored Fallback Model choice reads fail-closed: only a whole custom connection is custom, everything else is off. */
import { describe, expect, test } from "bun:test";
import { readFallback } from "./fallback-model";

describe("readFallback", () => {
  test("a whole custom connection is kept", () => {
    expect(readFallback({ mode: "custom", connection: { id: "k1", model: "m" } })).toEqual({ mode: "custom", connection: { id: "k1", model: "m" } });
  });
  test("unset, malformed, auto and half a connection all read as off", () => {
    for (const raw of [undefined, null, "custom", [], {}, { mode: "auto" }, { mode: "custom" }, { mode: "custom", connection: { id: "k1" } }, { mode: "custom", connection: { id: 3, model: "m" } }]) {
      expect(readFallback(raw)).toEqual({ mode: "off" });
    }
  });
});
