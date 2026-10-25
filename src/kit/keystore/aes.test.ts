/**
 * The shared AES-256-GCM envelope: both APIs (base64-string and buffer-native) round-trip, agree
 * byte-for-byte with each other, and fail the same way on a wrong key, tampered ciphertext, or
 * mismatched AAD. Added with Phase 1e: the buffer-native path is what
 * `stage/crypto/crypto.ts`'s `sealCell`/`openCell` now use to skip base64 round trips on cell bodies.
 */
import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { aesOpen, aesOpenBuf, aesSeal, aesSealBuf, b64, unb64 } from "./aes";

const key = () => randomBytes(32);

describe("aesSealBuf/aesOpenBuf", () => {
  test("round-trips buffers, including empty and binary content", () => {
    const k = key();
    for (const plaintext of [Buffer.alloc(0), Buffer.from("hello"), randomBytes(1024), Buffer.from("雨の夜 \u{1F319}", "utf8")]) {
      const sealed = aesSealBuf(k, plaintext, Buffer.from("t.c", "utf8"));
      expect(aesOpenBuf(k, sealed, Buffer.from("t.c", "utf8"))).toEqual(plaintext);
    }
  });

  test("works with no AAD, and a present AAD is required to reopen", () => {
    const k = key();
    const withAad = aesSealBuf(k, Buffer.from("secret"), Buffer.from("aad"));
    expect(() => aesOpenBuf(k, withAad)).toThrow();
    expect(() => aesOpenBuf(k, withAad, Buffer.from("other"))).toThrow();

    const withoutAad = aesSealBuf(k, Buffer.from("secret"));
    expect(aesOpenBuf(k, withoutAad).toString()).toBe("secret");
  });

  test("a wrong key or a tampered byte throws, never returns garbage", () => {
    const k = key();
    const sealed = aesSealBuf(k, Buffer.from("secret"), Buffer.from("aad"));
    expect(() => aesOpenBuf(key(), sealed, Buffer.from("aad"))).toThrow();
    const tampered = { ...sealed, ct: Buffer.from(sealed.ct) };
    tampered.ct[tampered.ct.length - 1] = tampered.ct[tampered.ct.length - 1]! ^ 1;
    expect(() => aesOpenBuf(k, tampered, Buffer.from("aad"))).toThrow();
  });

  test("rejects a key that is not 32 bytes, on both seal and open", () => {
    const short = randomBytes(16);
    expect(() => aesSealBuf(short, Buffer.from("x"))).toThrow();
    const sealed = aesSealBuf(key(), Buffer.from("x"));
    expect(() => aesOpenBuf(short, sealed)).toThrow();
  });

  test("the same plaintext never seals to the same bytes twice (fresh random IV)", () => {
    const k = key();
    const a = aesSealBuf(k, Buffer.from("same text"));
    const b = aesSealBuf(k, Buffer.from("same text"));
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ct.equals(b.ct)).toBe(false);
  });
});

describe("the buffer API and the base64 API agree", () => {
  test("aesSealBuf's output is aesSeal's output, just not base64-encoded", () => {
    const k = key();
    const buf = aesSealBuf(k, Buffer.from("Night market", "utf8"), Buffer.from("chats.title", "utf8"));
    expect(b64(buf.iv)).toBeTypeOf("string");
    // A part sealed as buffers opens fine through the string API once base64-encoded, and vice versa.
    const asStrings = { iv: b64(buf.iv), tag: b64(buf.tag), ct: b64(buf.ct) };
    expect(aesOpen(k, asStrings, "chats.title")).toBe("Night market");
  });

  test("a string-API seal opens through the buffer API once base64-decoded", () => {
    const k = key();
    const sealed = aesSeal(k, "Night market", "chats.title");
    const asBuffers = { iv: unb64(sealed.iv), tag: unb64(sealed.tag), ct: unb64(sealed.ct) };
    expect(aesOpenBuf(k, asBuffers, Buffer.from("chats.title", "utf8")).toString("utf8")).toBe("Night market");
  });
});

describe("aesSeal/aesOpen (unchanged string API)", () => {
  test("round-trips text and rejects a wrong key or a foreign AAD", () => {
    const k = key();
    const sealed = aesSeal(k, "correct horse battery staple", "keyring.password");
    expect(aesOpen(k, sealed, "keyring.password")).toBe("correct horse battery staple");
    expect(() => aesOpen(key(), sealed, "keyring.password")).toThrow();
    expect(() => aesOpen(k, sealed, "keyring.other")).toThrow();
  });
});
