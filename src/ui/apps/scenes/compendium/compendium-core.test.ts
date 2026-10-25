/** The Compendium wing's pure helpers: which book opens first, search, initials and the severity scale. */
import { expect, test } from "bun:test";
import { firstBookId, initialsOf, severityRole, severityStep, titled } from "./compendium-core";

const book = (id: string, enabled: boolean, missing = false) => ({ id, enabled, missing }) as never;

test("the first book is the first one switched on, else the first that exists", () => {
  expect(firstBookId([book("a", false), book("b", true), book("c", true)])).toBe("b");
  expect(firstBookId([book("a", true, true), book("b", false)])).toBe("b");
  expect(firstBookId([book("a", true, true)])).toBeNull();
  expect(firstBookId([])).toBeNull();
});

test("initials take the first letter of up to two words", () => {
  expect(initialsOf("Mira Vance")).toBe("MV");
  expect(initialsOf("astra")).toBe("A");
  expect(initialsOf("Dov  Ketter the Third")).toBe("DK");
});

test("severity maps to a step and a role, unknown reads as none", () => {
  expect(severityStep("minor")).toBe(1);
  expect(severityStep("extinction_level")).toBe(5);
  expect(severityStep("unheard_of")).toBe(0);
  expect(severityRole(5)).toBe("danger");
  expect(severityRole(3)).toBe("warn");
  expect(severityRole(1)).toBe("mid");
});

test("titled turns snake case into words", () => {
  expect(titled("extinction_level")).toBe("Extinction Level");
});
