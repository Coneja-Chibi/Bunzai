/**
 * Kit writes binary carriers too: asked for a JanitorAI card, studio_export used to stop at "binary
 * target" and point at the CLI. The PNG now lands in its own Export folder, byte for byte what the
 * adapter emitted, carrying the card under `chara` and the card's own art.
 */
import { afterAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StudioExports } from "../../studio/exports";
import { characterAdapter as sillytavern } from "../../formats/sillytavern/index";
import { textChunks } from "../../formats/_fixtures/host-card";
import type { KitBridge, KitEntity } from "../bridge";
import exportPiece from "./export";

const root = await mkdtemp(join(tmpdir(), "bunzai-export-binary-"));
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

// An imported PNG card, as the library holds one: its art only in the source carrier.
const CARD = sillytavern.toCanonical({
  bytes: new Uint8Array(readFileSync("samples/sillytavern/characters/synthetic-character.png")),
  filename: "synthetic-character.png",
}) as unknown as KitEntity;

const bridge: KitBridge = {
  studioDir: root,
  async deckCounts() { return []; },
  async list() { return []; },
  async read(kind: string, id: string) { return kind === "character" && id === CARD.id ? CARD : null; },
  async save() { throw new Error("export must not touch canonical storage"); },
  async delete() { throw new Error("export must not delete"); },
};

test("a character exports to JanitorAI as a PNG card in its own Export folder", async () => {
  const result = await exportPiece.execute(
    { kind: "character", id: CARD.id, to: "janitor" },
    { bridge, exports: new StudioExports(root) },
  );
  expect(result.outcome).toBe("applied");
  const receipt = JSON.parse(result.output) as { wrote: string; path: string; bytes: number };
  expect(receipt.wrote).toMatch(/^Export\/[^/]+ Kit [^/]+\/[^/]+\.png$/);
  const png = new Uint8Array(await readFile(receipt.path));
  expect(png.byteLength).toBe(receipt.bytes);
  const chunks = textChunks(png);
  expect(Object.keys(chunks)).toEqual(["chara"]);
  expect(chunks.chara!.spec).toBe("chara_card_v2");
});
