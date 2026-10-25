/** Unique-list proof: first occurrence order is kept for tolerant readers. */
import { expect, test } from "bun:test";
import { uniqueBy } from "./unique";

test("keeps the first row for each key in input order", () => {
  expect(uniqueBy([{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "a", v: 3 }], (row) => row.id)).toEqual([
    { id: "a", v: 1 },
    { id: "b", v: 2 },
  ]);
});
