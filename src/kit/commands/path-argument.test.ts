/** Shared path argument normalization preserves unquoted paths and trims a pasted quote pair. */
import { expect, test } from "bun:test";
import { pathArgument } from "./path-argument";

test("pathArgument trims whitespace and surrounding single or double quotes", () => {
  expect(pathArgument("  C:/shared/folder  ")).toBe("C:/shared/folder");
  expect(pathArgument('  "C:/shared folder"  ')).toBe("C:/shared folder");
  expect(pathArgument("'C:/shared folder'")).toBe("C:/shared folder");
});
