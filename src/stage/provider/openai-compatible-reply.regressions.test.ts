/**
 * Regression: a provider-returned reasoning payload must stay a separate field, never silently
 * become the visible message content - except the one documented fallback (content empty, no tool
 * calls, some servers answer only in the reasoning field). A non-JSON error body must also always
 * become bounded text the app can show and log, never an unbounded or unparsed blob.
 */
import { expect, test } from "bun:test";
import { parseCompletion } from "./openai-compatible-reply";
import { classifyHttpFailure } from "./transport-core";

const body = (message: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  model: "served",
  choices: [{ index: 0, message, finish_reason: "stop", ...extra }],
  usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
});

test("reasoning is not duplicated into content when content is already present", () => {
  const completion = parseCompletion(
    body({ content: "The visible reply.", reasoning_content: "internal planning text" }),
    { reasoningFallback: true },
  );
  expect(completion.content).toBe("The visible reply.");
  expect(completion.reasoning).toBe("internal planning text");
});

test("reasoning never fills content on a turn that made tool calls, even with empty content", () => {
  const completion = parseCompletion(
    body({
      content: "",
      reasoning_content: "deciding which tool to call",
      tool_calls: [{ id: "1", type: "function", function: { name: "look", arguments: "{}" } }],
    }),
    { reasoningFallback: true },
  );
  expect(completion.content).toBe("");
  expect(completion.reasoning).toBe("deciding which tool to call");
});

test("the documented fallback still applies when content is empty and there are no tool calls", () => {
  const completion = parseCompletion(
    body({ content: "", reasoning_content: "the whole answer landed in reasoning" }),
    { reasoningFallback: true },
  );
  expect(completion.content).toBe("the whole answer landed in reasoning");
});

// A misbehaving proxy or load balancer can return a raw HTML error page instead of JSON; that body
// must become bounded text the app can show and log, never an unbounded or unparsed blob that
// breaks a toast or fills a log file.
test("a raw HTML error body from a misbehaving provider becomes bounded text", () => {
  const html = `<html><body><h1>502 Bad Gateway</h1><p>${"filler ".repeat(500)}</p></body></html>`;
  const error = classifyHttpFailure(502, html, "openai");
  expect(error.status).toBe(502);
  expect(error.code).toBe("backend_error");
  // clip() bounds to 500 chars of flattened text; the message never balloons to the raw body size.
  expect(error.message.length).toBeLessThan(600);
});

test("an empty or garbage non-JSON body still classifies cleanly", () => {
  const empty = classifyHttpFailure(500, "", "openai");
  expect(empty.status).toBe(500);
  const garbage = classifyHttpFailure(500, "not json at all {{{", "openai");
  expect(garbage.status).toBe(500);
  expect(garbage.message).toContain("not json at all");
});
