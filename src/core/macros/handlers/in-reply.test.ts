/**
 * In-reply ask macro tests: ported from RoleCall's phase2-macros.test.ts, the "pick_in_reply" describe block only (the file's other
 * blocks - templates, include, block/override - belong to other handler families).
 *
 * Skipped, and why: "full loop: ask renders -> reply captured -> variable committed" needs
 * `runMacroHooks` from RoleCall's hooks.ts, which defers to a later
 * step (this file only takes IN_REPLY_ASKS_KEY and InReplyAsk from it). Not ported.
 */
import { describe, expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "..";
import type { MacroContext, MacroVariable } from "../types";
import { IN_REPLY_ASKS_KEY, type InReplyAsk } from "./in-reply";

function makeVar(value: MacroVariable["value"]): MacroVariable {
  return { value, createdAt: 0, updatedAt: 0 };
}

function ctx(overrides: Partial<MacroContext> = {}): MacroContext {
  return createDefaultContext({
    characterName: "TestChar",
    characterId: "char-1",
    userName: "TestUser",
    messages: [{ role: "user", content: "hi" }],
    messageCount: 1,
    ...overrides,
  });
}

describe("pick_in_reply", () => {
  test("renders an instruction and registers the ask", () => {
    const context = ctx();
    const result = processMacros("{{pick_in_reply::Pick the next Director.::HEARTTHROB::SCORIA::into=session:callsign}}", context);
    expect(result.text).toContain("[SET CALLSIGN:");
    expect(result.text).toContain("HEARTTHROB, SCORIA");
    expect(result.text).toContain("Pick the next Director.");

    const registry = context.localVariables.get(IN_REPLY_ASKS_KEY)?.value as unknown as Record<string, InReplyAsk>;
    expect(registry.CALLSIGN).toMatchObject({ into: "callsign", mode: "pick", options: ["HEARTTHROB", "SCORIA"] });
  });

  test("errors without into= or options", () => {
    expect(processMacros("{{pick_in_reply::Question::A::B}}", ctx()).errors).toHaveLength(1);
    expect(processMacros("{{pick_in_reply::Question::into=session:x}}", ctx()).errors).toHaveLength(1);
  });

  test("respects custom tag= and global into", () => {
    const context = ctx();
    processMacros("{{ask_in_reply::Theme?::into=global:theme::tag=THEME_PICK}}", context);
    const registry = context.localVariables.get(IN_REPLY_ASKS_KEY)?.value as unknown as Record<string, InReplyAsk>;
    expect(registry.THEME_PICK).toMatchObject({ into: "global:theme", mode: "ask" });
  });

  test("pick_in_reply_or_keep renders nothing when the variable is set", () => {
    const context = ctx({ localVariables: new Map([["callsign", makeVar("VICE")]]) });
    const result = processMacros("{{pick_in_reply_or_keep::Pick.::A::B::into=session:callsign}}", context);
    expect(result.text).toBe("");
    expect(context.localVariables.has(IN_REPLY_ASKS_KEY)).toBe(false);
  });

  test("registers nothing in readOnly mode", () => {
    const context = ctx({ readOnly: true });
    const result = processMacros("{{pick_in_reply::Pick.::A::B::into=session:x}}", context);
    expect(result.text).toBe("");
    expect(context.localVariables.has(IN_REPLY_ASKS_KEY)).toBe(false);
  });

  test("multiple asks accumulate in the registry", () => {
    const context = ctx();
    processMacros("{{pick_in_reply::Director?::A::B::into=session:callsign}}", context);
    processMacros("{{ask_in_reply::Mood?::into=session:mood}}", context);
    const registry = context.localVariables.get(IN_REPLY_ASKS_KEY)?.value as unknown as Record<string, InReplyAsk>;
    expect(Object.keys(registry).sort()).toEqual(["CALLSIGN", "MOOD"]);
  });
});
