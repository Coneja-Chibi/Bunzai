/** SHA-256 compatibility vectors for the shared synchronous implementation. */
import { describe, expect, test } from "bun:test";
import { isSha256Hex, sha256Hex } from "./sha256";

describe("sha256Hex", () => {
  test.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["Bunzai / こんにちは", "2e8f2164427ba7ac02219bbb5c7978e6669eadd8755bc85d4efd89e2e5602004"],
  ])("hashes %j", (value, expected) => expect(sha256Hex(value)).toBe(expected));
});

describe("isSha256Hex", () => {
  const sha = sha256Hex("abc");
  test("accepts exactly 64 lowercase hex characters", () => {
    expect(isSha256Hex(sha)).toBe(true);
    expect(isSha256Hex("0".repeat(64))).toBe(true);
  });
  test("refuses uppercase, a wrong length, a prefix, a newline tail and non-strings", () => {
    expect(isSha256Hex(sha.toUpperCase())).toBe(false);
    expect(isSha256Hex(sha.slice(1))).toBe(false);
    expect(isSha256Hex(`${sha}0`)).toBe(false);
    expect(isSha256Hex(`sha256:${sha}`)).toBe(false);
    expect(isSha256Hex(`${sha}\n`)).toBe(false);
    expect(isSha256Hex(undefined)).toBe(false);
    expect(isSha256Hex(12)).toBe(false);
  });
});
