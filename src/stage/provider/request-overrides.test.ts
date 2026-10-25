/** Shared provider custom override parsing contract. */
import { expect, test } from "bun:test";
import { ProviderError, type ProviderOptions } from "../contracts/provider";
import { applyRequestBody, applyRequestHeaders, parseRequestOverrides } from "./request-overrides";

test("per-request body and exclusions replace saved ones, headers merge with the connection winning, and blank exclusions disappear", () => {
  const options = { custom_include_headers: '{"X-Chat": "yes"}', custom_exclude_body: "a\n \nb" } as ProviderOptions;
  expect(parseRequestOverrides(options, { customHeaders: '{"X-Saved": "no"}', customExcludeBody: "saved" })).toEqual({
    headers: { "X-Chat": "yes", "X-Saved": "no" },
    body: undefined,
    excluded: ["a", "b"],
  });
});

test("rejects malformed override maps with the provider option error contract", () => {
  expect(() => parseRequestOverrides({ custom_include_body: "[1]" } as ProviderOptions, {})).toThrow(ProviderError);
});

test("applies custom headers and body exclusions in the shared order", () => {
  const headers: Record<string, string> = { Authorization: "Bearer key" };
  const body: Record<string, unknown> = { model: "m", tools: ["default"], response_format: "json" };
  const overrides = parseRequestOverrides({ custom_include_headers: '{"X-Count": 4}', custom_include_body: "{\"temperature\":0.2}", custom_exclude_body: "temperature" } as ProviderOptions, {});
  applyRequestHeaders(headers, overrides.headers);
  applyRequestBody(body, overrides, true, ["tools", "tool_choice"]);
  expect(headers).toEqual({ Authorization: "Bearer key", "X-Count": "4" });
  expect(body).toEqual({ model: "m", response_format: "json" });
});

test("a custom body may not replace the request's own fields, and a custom exclusion may not remove them", () => {
  for (const key of ["model", "messages", "stream", "tools", "tool_choice"]) {
    expect(() => parseRequestOverrides({ custom_include_body: `{"${key}": 1}` } as ProviderOptions, {})).toThrow(/protected/);
    expect(() => parseRequestOverrides({ custom_exclude_body: `top_k\n${key}` } as ProviderOptions, {})).toThrow(/protected/);
  }
  expect(() => parseRequestOverrides({}, { customBody: '{"stream": true}' })).toThrow(ProviderError);
  expect(parseRequestOverrides({ custom_include_body: '{"top_k": 3}' } as ProviderOptions, {}).body).toEqual({ top_k: 3 });
});

test("scene header text may not replace credentials", () => {
  for (const key of ["Authorization", "authorization", "X-Api-Key", "api-key", "Host", "Content-Type", "anthropic-version", "x-goog-api-key"]) {
    expect(() => parseRequestOverrides({ custom_include_headers: JSON.stringify({ [key]: "stolen" }) } as ProviderOptions, {})).toThrow(/protected/);
  }
  expect(parseRequestOverrides({ custom_include_headers: '{"X-Trace": "1"}' } as ProviderOptions, {}).headers).toEqual({ "X-Trace": "1" });
});

test("YAML is no longer read: only JSON objects are accepted", () => {
  expect(() => parseRequestOverrides({ custom_include_headers: "X-Chat: yes" } as ProviderOptions, {})).toThrow(ProviderError);
});

test("a connection's own custom auth header is honoured, and scene text can never override it", () => {
  const connection = { customHeaders: '{"Authorization": "Basic own", "X-Conn": "c"}' };
  expect(parseRequestOverrides({}, connection).headers).toEqual({ Authorization: "Basic own", "X-Conn": "c" });
  // a scene header that is not a credential merges in; the connection's value wins a clash
  expect(parseRequestOverrides({ custom_include_headers: '{"X-Conn": "scene", "X-Scene": "s"}' } as ProviderOptions, connection).headers).toEqual({ "X-Scene": "s", Authorization: "Basic own", "X-Conn": "c" });
  // scene text naming a credential is refused even when the connection sets one
  for (const key of ["Authorization", "authorization", "x-api-key"]) {
    expect(() => parseRequestOverrides({ custom_include_headers: JSON.stringify({ [key]: "stolen" }) } as ProviderOptions, connection)).toThrow(/protected/);
  }
});

test("headers in a saved scene or imported preset reach the provider as scene text, so a credential there is refused", () => {
  expect(() => parseRequestOverrides({ custom_include_headers: '{"Authorization": "Bearer imported"}' } as ProviderOptions, { customHeaders: undefined })).toThrow(/protected/);
});

test("header names merge case-insensitively: a connection's header is never duplicated or combined with a scene header of another case, and every name is sent once", () => {
  const connection = { customHeaders: '{"X-My-Auth": "conn"}' };
  const merged = parseRequestOverrides({ custom_include_headers: '{"x-my-auth": "scene", "X-Other": "a", "x-other": "b"}' } as ProviderOptions, connection).headers!;
  expect(merged["X-My-Auth"]).toBe("conn");
  expect(Object.keys(merged).filter((k) => k.toLowerCase() === "x-my-auth")).toEqual(["X-My-Auth"]);
  expect(Object.keys(merged).filter((k) => k.toLowerCase() === "x-other")).toHaveLength(1);
  // applied over the host's own headers, a connection auth header of another case replaces the host's instead of sitting beside it
  const wire: Record<string, string> = { Authorization: "Bearer vault", "Content-Type": "application/json" };
  applyRequestHeaders(wire, parseRequestOverrides({}, { customHeaders: '{"authorization": "Basic own"}' }).headers);
  expect(Object.entries(wire).filter(([k]) => k.toLowerCase() === "authorization")).toEqual([["authorization", "Basic own"]]);
});
