/**
 * Author regex ({{regex}}, compare's `matches`) runs only for a caller that sets `allowRegex`. A
 * backtracking pattern hangs a browser's regex engine, and chat display renders every message in the
 * page, so there it must be refused, not merely slow (ADR-012 keeps regex under ADR-009 isolation).
 */
import { describe, expect, test } from "bun:test";
import { chatDisplay } from "../../chat-display";
import { createDefaultContext, processMacros } from "../process";
import { REGEX_OFF } from "../types";

const BACKTRACKS = `{{regex::${"a".repeat(40)}!::^(a+)+$::x}}`;

describe("author regex is opt-in", () => {
  test("off by default: the tag stays as written and records why", () => {
    for (const text of ["{{regex::abc::b::X}}", "{{compare::abc::matches::b}}"]) {
      const r = processMacros(text, createDefaultContext());
      expect(r.text).toBe(text);
      expect(r.errors[0]?.message).toBe(REGEX_OFF);
    }
  });

  test("on when the caller opts in, with RoleCall's gi and i flags", () => {
    const ctx = createDefaultContext({ allowRegex: true });
    expect(processMacros("{{regex::aBcb::b::X}}", ctx).text).toBe("aXcX");
    expect(processMacros("{{compare::ABC::matches::b}}", ctx).text).toBe("true");
  });

  test("chat display never runs a pattern, so a backtracking one cannot hang the page", () => {
    const show = chatDisplay({ character: { kind: "character", id: "c", body: {} }, messages: [], randomSeed: 1, now: 0 });
    expect(show(BACKTRACKS)).toBe(BACKTRACKS);
  });
});
