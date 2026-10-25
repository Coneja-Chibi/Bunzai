/**
 * The transport rules, pinned to RoleCall's current behavior (message-formatter.ts applyPostProcessing,
 * inference-engine.ts neutral-sampler stripping and mapProviderFinishReason). RoleCall has no tests for
 * the post-processing modes, which once shipped as dead code; these characterize it exactly.
 */
import { describe, expect, test } from "bun:test";
import type { ProviderMessage } from "../contracts/provider";
import {
  applyRolePostProcessing,
  finalizeMessages,
  invalidRequest,
  normalizeFinishReason,
  PROMPT_PLACEHOLDER,
} from "./transport-core";

const m = (role: ProviderMessage["role"], content: string): ProviderMessage => ({ role, content });

const MIXED: ProviderMessage[] = [
  m("system", "A"),
  m("system", "B"),
  m("user", "U1"),
  m("user", "U2"),
  m("assistant", "A1"),
  m("system", "mid"),
  m("user", "U3"),
];

const shape = (messages: ProviderMessage[]) => messages.map((x) => [x.role, x.content]);

test("invalid request construction keeps the shared HTTP shape and each wire error code", () => {
  expect(invalidRequest("bad setting")).toMatchObject({
    category: "invalid_request_error",
    code: "invalid_options",
    status: 400,
  });
  expect(invalidRequest("bad argument", "invalid_parameter")).toMatchObject({
    category: "invalid_request_error",
    code: "invalid_parameter",
    status: 400,
  });
});

describe("role post-processing (SillyTavern modes, as RoleCall runs them)", () => {
  test("none returns an equal copy, not the same array", () => {
    const out = applyRolePostProcessing(MIXED, "none");
    expect(out).toEqual(MIXED);
    expect(out).not.toBe(MIXED);
  });

  test("merge joins consecutive same-role messages with a blank line", () => {
    expect(shape(applyRolePostProcessing(MIXED, "merge"))).toEqual([
      ["system", "A\n\nB"],
      ["user", "U1\n\nU2"],
      ["assistant", "A1"],
      ["system", "mid"],
      ["user", "U3"],
    ]);
  });

  test("semi also turns every system message after the first into user, then merges again", () => {
    expect(shape(applyRolePostProcessing(MIXED, "semi"))).toEqual([
      ["system", "A\n\nB"],
      ["user", "U1\n\nU2"],
      ["assistant", "A1"],
      ["user", "mid\n\nU3"],
    ]);
  });

  test("strict adds a user placeholder after a leading system message that is not followed by a user", () => {
    expect(shape(applyRolePostProcessing([m("system", "S"), m("assistant", "X")], "strict"))).toEqual([
      ["system", "S"],
      ["user", PROMPT_PLACEHOLDER],
      ["assistant", "X"],
    ]);
  });

  test("strict adds a user placeholder in front when the chat opens with neither system nor user", () => {
    expect(shape(applyRolePostProcessing([m("assistant", "X"), m("user", "Y")], "strict"))).toEqual([
      ["user", PROMPT_PLACEHOLDER],
      ["assistant", "X"],
      ["user", "Y"],
    ]);
  });

  test("strict leaves a well-formed opening alone", () => {
    expect(shape(applyRolePostProcessing(MIXED, "strict"))).toEqual(shape(applyRolePostProcessing(MIXED, "semi")));
  });

  test("single turns everything into one user message", () => {
    expect(shape(applyRolePostProcessing(MIXED, "single"))).toEqual([
      ["user", "A\n\nB\n\nU1\n\nU2\n\nA1\n\nmid\n\nU3"],
    ]);
  });

  test("an empty list becomes one placeholder user message", () => {
    expect(shape(applyRolePostProcessing([], "merge"))).toEqual([["user", PROMPT_PLACEHOLDER]]);
  });

  test("a blank message is never merged into the one before it (RoleCall quirk, kept)", () => {
    expect(shape(applyRolePostProcessing([m("user", "a"), m("user", "   ")], "merge"))).toEqual([
      ["user", "a"],
      ["user", "   "],
    ]);
  });

  test("the input is never mutated", () => {
    const input = [m("user", "a"), m("user", "b")];
    applyRolePostProcessing(input, "merge");
    expect(input).toEqual([m("user", "a"), m("user", "b")]);
  });
});

describe("finalizeMessages: post-processing runs once, and never on images", () => {
  test("applies the chosen mode", () => {
    expect(shape(finalizeMessages([m("user", "a"), m("user", "b")], "merge"))).toEqual([["user", "a\n\nb"]]);
  });

  test("skips processing when any message carries an image, because merging would drop it", () => {
    const withImage: ProviderMessage[] = [m("user", "a"), { role: "user", content: "b", images: ["img"] }];
    expect(finalizeMessages(withImage, "merge")).toEqual(withImage);
  });

  test("no mode means no change", () => {
    expect(finalizeMessages([m("user", "a"), m("user", "b")], undefined)).toHaveLength(2);
  });
});

describe("finish reasons are normalized", () => {
  test("provider spellings map onto the four shared reasons", () => {
    expect(["end_turn", "STOP", "COMPLETE"].map(normalizeFinishReason)).toEqual(["stop", "stop", "stop"]);
    expect(["max_tokens", "MAX_TOKENS"].map(normalizeFinishReason)).toEqual(["length", "length"]);
    expect(["tool_use", "TOOL_CALL"].map(normalizeFinishReason)).toEqual(["tool_calls", "tool_calls"]);
    expect(normalizeFinishReason("SAFETY")).toBe("content_filter");
  });

  test("anything else is lowercased, and absence stays absent", () => {
    expect(normalizeFinishReason("Recitation")).toBe("recitation");
    expect(normalizeFinishReason(undefined)).toBeUndefined();
  });
});
