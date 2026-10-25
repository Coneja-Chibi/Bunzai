/** Prefix ranking keeps direct matches ahead of broader contained matches. */
import { expect, test } from "bun:test";
import { rankByQuery } from "./rank-by-query";

test("sorts prefix matches before sorted contained matches", () => {
  const ranked = rankByQuery(["party", "compartment", "parade"], "par", {
    prefix: (value) => value.startsWith("par"),
    contains: (value) => value.includes("par"),
    compare: (a, b) => a.localeCompare(b),
  });
  expect(ranked).toEqual(["parade", "party", "compartment"]);
});
