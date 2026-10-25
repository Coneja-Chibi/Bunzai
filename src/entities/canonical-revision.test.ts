/** r2's structural root is a pure function of `decompose`'s own output, not a JSON hash. This pins
 * the exact formula so a future edit to the prefix or the
 * line format is a deliberate, visible revision bump. Per-field coverage lives in
 * piece-parts.test.ts; this file only owns the revision wrapper itself. */
import { expect, test } from "bun:test";
import { sha256Hex } from "../core/sha256";
import { entityRevision } from "./canonical-revision";
import { decompose } from "./piece-parts";
import type { ParsedCanonicalEntity } from "./runtime-schema";

test("entity revision is sha256(\"bunraku-rev-2\\n\" + one \"name\\thash\" line per part)", () => {
  const entity = {
    schemaVersion: "1",
    kind: "character",
    id: "ada",
    body: { identity: { name: "Ada" } },
  } as ParsedCanonicalEntity;
  const lines = decompose(entity).map((p) => `${p.name}\t${p.hash}`);
  expect(entityRevision(entity)).toBe(sha256Hex(`bunraku-rev-2\n${lines.join("\n")}`));
});

test("entity revision is still 64 lowercase hex", () => {
  const entity = {
    schemaVersion: "1",
    kind: "character",
    id: "ada",
    body: { identity: { name: "Ada" } },
  } as ParsedCanonicalEntity;
  expect(entityRevision(entity)).toMatch(/^[0-9a-f]{64}$/);
});
