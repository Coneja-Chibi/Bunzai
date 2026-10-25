/**
 * On-disk compatibility proof for Phase 1e. The cell format itself must not change.
 *
 * Direction 1: cells sealed by the pre-Phase-1e code open byte-identically under the new code. The
 * fixtures below were produced once by `sealCell` copied verbatim from `git show HEAD:src/stage/
 * crypto/crypto.ts` (the commit before this change), run against a copy of `git show HEAD:src/kit/
 * keystore/aes.ts`, entirely inside the scratch folder. The shared tree was never reverted to the
 * old code to make them.
 *
 * Direction 2: cells sealed by the new code open under a decrypt written directly against
 * node:crypto, independent of both the old and new code paths. That proves the wire format is
 * exactly what it always was: `e1:` + base64(12-byte IV, 16-byte GCM tag, ciphertext), AES-256-GCM,
 * AAD = the table.column string, and nothing else.
 */
import { describe, expect, test } from "bun:test";
import { createDecipheriv } from "node:crypto";
import { newDataKey, openCell, sealCell } from "./crypto";

const OLD_KEY = Buffer.from("2inSpnjoPFnu6g7PtcXla18+6DsnVYOTl7A2ni6Bw1g=", "base64");

const OLD_FIXTURES: { where: string; text: string; cell: string }[] = [
  { where: "swipes.content", text: "", cell: "e1:P/3gVf7llw9onP9uWGtb9dZVXxCrEdWvajzTjg==" },
  {
    where: "chats.title",
    text: "Night market",
    cell: "e1:fG8y04Kpna9EM4z/4z07jngF8gQvVr/NGWFppS1Be4VQs+oKfPVBqg==",
  },
  {
    where: "swipes.content",
    text: "Vera smiles. 雨の夜 \u{1F319}",
    cell: "e1:CIiHbnwDt+Y3U8E7ht0hc9ML6Hv43NGDBtwKpl+74GMzs3ZsAEvgarVy9jFKPGkL6Gw7H1eJpw==",
  },
];

describe("Phase 1e on-disk compatibility", () => {
  test("cells sealed by the pre-Phase-1e code open byte-identically under the buffer-native code", () => {
    for (const { where, text, cell } of OLD_FIXTURES) {
      expect(openCell(OLD_KEY, where, cell)).toBe(text);
    }
  });

  test("cells sealed by the new code decrypt under a plain AES-256-GCM implementation with the documented layout", () => {
    const key = newDataKey();
    const where = "documents.body_json";
    const text = "The lantern maker's daughter, x".repeat(200); // a few KB, past any single-block edge case
    const cell = sealCell(key, where, text);

    expect(cell.startsWith("e1:")).toBe(true);
    const raw = Buffer.from(cell.slice(3), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(where, "utf8"));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
    expect(plain).toBe(text);

    // The AAD really is `where`: the same tag/ct under a different AAD must fail.
    const wrongAad = createDecipheriv("aes-256-gcm", key, iv);
    wrongAad.setAAD(Buffer.from("chats.title", "utf8"));
    wrongAad.setAuthTag(tag);
    expect(() => Buffer.concat([wrongAad.update(ct), wrongAad.final()])).toThrow();
  });

  test("new code can still open what it just sealed (both APIs share one cipher path)", () => {
    const key = newDataKey();
    for (const text of ["", "short", "x".repeat(20_000)]) {
      expect(openCell(key, "swipes.content", sealCell(key, "swipes.content", text))).toBe(text);
    }
  });
});
