/** Logit Bias entries to token ids: exact only where the model's tokenizer is one Bunzai carries, never a guess. */
import { describe, expect, test } from "bun:test";
import { encode as o200k } from "gpt-tokenizer/encoding/o200k_base";
import { encode as cl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { biasFrom, entryTokens, exactTokenizer } from "./bias";

describe("exactTokenizer", () => {
  test("OpenAI families have one, everything else does not", () => {
    expect(exactTokenizer("gpt-4o")).toBe("o200k_base");
    expect(exactTokenizer("openai/gpt-5")).toBe("o200k_base");
    expect(exactTokenizer("gpt-4-turbo")).toBe("cl100k_base");
    expect(exactTokenizer("gpt-3.5-turbo")).toBe("cl100k_base");
    for (const m of ["claude-opus-4-8", "gemini-2.5-pro", "deepseek-chat", "llama3.1", "mistral-large-latest", "unknown-model"]) expect(exactTokenizer(m)).toBeNull();
  });
});

describe("entryTokens", () => {
  test("normal text is tokenized with a leading space, verbatim text without, per the model's own tokenizer", () => {
    expect(entryTokens("hello", "o200k_base")).toEqual(o200k(" hello"));
    expect(entryTokens("{hello}", "o200k_base")).toEqual(o200k("hello"));
    expect(entryTokens("hello", "cl100k_base")).toEqual(cl100k(" hello"));
    expect(entryTokens("hello world", "o200k_base")).not.toEqual(entryTokens("hello world", "cl100k_base"));
  });
  test("raw ids need no tokenizer", () => {
    expect(entryTokens("[1234, 5678]", null)).toEqual([1234, 5678]);
  });
  test("text with no exact tokenizer is refused, and bad raw ids are invalid", () => {
    expect(entryTokens("hello", null)).toBe("no-tokenizer");
    expect(entryTokens("[1, \"a\"]", "o200k_base")).toBe("invalid");
    expect(entryTokens("[1", "o200k_base")).toEqual(o200k(" [1"));
  });
});

describe("biasFrom", () => {
  test("maps each token of each entry to its bias, later entries winning", () => {
    const ids = o200k(" cat");
    const r = biasFrom([{ id: "a", text: "cat", value: -50 }, { id: "b", text: "[7]", value: 25 }], "gpt-4o");
    expect(r).toEqual({ bias: { ...Object.fromEntries(ids.map((t) => [String(t), -50])), "7": 25 } });
  });
  test("a text entry for a model with no exact tokenizer refuses the whole bias; ids alone are fine", () => {
    expect(biasFrom([{ id: "a", text: "cat", value: -50 }], "claude-opus-4-8")).toEqual({ problem: "no-tokenizer" });
    expect(biasFrom([{ id: "b", text: "[7]", value: 25 }], "claude-opus-4-8")).toEqual({ bias: { "7": 25 } });
  });
  test("blank entries are skipped and biases are clamped to 100", () => {
    expect(biasFrom([{ id: "a", text: " ", value: 5 }, { id: "b", text: "[1]", value: 900 }], "gpt-4o")).toEqual({ bias: { "1": 100 } });
    expect(biasFrom([], "gpt-4o")).toEqual({ problem: "empty" });
  });
});
