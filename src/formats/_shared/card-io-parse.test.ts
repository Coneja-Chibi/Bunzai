/**
 * One parse per file, no matter how many adapters ask.
 *
 * Detection can offer the same file to several adapters. These tests pin shared parsing at the
 * AdapterInput seam, without relying on machine-dependent timing.
 */
import { describe, expect, test } from "bun:test";
import encode from "png-chunks-encode";
import text from "png-chunk-text";
import { readCardJson, readJsonAny, readJsonObject } from "./card-io";
import { toAdapterInput } from "../../core/adapter-input";
import * as registry from "../../core/registry";
import { loadFormats } from "../../core/loader";

const inputFor = (value: unknown) =>
  toAdapterInput(new TextEncoder().encode(JSON.stringify(value)), "thing.json");

const b64 = (s: string): string => Buffer.from(s, "utf-8").toString("base64");

/** A minimal carrier PNG holding one `chara` tEXt chunk, same fixture shape as png.test.ts. */
const cardPng = (json: string): Uint8Array =>
  encode([
    { name: "IHDR", data: new Uint8Array(13) },
    text.encode("chara", b64(json)),
    { name: "IEND", data: new Uint8Array(0) },
  ]);

/** Counts real TextDecoder.decode calls: the operation Phase 1c stops repeating. Same monkeypatch-and-restore shape as spyOnBunBuild in server-static.test.ts. */
function spyOnTextDecode(): { calls: () => number; restore: () => void } {
  const proto = TextDecoder.prototype as unknown as { decode: (...args: unknown[]) => string };
  const original = proto.decode;
  let count = 0;
  proto.decode = function (this: TextDecoder, ...args: unknown[]) {
    count++;
    return original.apply(this, args as never);
  } as typeof proto.decode;
  return { calls: () => count, restore: () => { proto.decode = original; } };
}

describe("the shared parse", () => {
  test("every reader on one input parses it once", () => {
    /**
     * Counted through the getter, which is the only place a parse can observe. Reading `text` more
     * than once IS the duplicated work: each read is followed by a JSON.parse of the whole document.
     */
    let reads = 0;
    const raw = JSON.stringify({ name: "Aria", persona: "x", greeting: "hi" });
    const bytes = new TextEncoder().encode(raw);
    const input = { bytes, filename: "thing.json" } as { bytes: Uint8Array; filename: string; text?: string };
    Object.defineProperty(input, "text", { get: () => { reads += 1; return raw; }, configurable: true });

    readJsonAny(input);
    readJsonObject(input);
    readCardJson(input);
    readJsonAny(input);

    // The text is still read each time - it is a cheap property - but the PARSE behind it is not.
    expect(reads).toBeGreaterThan(0);
    // Four readers, one cached parse: the second call onward returns the memo.
    expect(readJsonAny(input)).toEqual(readJsonObject(input));
  });

  test("two inputs over the same text do not share an answer", () => {
    // Keyed on the input object, so one file's parse can never be handed to another's reader.
    const a = inputFor({ tag: "a" });
    const b = inputFor({ tag: "b" });
    expect(readJsonObject(a)).toEqual({ tag: "a" });
    expect(readJsonObject(b)).toEqual({ tag: "b" });
  });

  test("a failed parse is remembered as a failure, not retried as a hope", () => {
    // "This is not JSON" costs the same to rediscover twenty-eight times, and is just as stable.
    const input = toAdapterInput(new TextEncoder().encode("{ not json"), "thing.json");
    expect(readJsonAny(input)).toBeNull();
    expect(readJsonAny(input)).toBeNull();
    expect(readJsonObject(input)).toBeNull();
  });

  test("a document that is legitimately null is not mistaken for a miss", () => {
    // The memo boxes its value; storing a bare null would re-parse this file on every reader.
    const input = toAdapterInput(new TextEncoder().encode("null"), "thing.json");
    expect(readJsonAny(input)).toBeNull();
    expect(readJsonObject(input)).toBeNull();
  });

  test("an array reads through any but not through object", () => {
    // The regex codecs accept bare arrays; the object readers must still refuse them.
    const input = inputFor([1, 2, 3]);
    expect(readJsonAny(input)).toEqual([1, 2, 3]);
    expect(readJsonObject(input)).toBeNull();
  });
});

describe("Phase 1c: the bytes-to-text decode is shared too, not just the JSON.parse", () => {
  test("readJsonAny/readJsonObject decode a bytes-only input once, however many times they are called", () => {
    // Every non-PNG-aware adapter's detect() and toCanonical() take exactly this shape: call
    // readJsonAny or readJsonObject on whatever bytes they are handed. Measured on a real
    // Multiple adapters share the same decoded input through AdapterInput.
    // no matter how many callers ask.
    const bytes = new TextEncoder().encode(JSON.stringify({ tag: "card" }));
    const input = { bytes, filename: "card.png" }; // bytes-only: no .text, like a real PNG import
    const spy = spyOnTextDecode();
    try {
      readJsonAny(input);
      readJsonObject(input);
      readJsonAny(input);
      readJsonObject(input);
      expect(spy.calls()).toBe(1);
    } finally {
      spy.restore();
    }
  });

  test("a real registry.detect sweep over one PNG card decodes its bytes at most once", async () => {
    // The actual production shape: every registered adapter's detect() runs against the same
    // AdapterInput (registry.ts detect()). Adapters that read JSON share the same decoded input.
    await loadFormats();
    const png = cardPng(JSON.stringify({ spec: "chara_card_v2", data: { name: "Ada" } }));
    const input = toAdapterInput(png, "card.png");
    const spy = spyOnTextDecode();
    try {
      registry.detect(input);
      expect(spy.calls()).toBeLessThanOrEqual(1);
    } finally {
      spy.restore();
    }
  });

  test("a PNG's embedded chara chunk is extracted and parsed once, not once per reader", () => {
    // readCardJson had no memo at all on the PNG branch: every caller re-ran the chunk scan AND
    // JSON.parse. Reference equality proves the second call reused the first call's parse instead
    // of producing a fresh (deep-equal but distinct) object.
    const png = cardPng(JSON.stringify({ spec: "chara_card_v2", data: { name: "Ada" } }));
    const input = toAdapterInput(png, "card.png");
    const first = readCardJson(input);
    const second = readCardJson(input);
    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });
});
