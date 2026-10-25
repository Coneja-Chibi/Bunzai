/** Unrun regression fixtures for per-occurrence cold expansion admission and typed decode damage. */
import { expect, test } from "bun:test";
import { decodeBlobs, SENTINEL_PREFIX } from "../../entities/piece-parts-blob";
import { decompose } from "../../entities/piece-parts";
import { PRESET_SCALE_N, preset } from "../../../scripts/scale/fixtures/preset";
import { COLD_READ_LIMIT, coldReadCharge } from "./cold-read-budget";
import { coldFillParts, ColdReadDamageError } from "./content-store-write";

const sealedBytes = (plainBytes: number): number => 3 + 4 * Math.ceil((plainBytes + 12 + 16) / 3);

test("each repeated sentinel must obtain admission before expansion", () => {
  const key = "a".repeat(64);
  const blobs = new Map([[key, { key, payload: { kind: "bytes" as const, bytes: new Uint8Array(32) } }]]);
  let charged = 0;
  let attempts = 0;
  expect(() => decodeBlobs([`${SENTINEL_PREFIX}b:${key}`, `${SENTINEL_PREFIX}b:${key}`], blobs, (bytes) => {
    attempts++;
    if (charged + bytes > 150) throw new Error("budget refused");
    charged += bytes;
  })).toThrow("budget refused");
  expect(attempts).toBe(2);
  expect(charged).toBe(120);
});

test("a missing cold blob retains unreadable-json damage", async () => {
  const failure = await coldFillParts([{ name: "h", text: JSON.stringify(`${SENTINEL_PREFIX}t:${"a".repeat(64)}`), blobs: [] }])
    .then(() => null, (error: unknown) => error);
  expect(failure).toBeInstanceOf(ColdReadDamageError);
  expect((failure as ColdReadDamageError).reason).toBe("unreadable-json");
});

test("invalid UTF-8 in a text blob retains unreadable-json damage", async () => {
  const key = "a".repeat(64);
  const failure = await coldFillParts([{ name: "h", text: JSON.stringify(`${SENTINEL_PREFIX}t:${key}`), blobs: [{ key, payload: { kind: "bytes", bytes: new Uint8Array([255]) } }] }])
    .then(() => null, (error: unknown) => error);
  expect(failure).toBeInstanceOf(ColdReadDamageError);
  expect((failure as ColdReadDamageError).reason).toBe("unreadable-json");
});

test("the unchanged 3,000-block preset fits snapshot plus bounded cold-fill accounting", async () => {
  const entity = preset(PRESET_SCALE_N);
  const records = decompose(entity);
  const parts = records.map(({ name, json, blobs }) => ({ name, text: json, blobs }));
  const docKey = "a".repeat(64);
  const partCellBytes = parts.reduce((sum, part) => {
    const nameBytes = Buffer.byteLength(part.name, "utf8");
    return sum + sealedBytes(Buffer.byteLength(`${docKey}${nameBytes}:${part.name}${part.text}`, "utf8"));
  }, 0);
  const refs = parts.reduce((sum, part) => sum + part.blobs.length, 0);
  const blobRefBytes = parts.reduce((sum, part) => sum + part.blobs.reduce((subtotal, blob) => {
    const encoded = blob.payload.kind === "bytes" ? `b${Buffer.from(blob.payload.bytes).toString("base64")}` : `t${blob.payload.text}`;
    return subtotal + sealedBytes(Buffer.byteLength(encoded, "utf8"));
  }, 0), 0);
  const snapshotCharge = coldReadCharge(partCellBytes + blobRefBytes, parts.length, refs);
  const resultBudget = COLD_READ_LIMIT - snapshotCharge;
  expect(snapshotCharge).toBeLessThan(COLD_READ_LIMIT);
  const filled = await coldFillParts(parts, { charge: resultBudget, parts: 20_000, refs: 100_000 }, { kind: entity.kind, id: entity.id });
  expect(filled).not.toBeNull();
  expect(snapshotCharge + filled!.usedCharge).toBeLessThanOrEqual(COLD_READ_LIMIT);
});

test("oversized scalar snapshots and token-heavy JSON refuse before canonical decode", async () => {
  expect(coldReadCharge(COLD_READ_LIMIT + 1, 1, 0)).toBeGreaterThan(COLD_READ_LIMIT);
  const text = `[${Array.from({ length: 1_000_001 }, () => "0").join(",")}]`;
  const failure = await coldFillParts([{ name: "h", text, blobs: [] }], { charge: COLD_READ_LIMIT, parts: 20_000, refs: 100_000 })
    .then(() => null, (error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toContain("bounded cold-read memory limit");
});

test("repeated large sentinels are charged per occurrence before decoded expansion", async () => {
  const key = "b".repeat(64);
  const count = 80;
  const text = JSON.stringify(Array.from({ length: count }, () => `${SENTINEL_PREFIX}b:${key}`));
  const blob = { key, payload: { kind: "bytes" as const, bytes: new Uint8Array(1_000_000) } };
  const failure = await coldFillParts([{ name: "h", text, blobs: [blob] }], { charge: COLD_READ_LIMIT, parts: 20_000, refs: 100_000 })
    .then(() => null, (error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  expect((failure as Error).message).toContain("bounded cold-read memory limit");
});
