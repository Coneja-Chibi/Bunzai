/** A piece written with its pictures streamed in is the same file as the whole-piece write, byte for byte. */
import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bytesToBase64 } from "../core/base64";
import { CANONICAL_SCHEMA_VERSION } from "../core/canonical";
import { createContentStore } from "../stage/store/content-store";
import { memoryDocumentBackend } from "../stage/store/memory/document-backend";
import { writeHeldPiece } from "./folder-export-held";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const picture = (seed: number, n: number): Uint8Array => new Uint8Array(n).map((_, i) => (i * 29 + seed) % 256);
const uri = (bytes: Uint8Array, mime = "image/jpeg"): string => `data:${mime};base64,${bytesToBase64(bytes)}`;

test("a pack with big pictures, a small inline one and escrow art writes the same bytes as a whole write", async () => {
  const content = createContentStore(memoryDocumentBackend());
  const big = picture(1, 40_001); // spans many base64 slices of 999 bytes
  const mid = picture(2, 20_000);
  const tiny = picture(3, 90);
  await content.save({
    schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "pack", id: "p",
    body: { name: "P", pack: { items: [
      { id: "1", label: "big", ref: uri(big) }, { id: "2", label: "mid", ref: uri(mid, "image/png") }, { id: "3", label: "tiny", ref: uri(tiny) }, { id: "4", label: "again", ref: uri(big) },
    ] } },
  });
  const whole = await content.read("pack", "p");
  const held = await content.readHeld("pack", "p");
  expect(whole && held).toBeTruthy();
  const dir = mkdtempSync(join(tmpdir(), "bunraku-held-"));
  dirs.push(dir);
  const path = join(dir, "p.json");
  await writeHeldPiece(path, held!.entity, (sha, max) => content.readAsset(sha, max), 'pack "p"', 999);
  expect(readFileSync(path, "utf8")).toBe(`${JSON.stringify(whole!.entity, null, 2)}\n`);
});

test("a picture that is gone is reported as unreadable, not written short", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bunraku-held-"));
  dirs.push(dir);
  const entity = { body: { pack: { items: [{ ref: `\u0000b:u:image/png:${"a".repeat(64)}` }] } } };
  await expect(writeHeldPiece(join(dir, "x.json"), entity, async () => ({ status: "missing" }), 'pack "x"')).rejects.toMatchObject({ reason: "part-unreadable" });
});
