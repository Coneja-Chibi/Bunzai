/** Each scene-capable provider's declared generation parameters: every registry parameter is sent under the named wire field or dropped. */
import { describe, expect, test } from "bun:test";
import { PARAMS, type ParamDef } from "../../../stage/params";
import { wireParams, type ParamSupport } from "../../../stage/params/wire";
import { spokes } from "../registry";

/** parameter id to the one wire field it goes under; anything absent is not sent. */
const OPENAI = { frequency_penalty: "frequency_penalty", presence_penalty: "presence_penalty", seed: "seed", n: "n", logprobs: "logprobs", top_logprobs: "top_logprobs", response_format: "response_format", stop: "stop", logit_bias: "logit_bias" };
const OPEN: Record<string, string> = { ...Object.fromEntries(PARAMS.filter((p) => p.id !== "clear_thinking").map((p) => [p.id, p.id])), top_k: "top_k" };
const EXPECTED: Record<string, Record<string, string>> = {
  openai: OPENAI,
  nanogpt: { frequency_penalty: "frequency_penalty", presence_penalty: "presence_penalty", seed: "seed", stop: "stop" },
  openrouter: { frequency_penalty: "frequency_penalty", presence_penalty: "presence_penalty", repetition_penalty: "repetition_penalty", min_p: "min_p", top_a: "top_a", top_k: "top_k", seed: "seed", logit_bias: "logit_bias", logprobs: "logprobs", top_logprobs: "top_logprobs", stop: "stop", response_format: "response_format" },
  deepseek: { stop: "stop", logprobs: "logprobs", top_logprobs: "top_logprobs", response_format: "response_format" },
  groq: { stop: "stop", seed: "seed", response_format: "response_format" },
  mistral: { frequency_penalty: "frequency_penalty", presence_penalty: "presence_penalty", stop: "stop", n: "n", seed: "random_seed", response_format: "response_format" },
  google: { frequency_penalty: "frequency_penalty", presence_penalty: "presence_penalty", stop: "stop", seed: "seed", response_format: "response_format" },
  anthropic: { stop: "stop_sequences", top_k: "top_k" },
  custom: OPEN,
  local: { ...OPEN, grammar_string: "grammar" },
};

/** A value every parameter accepts and none treats as a no-op. */
function sample(p: ParamDef | { id: string }): ParamValue {
  const def = p as ParamDef;
  if (def.id === "top_k") return 40;
  if (def.id === "logit_bias") return { entries: [{ id: "a", text: "[1234]", value: -50 }] };
  if (def.id === "response_format") return { type: "json_object" };
  if (def.id === "dry_sequence_breakers") return JSON.stringify(["\n"]);
  if (def.kind === "boolean") return true;
  if (def.kind === "array") return ["a", "b"];
  if (def.kind === "object") return { type: "object" };
  if (def.kind === "string") return "x";
  return def.max ?? 1;
}
type ParamValue = import("../../../stage/params").ParamValue;

describe("per-provider parameter mapping", async () => {
  const all = await spokes();
  for (const [kind, expected] of Object.entries(EXPECTED)) {
    const support: ParamSupport | undefined = all.get(kind)?.scene?.params;
    const ids = [...PARAMS.map((p) => p.id), "top_k"];
    test(`${kind} sends exactly its declared parameters under their wire names`, () => {
      expect(support).toBeDefined();
      const defs = ids.map((id) => PARAMS.find((p) => p.id === id) ?? { id });
      for (const d of defs) {
        const { fields, notSent } = wireParams(support!, { [d.id]: sample(d) });
        const want = expected[d.id];
        if (want === undefined) {
          expect(Object.keys(fields)).toEqual([]);
          expect(notSent).toEqual([{ id: d.id, why: "unsupported" }]);
        } else {
          expect(Object.keys(fields)).toEqual([want]);
          expect(notSent).toEqual([]);
        }
      }
    });
  }

  test("a parameter never goes out under an alias", () => {
    for (const p of PARAMS.filter((q) => q.group !== "core")) for (const alias of p.aliases ?? []) for (const e of Object.values(EXPECTED)) expect(Object.values(e)).not.toContain(alias);
  });
});

describe("value shaping a provider needs", async () => {
  const all = await spokes();
  const send = (kind: string, values: Record<string, ParamValue>, model = "m") => wireParams(all.get(kind)!.scene!.params!, values, {}, model).fields;
  const bias = (text: string, value = -50): ParamValue => ({ entries: [{ id: "a", text, value }] });
  test("OpenAI takes four stop strings and clamps logit bias to 100", () => {
    expect(send("openai", { stop: ["1", "2", "3", "4", "5"] })).toEqual({ stop: ["1", "2", "3", "4"] });
    expect(send("openai", { logit_bias: bias("[7]", 300) }, "gpt-4o")).toEqual({ logit_bias: { "7": 100 } });
  });
  test("DeepSeek takes sixteen stop strings", () => {
    expect(Object.values(send("deepseek", { stop: Array.from({ length: 20 }, (_, i) => String(i)) }))[0]).toHaveLength(16);
  });
  test("llama.cpp style local servers get the grammar under its own name unless a JSON schema is set", () => {
    expect(send("local", { grammar_string: "root ::= x" })).toEqual({ grammar: "root ::= x" });
    expect(send("local", { grammar_string: "root ::= x", json_schema: { type: "object" } })).toEqual({ json_schema: { type: "object" } });
  });
  test("local servers get logit bias as id and bias pairs", () => {
    expect(send("local", { logit_bias: bias("[12]", -5) })).toEqual({ logit_bias: [[12, -5]] });
  });
  test("a bias on words is sent only where the model's tokenizer is exact, and never guessed", () => {
    expect(send("openai", { logit_bias: bias("cat") }, "gpt-4o").logit_bias).toBeDefined();
    expect(send("openai", { logit_bias: bias("cat") }, "ft:custom-model")).toEqual({});
    expect(send("openrouter", { logit_bias: bias("cat") }, "anthropic/claude-opus-4-8")).toEqual({});
    expect(send("openrouter", { logit_bias: bias("cat") }, "openai/gpt-4o").logit_bias).toBeDefined();
    expect(send("local", { logit_bias: bias("cat") }, "llama3.1")).toEqual({});
  });
  test("providers that do not take logit_bias never get one", () => {
    for (const kind of ["anthropic", "deepseek", "groq", "mistral", "google", "nanogpt"]) expect(send(kind, { logit_bias: bias("[7]") }, "gpt-4o")).toEqual({});
  });
  test("local servers get DRY sequence breakers as a list", () => {
    expect(send("local", { dry_sequence_breakers: JSON.stringify(["\n", ":"]) })).toEqual({ dry_sequence_breakers: ["\n", ":"] });
  });
});
