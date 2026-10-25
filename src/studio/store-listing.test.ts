/** Listing transport preserves the exact committed receipt identity without opening a body. */
import { expect, test } from "bun:test";
import { summaryOfListing } from "./store-listing";

test("summary projection retains write identity independently of history version", () => {
  const row = summaryOfListing({ kind: "character", id: "receipt", name: "Receipt", tokens: 1,
    version: 2, writeId: 7, revision: "committed-revision", updatedAt: 123 });
  expect(row.version).toBe(2);
  expect(row.writeId).toBe(7);
  expect(row.revision).toBe("committed-revision");
});
