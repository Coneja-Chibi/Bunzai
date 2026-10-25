/** The one place file signatures are read: every door that sniffs ZIP or PNG agrees on length and shape. */
import { describe, expect, test } from "bun:test";
import { isPngBytes, isZipBytes, startsWith } from "./bytes";

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe("startsWith", () => {
  test("matches a prefix, optionally at an offset", () => {
    expect(startsWith(Uint8Array.of(1, 2, 3), [1, 2])).toBe(true);
    expect(startsWith(Uint8Array.of(9, 1, 2, 3), [1, 2], 1)).toBe(true);
    expect(startsWith(Uint8Array.of(1, 2, 3), [2, 3])).toBe(false);
  });
  test("input shorter than the magic never matches", () => {
    expect(startsWith(Uint8Array.of(1), [1, 2])).toBe(false);
    expect(startsWith(new Uint8Array(0), [0])).toBe(false);
  });
});

describe("isZipBytes", () => {
  test("accepts the local-header, empty-archive and spanned signatures", () => {
    expect(isZipBytes(Uint8Array.of(0x50, 0x4b, 0x03, 0x04, 0))).toBe(true);
    expect(isZipBytes(Uint8Array.of(0x50, 0x4b, 0x05, 0x06))).toBe(true);
    expect(isZipBytes(Uint8Array.of(0x50, 0x4b, 0x07, 0x08))).toBe(true);
  });
  test("two bytes of PK, or PK followed by text, is not a zip", () => {
    expect(isZipBytes(Uint8Array.of(0x50, 0x4b))).toBe(false);
    expect(isZipBytes(Uint8Array.of(0x50, 0x4b, 0x03))).toBe(false);
    expect(isZipBytes(new TextEncoder().encode("PKI certificate notes"))).toBe(false);
    expect(isZipBytes(new Uint8Array(0))).toBe(false);
  });
});

describe("isPngBytes", () => {
  test("needs the whole eight-byte signature", () => {
    expect(isPngBytes(Uint8Array.from([...PNG_SIG, 0, 0]))).toBe(true);
    expect(isPngBytes(Uint8Array.from(PNG_SIG))).toBe(true);
    expect(isPngBytes(Uint8Array.from(PNG_SIG.slice(0, 4)))).toBe(false);
    expect(isPngBytes(Uint8Array.from([...PNG_SIG.slice(0, 7), 0x0b]))).toBe(false);
  });
});
