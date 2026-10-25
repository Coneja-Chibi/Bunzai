/**
 * VVS-609: "getvar returns empty in same Scenario as setvar". RoleCall's regression pins
 * (lib/macros/__tests__/vvs-609-same-field-var-ordering.test.ts at the pin), all six cases: a
 * variable set earlier in one field is read later in that same field, through literal
 * setvar/getvar, dot-var sugar, a {{roll}} assignment, and the reporter's full multiline compound.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";

const run = (text: string): string => processMacros(text, createDefaultContext({})).text;

describe("vvs-609 repro", () => {
  test("switch sees a variable set earlier in the same text", () => {
    expect(run("{{setvar::mood::happy}}{{switch::{{getvar::mood}}::happy:MATCHED::NOMATCH}}")).toBe("MATCHED");
  });

  test("dot-var assignment then dot-var read works in the same text", () => {
    expect(run("{{.mood = happy}}[{{.mood}}]")).toBe("[happy]");
  });

  test("switch over a dot-var assigned earlier in the same text (reporter's exact shape)", () => {
    expect(run("{{.roll = 3}}{{.label = {{switch::{{.roll}}::1:One::2:Two::3:Three::Other}}}}[{{.label}}]")).toBe("[Three]");
  });

  test("nested assignment from a macro then switch read (roll shape)", () => {
    expect(run("{{.r = {{roll::1d1}}}}{{switch::{{.r}}::1:ONE::NOTONE}}")).toBe("ONE");
  });

  test("multiline scenario with roll, switch arms containing noop, and if/compare reads (full reporter shape)", () => {
    const text = [
      "{{.f1_roll = {{roll::1d1}}}}",
      "{{.f1 = {{switch::{{.f1_roll}}::1:Reputation::2:Flag::13:{{noop}}::Other}}}}",
      "{{.depth = 3}}",
      "{{.v2 = {{if::{{compare::{{.depth}}::>=::2}}::{{.f1}}}}}}",
      "Result: [{{.v2}}]",
    ].join("\n");
    expect(run(text)).toContain("Result: [Reputation]");
  });

  test("plain getvar sees a variable set earlier in the same text", () => {
    expect(run("{{setvar::mood::happy}}[{{getvar::mood}}]")).toBe("[happy]");
  });
});
