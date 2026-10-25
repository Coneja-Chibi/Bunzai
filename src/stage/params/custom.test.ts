/** The scene's Custom Request Parameters text: what the write boundary accepts and what it names when it refuses. */
import { describe, expect, test } from "bun:test";
import { customProblem } from "./custom";

describe("customProblem", () => {
  test("empty text is fine for every field", () => {
    for (const field of ["headers", "body", "exclude"] as const) expect(customProblem(field, "  ")).toBeNull();
  });
  test("a body is a JSON object, not YAML, an array or text", () => {
    expect(customProblem("body", '{"top_k": 40, "custom": {"a": [1]}}')).toBeNull();
    expect(customProblem("body", "top_k: 40")).toMatch(/JSON/);
    expect(customProblem("body", "[1]")).toMatch(/object/);
    expect(customProblem("body", "{")).toMatch(/JSON/);
  });
  test("a body names the protected key it tried to set", () => {
    expect(customProblem("body", '{"stream": true}')).toMatch(/stream.*protected/);
    expect(customProblem("body", '{"messages": []}')).toMatch(/messages.*protected/);
  });
  test("an exclusion list is one name per line, none protected", () => {
    expect(customProblem("exclude", "temperature\ntop_p")).toBeNull();
    expect(customProblem("exclude", "temperature\nmodel")).toMatch(/model.*protected/);
  });
  test("headers are a JSON object of plain values", () => {
    expect(customProblem("headers", '{"x-custom": "1", "x-n": 2}')).toBeNull();
    expect(customProblem("headers", '{"x": {"a": 1}}')).toMatch(/x/);
    expect(customProblem("headers", "x-custom: 1")).toMatch(/JSON/);
  });
  test("headers may not replace the request's own credentials or framing, in any letter case", () => {
    for (const k of ["Authorization", "x-api-key", "API-KEY", " Host ", "content-type", "Anthropic-Version", "x-goog-api-key", "Proxy-Authorization", "Cookie", "Content-Length"]) {
      expect(customProblem("headers", JSON.stringify({ [k]: "x" }))).toMatch(/protected request header/);
    }
    expect(customProblem("headers", '{"X-Trace": "1"}')).toBeNull();
  });
  test("too much text is refused", () => {
    expect(customProblem("body", `{"a": "${"x".repeat(70_000)}"}`)).toMatch(/too long/);
  });
});
