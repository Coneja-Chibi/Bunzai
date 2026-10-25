/** The Macros view's pure rules (rc-parity 08): the tiles, the hotspot order, and the search. */
import { describe, expect, test } from "bun:test";
import type { MacroReport } from "../../../../core/assembly/types";
import { macroRows, macroTiles } from "./macros-core";

const report: MacroReport = {
  total: 6,
  used: [
    { name: "char", count: 3, tokens: 3, example: "{{char}}", value: "Vera" },
    { name: "description", count: 1, tokens: 40, example: "{{description}}", value: "Tall, keeps the light." },
    { name: "user", count: 2, tokens: 3, example: "{{user}}", value: "Sam" },
  ],
  errors: [{ macro: "{{nope}}", message: "unknown macro" }],
  mutations: [],
};

describe("macroTiles", () => {
  test("every expansion, the tokens they produced, and the failures", () => {
    expect(macroTiles(report)).toEqual({ macros: 6, tokens: 46, errors: 1 });
  });
});

describe("macroRows", () => {
  test("hotspots first: the most tokens, then the most uses, then the name", () => {
    expect(macroRows(report, "").map((r) => r.name)).toEqual(["description", "char", "user"]);
  });
  test("the search reads the name, the macro as written and what it produced, any case", () => {
    expect(macroRows(report, "VERA").map((r) => r.name)).toEqual(["char"]);
    expect(macroRows(report, "{{desc").map((r) => r.name)).toEqual(["description"]);
    expect(macroRows(report, "keeps the").map((r) => r.name)).toEqual(["description"]);
    expect(macroRows(report, "  ").length).toBe(3);
    expect(macroRows(report, "zzz")).toEqual([]);
  });
});
