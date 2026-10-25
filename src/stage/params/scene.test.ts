/** What a scene may store for its generation parameters: refused when wrong, never quietly dropped. */
import { describe, expect, test } from "bun:test";
import { checkPresetSamplers } from "../store/preset-rules";
import { customTextProblem, enabledValues, sceneGeneration, sceneParamsProblem } from "./scene";

describe("sceneParamsProblem", () => {
  test("accepts a switched-on parameter, with or without a value, and a switched-off one", () => {
    expect(sceneParamsProblem({ min_p: { on: true, value: 0.1 }, tfs: { on: true }, seed: { on: false, value: 5 } })).toBeNull();
  });
  test("refuses an unknown parameter, a value out of range or of the wrong kind, and stray fields", () => {
    expect(sceneParamsProblem({ nope: { on: true } })).toMatch(/unknown parameter: nope/);
    expect(sceneParamsProblem({ min_p: { on: true, value: 2 } })).toMatch(/between 0 and 1/);
    expect(sceneParamsProblem({ min_keep: { on: true, value: 1.5 } })).toMatch(/whole number/);
    expect(sceneParamsProblem({ early_stopping: { on: true, value: "yes" } })).toMatch(/true or false/);
    expect(sceneParamsProblem({ logit_bias: { on: true, value: { entries: [{ id: "a", text: "cat", value: 500 }] } } })).toMatch(/-100 to 100/);
    expect(sceneParamsProblem({ logit_bias: { on: true, value: { "1": 5 } } })).toMatch(/entries/);
    expect(sceneParamsProblem({ logit_bias: { on: true, value: { entries: [{ id: "a", text: "cat", value: -50 }] } } })).toBeNull();
    expect(sceneParamsProblem({ dry_sequence_breakers: { on: true, value: "not json" } })).toMatch(/JSON list/);
    expect(sceneParamsProblem({ min_p: { on: "yes" } })).toMatch(/true or false/);
    expect(sceneParamsProblem({ min_p: { on: true, extra: 1 } })).toMatch(/\{ on, value \}/);
    expect(sceneParamsProblem([])).toMatch(/plain object/);
  });
  test("a prototype key is an unknown parameter, not a way in", () => {
    expect(sceneParamsProblem(JSON.parse('{"__proto__": {"on": true}}'))).toMatch(/unknown parameter/);
  });
});

describe("customTextProblem and the store check", () => {
  test("names the field", () => {
    expect(customTextProblem("customBody", '{"model": "x"}')).toMatch(/^customBody: model is a protected/);
  });
  test("the scene's sampler check stores the new fields and refuses bad ones with a clear error", () => {
    const ok = { params: { min_p: { on: true, value: 0.1 } }, customBody: '{"top_k": 5}', customExclude: "top_p", customHeaders: '{"x-a": "1"}' };
    expect(checkPresetSamplers(ok)).toEqual(ok);
    expect(() => checkPresetSamplers({ customBody: "top_k: 5" })).toThrow(/not valid JSON/);
    expect(() => checkPresetSamplers({ customBody: '{"stream": true}' })).toThrow(/protected/);
    expect(() => checkPresetSamplers({ customExclude: "messages" })).toThrow(/protected/);
    expect(() => checkPresetSamplers({ params: { min_p: { on: true, value: 9 } } })).toThrow(/between 0 and 1/);
  });
});

describe("enabledValues and sceneGeneration", () => {
  test("only switched-on parameters with something to send", () => {
    expect(enabledValues({ min_p: { on: true, value: 0.1 }, tfs: { on: true }, stop: { on: true }, seed: { on: false, value: 1 } })).toEqual({ min_p: 0.1, tfs: 1 });
  });
  test("sceneGeneration picks the generation part only", () => {
    expect(sceneGeneration({ temperature: 1, customBody: "{}" } as never)).toEqual({ customBody: "{}" });
  });
});
