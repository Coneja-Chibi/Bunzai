/**
 * The Story Director's block of the request (director.ts): the directive rides as one system message at depth 1, just above the last user message, headed as RoleCall heads it; the
 * authority contract rides once at the very top; both are traced as `director`; a directive that says nothing places nothing; the budget never drops them.
 */
import { describe, expect, test } from "bun:test";
import type { CharacterBody } from "../../entities/character/schema";
import type { NarratorDirective } from "../../stage/contracts/director-types";
import { assemble } from "./assemble";
import { DIRECTOR_FOOTER, DIRECTOR_HEADER, NARRATOR_AUTHORITY, renderDirective } from "./director";
import type { AssemblyInput, HistoryMessage } from "./types";

const card = { identity: { name: "Vera", description: "Keeps the light." }, persona: {}, prompts: {}, greetings: {}, examples: {}, media: {}, attribution: {}, discovery: {} } as CharacterBody;
const msg = (id: string, role: HistoryMessage["role"], content: string): HistoryMessage => ({ id, role, content });
const input = (over: Partial<AssemblyInput> = {}): AssemblyInput => ({
  character: card, history: [msg("g", "assistant", "Evening."), msg("u1", "user", "Hi"), msg("a1", "assistant", "Hello.")], current: msg("u2", "user", "Any storms?"),
  localVariables: new Map(), globalVariables: new Map(), now: Date.UTC(2026, 9, 12), randomSeed: 1, ...over,
});
const DIRECTIVE: NarratorDirective = {
  mood: "uneasy", pacing: "slow", narrativeGoal: "Let the keeper slip once.", endingHook: "A bell, far off.",
  arcDirections: [{ arcName: "The Locked Room", instruction: "Someone avoids the corridor.", urgency: "moderate" }],
  characterBeats: [{ character: "Vera", beat: "Counts the lamps twice", motivation: "old habit" }],
  include: { themes: ["debt"] }, avoid: { revelations: ["who has the key"] }, sceneGuidance: { setting: "the lamp room", tension_level: 7 },
};

describe("placement", () => {
  test("the directive is one system message immediately above the last user message, and the contract is the first message of the request", () => {
    const messages = assemble(input({ director: DIRECTIVE })).messages;
    const last = messages.length - 1;
    expect(messages[last]).toEqual({ role: "user", content: "Any storms?" });
    expect(messages[last - 1]!.role).toBe("system");
    expect(messages[last - 1]!.content.startsWith(DIRECTOR_HEADER)).toBe(true);
    expect(messages[last - 1]!.content.endsWith(DIRECTOR_FOOTER)).toBe(true);
    expect(messages[0]).toEqual({ role: "system", content: NARRATOR_AUTHORITY });
    expect(messages.filter((m) => m.content === NARRATOR_AUTHORITY)).toHaveLength(1);
    expect(messages.filter((m) => m.content.startsWith(DIRECTOR_HEADER))).toHaveLength(1);
  });

  test("the request is otherwise exactly what it was without a directive", () => {
    const plain = assemble(input()).messages;
    const withIt = assemble(input({ director: DIRECTIVE })).messages;
    expect(withIt.filter((m) => m.content !== NARRATOR_AUTHORITY && !m.content.startsWith(DIRECTOR_HEADER))).toEqual(plain);
  });

  test("both blocks are traced as director, system, with tokens", () => {
    const traced = assemble(input({ director: DIRECTIVE })).trace.filter((t) => t.source.kind === "director");
    expect(traced).toHaveLength(2);
    expect(traced.every((t) => t.role === "system" && t.tokens > 0)).toBe(true);
  });

  test("no directive, or one that renders to nothing, places nothing - not even the contract", () => {
    expect(assemble(input()).messages.some((m) => m.content === NARRATOR_AUTHORITY)).toBe(false);
    const empty = { mood: "", pacing: "medium" } as NarratorDirective;
    expect(renderDirective(empty)).toBe("");
    expect(assemble(input({ director: empty })).messages).toEqual(assemble(input()).messages);
  });

  test("the contract names the very header the injection uses", () => {
    expect(NARRATOR_AUTHORITY).toContain(`A block labeled ${DIRECTOR_HEADER}`);
  });
});

describe("what the narrator reads", () => {
  test("the binding preamble, then the sections in RoleCall's order, then the ending hook", () => {
    const text = renderDirective(DIRECTIVE);
    const order = ["Mood: uneasy", "Pacing: Take your time.", "Scene Guidance:", "Tension: high (7/10)", "Include in this response:", "Avoid in this response:", "Narrative Goal:", "Story Arc Directions:", "Character Beats:", "[Ending: A bell, far off.]"];
    const at = order.map((s) => text.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain("Do NOT second-guess");
    expect(text).toContain('  - "The Locked Room" (moderate): Someone avoids the corridor.');
    expect(text).toContain("  - Vera: Counts the lamps twice (old habit)");
  });

  test("a medium pace says nothing about pace", () => {
    expect(renderDirective({ ...DIRECTIVE, pacing: "medium" })).not.toContain("Pacing:");
  });
});
