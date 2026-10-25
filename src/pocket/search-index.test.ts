/** Unrun portable search admission regressions at the worker-owned mutation boundary. */
import { expect, test } from "bun:test";
import { PocketSearchIndex, SEARCH_BYTES } from "./search-index";

test("a rejected batch publishes no partial documents", () => {
  const index = new PocketSearchIndex();
  expect(() => index.mutate({ requestId: 1, op: "upsert", docs: [
    { kind: "character", id: "ok", name: "Before", snippet: "Before" },
    { kind: "character", id: "", name: "Invalid", snippet: "Invalid" },
  ] })).toThrow();
  expect(index.documents.size).toBe(0);
});

test("duplicate updates retain one final document and one charge", () => {
  const index = new PocketSearchIndex();
  index.mutate({ requestId: 1, op: "upsert", docs: [
    { kind: "character", id: "a", name: "Before", snippet: "Before" },
    { kind: "character", id: "a", name: "After", snippet: "After" },
  ] });
  expect(index.documents.size).toBe(1);
  expect(index.documents.get("character\0a")?.value.name).toBe("After");
  const bytes = index.bytes;
  index.mutate({ requestId: 2, op: "upsert", docs: [{ kind: "character", id: "a", name: "After", snippet: "After" }] });
  expect(index.bytes).toBe(bytes);
});

test("queued reservations count before retained index publication", () => {
  const index = new PocketSearchIndex(() => SEARCH_BYTES);
  expect(() => index.mutate({ requestId: 1, op: "upsert", docs: [{ kind: "character", id: "a", name: "A", snippet: "A" }] })).toThrow();
  expect(index.bytes).toBe(0);
  expect(index.documents.size).toBe(0);
});
