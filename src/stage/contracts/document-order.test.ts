/** Shared stored document ordering contract. */
import { expect, test } from "bun:test";
import { compareDocumentOrder } from "./document-order";

test("orders by kind then id and treats identical keys as equal", () => {
  expect([
    { kind: "preset", id: "z" },
    { kind: "character", id: "b" },
    { kind: "character", id: "a" },
  ].sort(compareDocumentOrder)).toEqual([
    { kind: "character", id: "a" },
    { kind: "character", id: "b" },
    { kind: "preset", id: "z" },
  ]);
  expect(compareDocumentOrder({ kind: "x", id: "y" }, { kind: "x", id: "y" })).toBe(0);
});
