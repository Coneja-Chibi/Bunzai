/**
 * Byte-identity proof for piece-parts.ts at the
 * scale-matrix fixtures named in the run order: the 3,000-block
 * preset, the 5,000-entry lorebook, and characters carrying art (shared art and a PNG-sourced escrow
 * twin). Heavier than piece-parts.test.ts's fixture sweep, so it lives beside the other scale tests
 * rather than in the fast suite. Also covers the one committed real-format fixture that produces a
 * full canonical entity after import (NovelAI's lorebook slice): "every format fixture after
 * import" from the P1 red-test list, scoped to fixtures that actually exist as files with an
 * entity-producing adapter - no generic cross-format loader exists in this repo to reuse.
 */
import { expect, test } from "bun:test";
import novelaiLorebook from "../../src/formats/novelai/lorebook";
import { entityRevision } from "../../src/entities/canonical-revision";
import { assemble, decompose } from "../../src/entities/piece-parts";
import { parseCanonicalEntity } from "../../src/entities/runtime-schema";
import { characters } from "./fixtures/character";
import { LOREBOOK_SCALE_N, lorebook } from "./fixtures/lorebook";
import { PRESET_SCALE_N, preset } from "./fixtures/preset";

function identical(raw: unknown) {
  const entity = parseCanonicalEntity(raw);
  const roundTripped = assemble(decompose(entity));
  expect(JSON.stringify(roundTripped)).toBe(JSON.stringify(entity));
  expect(entityRevision(roundTripped)).toBe(entityRevision(entity));
}

test(`preset at scale (${PRESET_SCALE_N} blocks)`, () => {
  identical(preset(PRESET_SCALE_N));
}, 30_000);

test(`lorebook at scale (${LOREBOOK_SCALE_N} entries)`, () => {
  identical(lorebook(LOREBOOK_SCALE_N));
}, 30_000);

test("characters with art: shared portraits and a PNG-sourced escrow twin", () => {
  // n=7 crosses both i%5===4 (a card sharing the last unique portrait) and the fromPng branch
  // (uniqueCount%3===0) without paying for hundreds of 1-3 MB bodies.
  let count = 0;
  for (const character of characters(7)) {
    identical(character);
    count++;
  }
  expect(count).toBe(7);
}, 30_000);

test("format fixture after import: NovelAI's committed lorebook slice", async () => {
  const FIXTURE_PATH = new URL("../../src/formats/novelai/fixtures/nai-v3-mal.slice.lorebook.json", import.meta.url);
  const text = await Bun.file(FIXTURE_PATH).text();
  const canon = novelaiLorebook.toCanonical({ text });
  identical(canon);
});
