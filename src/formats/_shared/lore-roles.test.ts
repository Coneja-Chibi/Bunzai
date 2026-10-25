/** The injection-role tables every Tavern-family codec shares: one answer for every spelling. */
import { describe, expect, test } from "bun:test";
import { parseRole, parseRoleName, roleToNumber } from "./lore-enums";

describe("injection role tables", () => {
  test("ST integers: 0 system, 1 user, 2 assistant, anything else is system", () => {
    expect(parseRole(0)).toBe("system");
    expect(parseRole(1)).toBe("user");
    expect(parseRole(2)).toBe("assistant");
    for (const odd of [7, -1, 1.5, "1", null, undefined]) expect(parseRole(odd)).toBe("system");
  });
  test("integers round-trip", () => {
    for (const n of [0, 1, 2]) expect(roleToNumber(parseRole(n))).toBe(n);
  });
  test("string spellings (Marinara, Risu) use the same default", () => {
    expect(parseRoleName("user")).toBe("user");
    expect(parseRoleName("assistant")).toBe("assistant");
    expect(parseRoleName("system")).toBe("system");
    for (const odd of ["tool", "USER", 1, null, undefined]) expect(parseRoleName(odd)).toBe("system");
  });
});
