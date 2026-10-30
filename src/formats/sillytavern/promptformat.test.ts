/**
 * SillyTavern instruct and context templates as one prompt-format piece. Fixtures preserve the
 * structural settings from the ST data folder (samples/sillytavern/templates/). A single-half piece writes back the
 * file it came from; both halves write ST's master-import wrapper, and that wrapper routes back here
 * through the registry rather than to the preset codec.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadFormats, registry } from "../../core";
import adapter from "./promptformat";
import type { CanonicalPromptFormat } from "../../entities/promptformat/schema";

const DIR = join(import.meta.dir, "../../../samples/sillytavern/templates");
const text = (f: string): string => readFileSync(join(DIR, f), "utf8");
const read = (f: string): CanonicalPromptFormat => adapter.toCanonical({ text: text(f), filename: f });
const emit = (e: CanonicalPromptFormat): unknown => JSON.parse(adapter.fromCanonical(e).text!);

beforeAll(async () => {
  await loadFormats();
});

describe("detect", () => {
  test("claims an instruct file and a context file", () => {
    expect(adapter.detect({ text: text("instruct-chatml-names.json") })).toBe(0.9);
    expect(adapter.detect({ text: text("context-llama-3-instruct.json") })).toBe(0.9);
  });

  test("leaves everything else to its own codec", () => {
    for (const f of ["reasoning-deepseek.json", "kobold-deterministic.json", "sysprompt-actor.json", "textgen-chatml-with-prompt.json"]) {
      expect(adapter.detect({ text: text(f) })).toBe(0);
    }
    expect(adapter.detect({ text: JSON.stringify({ name: "x", prompts: [], input_sequence: "a", output_sequence: "b" }) })).toBe(0);
  });

  test("fails closed on a half that holds anything but scalars", () => {
    expect(adapter.detect({ text: JSON.stringify({ name: "x", input_sequence: "a", output_sequence: "b", extra: { deep: 1 } }) })).toBe(0);
  });
});

describe("a single file", () => {
  test("instruct keeps every key ST wrote, and the name is the body's", () => {
    const e = read("instruct-chatml-names.json");
    expect(e.body.name).toBe("ChatML-Names");
    expect(e.body.context).toBeUndefined();
    expect(e.body.instruct).toMatchObject({ input_sequence: "<|im_start|>{{name}}", stop_sequence: "<|im_end|>", wrap: true, names_behavior: "none" });
    expect(e.body.instruct).not.toHaveProperty("name");
    expect(Object.keys(e.body.instruct!).length).toBe(Object.keys(JSON.parse(text("instruct-chatml-names.json"))).length - 1);
  });

  test("each file writes back as itself", () => {
    for (const f of ["instruct-chatml-names.json", "context-llama-3-instruct.json"]) {
      expect(emit(read(f))).toEqual(JSON.parse(text(f)));
    }
  });
});

describe("a pair", () => {
  const pair = (): CanonicalPromptFormat => {
    const i = read("instruct-chatml-names.json");
    return { ...i, body: { ...i.body, context: read("context-llama-3-instruct.json").body.context } };
  };

  test("exports ST's master-import wrapper with both halves named", () => {
    const out = emit(pair()) as { name: string; instruct: { name: string }; context: { name: string; story_string: string } };
    expect(out.name).toBe("ChatML-Names");
    expect(out.instruct.name).toBe("ChatML-Names");
    expect(out.context.story_string).toContain("start_header_id");
  });

  test("the wrapper routes back to this codec, not the preset codec, and re-reads equal", () => {
    const text2 = adapter.fromCanonical(pair()).text!;
    expect(registry.detect({ text: text2, filename: "x.json" })?.id).toBe("sillytavern-promptformat");
    expect(adapter.toCanonical({ text: text2, filename: "x.json" }).body).toEqual(pair().body);
  });

  test("a wrapper with a system prompt stays a preset", () => {
    expect(registry.detect({ text: text("textgen-chatml-with-prompt.json"), filename: "x.json" })?.id).toBe("sillytavern-preset");
  });
});
