/**
 * The planner's prompts: RoleCall's text for the one forced command, with nothing in it that names a tool the planner does not have, the creativity and personality settings read, the
 * conversation bounded, and soft-removed items never shown.
 */
import { describe, expect, test } from "bun:test";
import { DIRECTOR_PERSONALITIES } from "../../stage/contracts/director-types";
import { arcOf, hiddenOf, seedOf, stateOf } from "./fixtures";
import { HISTORY_CHAR_BUDGET, formatDirectorHistory } from "./history";
import { computeMomentum } from "./momentum";
import { DEFAULT_PERSONALITY, PERSONALITIES, SHARED_PERSONALITY_GUIDANCE, personalityOf, personalityPrompt } from "./personalities";
import { systemPrompt } from "./prompts";
import { AUDIT_PROSE_MAX, selfAuditBlock } from "./self-audit";
import { PROMPT_LIMITS, instructionsSection, userPrompt } from "./user-prompt";

const STALE = /batch_update|set_directive|update_analysis|read_compendium_entry|update_relationship|add_arc\b|plant_seed|surface_invisible_arc|SINGLE JSON|Your Output Format|Game State Updates|dossier/;

describe("personalities", () => {
  test("there are RoleCall's ten, in its order, one per id the settings accept; Sage is the default and what an unknown id means", () => {
    expect(PERSONALITIES.map((p) => p.id)).toEqual([...DIRECTOR_PERSONALITIES]);
    expect(DEFAULT_PERSONALITY).toBe("the-balanced");
    expect(personalityOf(undefined).name).toBe("Sage");
    expect(personalityOf("the-nobody").id).toBe("the-balanced");
    expect(personalityOf("the-weaver").name).toBe("Meridian");
  });

  test.each(PERSONALITIES.map((p) => [p.id] as const))("%s renders its block and the shared footer, and tells the planner nothing about JSON output or tools it lacks", (id) => {
    const text = personalityPrompt(id);
    expect(text).toContain(personalityOf(id).name);
    expect(text.endsWith(SHARED_PERSONALITY_GUIDANCE)).toBe(true);
    expect(text).not.toMatch(STALE);
    expect(text).not.toMatch(/output your JSON/i);
    expect(text).not.toMatch(/OUTPUT STRUCTURE/);
    expect(text).toContain("## STAGE");
    expect(text).not.toContain(String.fromCharCode(0x2014));
  });

  test("the picker's data is whole: identity, beliefs, favorite arcs, emotional focus", () => {
    for (const p of PERSONALITIES) {
      expect([p.name, p.title, p.tagline, p.description].every((s) => s.length > 0)).toBe(true);
      expect(p.philosophy.coreBeliefs.length).toBeGreaterThan(0);
      expect(p.preferences.favoriteArcs.length).toBeGreaterThan(0);
      expect(p.preferences.emotionalFocus.length).toBeGreaterThan(0);
    }
  });
});

describe("the system prompt", () => {
  const base = { creativity: "moderate", personality: undefined } as const;

  test("it is the same text every turn for the same settings (so it can be cached) and carries no story state", () => {
    expect(systemPrompt(base)).toBe(systemPrompt(base));
    expect(systemPrompt(base)).not.toContain("Current Story State");
    expect(systemPrompt(base)).not.toMatch(STALE);
  });

  test("it keeps the self-audit and the directive example, and the creativity setting changes its level block", () => {
    const dramatic = systemPrompt({ ...base, creativity: "dramatic" });
    const subtle = systemPrompt({ ...base, creativity: "subtle" });
    expect(dramatic).toContain("SELF-AUDIT PROTOCOL");
    expect(dramatic).toContain("DIRECTIVE EXAMPLE (ALWAYS FILL OUT FULLY)");
    expect(dramatic).toContain("## Creativity Level: DRAMATIC");
    expect(subtle).toContain("## Creativity Level: SUBTLE");
    expect(dramatic.replace("DRAMATIC", "")).not.toBe(subtle.replace("SUBTLE", ""));
  });

  test("the player-character rules appear only with a persona, named when it has a name", () => {
    expect(systemPrompt(base)).not.toContain("INTERIORITY vs STAGING");
    const text = systemPrompt({ ...base, personaName: "Merlin", personaDescription: "He is a tired wizard (he/him)." });
    expect(text).toContain('## Player Character - "Merlin"\nHe is a tired wizard (he/him).');
    expect(text).toContain("INTERIORITY vs STAGING (Merlin)");
    expect(text).toContain("it cannot puppet Merlin");
    expect(text).not.toContain("${");
    expect(systemPrompt({ ...base, personaDescription: "A wizard." })).toContain("claim what the player thinks/feels");
  });

  test("the chosen personality's block is in it, and Sage when none was chosen", () => {
    expect(systemPrompt({ ...base, personality: "the-jester" })).toContain(personalityOf("the-jester").name);
    expect(systemPrompt(base)).toContain("Sage");
  });
});

describe("the user prompt", () => {
  const state = stateOf({
    chapters: [{ id: "c1", number: 1, title: "Arrival", premise: "p", status: "active", themes: ["debt"], tone: "dark", majorGoal: "Find Vera", estimatedTurns: { minimum: 20, target: 50, maximum: 100 }, turnsElapsed: 2, createdAtTurn: 1 }],
    currentChapterId: "c1",
    arcs: [arcOf({ lastProgressTurn: 1 }), arcOf({ id: "arc-2", title: "Gone Arc", removedAt: 3 }), arcOf({ id: "arc-3", title: "Beat Arc", nextBeat: { description: "A knock", plannedAtTurn: 2, targetTurn: 9, status: "pending" } })],
    seeds: [seedOf({ turnsActive: 12 }), seedOf({ id: "seed-2", hint: "Hidden seed", removedAt: 1 })],
    invisibleArcs: [hiddenOf({ userAuthored: true })], notes: [{ id: "n1", content: "Keep Vera kind.", createdAt: 1 }, { id: "n2", content: "Removed note", createdAt: 1, removedAt: 2 }],
    nextIntentions: [{ type: "advance_arc", description: "Open the door", priority: "must", targetTurn: "next" }],
  });
  const input = (over = {}) => ({ state, report: computeMomentum(state, 12), turn: 12, userMessage: "I knock.", history: [{ role: "assistant", content: "Evening." }, { role: "user", content: "Hi" }], ...over });

  test("it names commit_planning_round fields where RoleCall named tools, and nothing else the planner lacks", () => {
    const text = userPrompt(input());
    expect(text).not.toMatch(STALE);
    expect(text).toContain("(MANDATORY: send a commit_planning_round.arcUpdates entry");
    expect(text).toContain("commit_planning_round.seedUpdates every turn");
    expect(text).toContain("NEXT BEAT: NONE SET - you MUST set one this turn via commit_planning_round.arcUpdates.nextBeat");
    expect(text).toContain("-> NEXT BEAT [set on turn 2] (target: turn 9): A knock");
    expect(text.trimEnd().endsWith("Don't spoil your plans!")).toBe(true);
  });

  test("the story state leads it, the user's action is in it, and removed items are not", () => {
    const text = userPrompt(input());
    expect(text.indexOf("## Current Story State")).toBeLessThan(text.indexOf("### Chapters"));
    expect(text).toContain("### User's Action\nI knock.");
    expect(text).toContain("Current: Chapter 1: \"Arrival\" (active) - 11/50 turns");
    expect(text).not.toContain("Gone Arc");
    expect(text).not.toContain("Hidden seed");
    expect(text).not.toContain("Removed note");
    expect(text).toContain("[n1] Keep Vera kind.");
    expect(text).toContain("PLAYER-PLANTED");
    expect(text).toContain("OVERDUE (12/10 turns) - MUST resolve or advance this seed NOW");
  });

  test("a first chapter is demanded when there is none, a young chapter may not be closed, an old one is pressed", () => {
    expect(userPrompt(input({ state: stateOf() }))).toContain('commit_planning_round.chapterUpdate MUST use action "start_new" to create Chapter 1.');
    expect(userPrompt(input({ turn: 5 }))).toContain('must use action "none" or "update", never "start_new"');
    const old = stateOf({ ...state, chapters: [{ ...state.chapters[0]!, createdAtTurn: -200 }] });
    expect(userPrompt(input({ state: old, turn: 12 }))).toContain("OVERDUE: This chapter has EXCEEDED its maximum length");
  });

  test("the person's instructions are in it, bounded, and only when there are some", () => {
    expect(userPrompt(input())).not.toContain("Custom Instructions");
    expect(userPrompt(input({ instructions: "No sudden villains." }))).toContain("HIGH-PRIORITY STANDING DIRECTIVE)\nThese are the player's standing instructions for you, applied every turn. Honor them in your planning (arcs, seeds, beats, pacing, tone) unless doing so would violate safety, the character card, or the player-character POV rule.\nNo sudden villains.");
    expect(instructionsSection("  ")).toBe("");
    expect(instructionsSection("x".repeat(5_000)).length).toBeLessThan(2_400);
  });

  test("the momentum report is in it, and the self-audit is when the story has a directive and the narrator has written", () => {
    const withDirective = stateOf({ ...state, lastDirective: { mood: "m", pacing: "slow", narrativeGoal: "Let her slip." }, lastDirectiveTurn: 11 });
    const text = userPrompt(input({ state: withDirective }));
    expect(text).toContain("[MOMENTUM REPORT]");
    expect(text).toContain("[SELF-AUDIT] Your Directive From last turn");
    expect(text).toContain("Goal: Let her slip.");
    expect(userPrompt(input())).not.toContain("[SELF-AUDIT]");
  });
});

describe("the self-audit", () => {
  test("nothing without a directive or without prose; the prose is cut to its head and tail at 2,400 characters", () => {
    expect(selfAuditBlock(undefined, 1, 2, "prose")).toBe("");
    expect(selfAuditBlock({ mood: "m", pacing: "slow", narrativeGoal: "g" }, 1, 2, undefined)).toBe("");
    expect(selfAuditBlock({ mood: "", pacing: "" as never }, 1, 2, "prose")).toBe("");
    const long = `${"a".repeat(2_000)}${"b".repeat(2_000)}`;
    const block = selfAuditBlock({ mood: "m", pacing: "slow" }, 1, 5, long);
    expect(block).toContain("4 turns ago");
    expect(block).toContain("[... 1600 chars truncated ...]");
    expect(block).toContain("a".repeat(AUDIT_PROSE_MAX / 2));
    expect(block).not.toContain("a".repeat(AUDIT_PROSE_MAX / 2 + 1));
  });
});

describe("the conversation", () => {
  test("only the newest 30 messages are shown, labeled by turn, with a note of the rest", () => {
    const history = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
    const text = formatDirectorHistory(history);
    expect(text.startsWith("[10 earlier messages omitted")).toBe(true);
    expect(text).toContain("[Turn 11] user: m10");
    expect(text).not.toContain("m9\n");
    expect(text.endsWith("[Turn 40] assistant: m39")).toBe(true);
  });

  test("the whole fits the budget: a huge reply is clipped from its middle and older messages are left out", () => {
    const history = [{ role: "user", content: "old" }, { role: "assistant", content: "x".repeat(HISTORY_CHAR_BUDGET * 2) }];
    const text = formatDirectorHistory(history);
    expect(text.length).toBeLessThanOrEqual(HISTORY_CHAR_BUDGET);
    expect(text).toContain("characters omitted from the middle of this message");
    expect(text).toContain("[1 earlier messages omitted");
    expect(formatDirectorHistory([])).toBe("");
  });
});

describe("the planner prompt has a stated budget", () => {
  const huge = (n: number) => "d".repeat(n);
  const state = stateOf({
    arcs: Array.from({ length: 300 }, (_, i) => arcOf({ id: `arc-${i}`, title: `Arc ${i}`, description: huge(1_200), lastProgressTurn: i, nextBeat: { description: huge(1_200), plannedAtTurn: 1, status: "pending" } })),
    seeds: Array.from({ length: 400 }, (_, i) => seedOf({ id: `seed-${i}`, hint: `Seed ${i}`, payoff: huge(1_200), turnsActive: i % 30 })),
    invisibleArcs: [...Array.from({ length: 200 }, (_, i) => hiddenOf({ id: `hid-${i}`, title: `Hidden ${i}`, description: huge(1_200), turnsActive: i })), hiddenOf({ id: "mine", title: "Mine", userAuthored: true, turnsActive: 0 })],
    notes: Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, content: `note ${i}`, createdAt: i })),
  });
  const text = userPrompt({ state, report: computeMomentum(state, 500), turn: 500, userMessage: "go", history: [] });

  test("lists are capped, the rest are counted, long texts are clipped, and the whole stays within a stated size", () => {
    expect(text.split("\n").filter((l) => l.startsWith("- [arc-")).length).toBe(PROMPT_LIMITS.arcs);
    expect(text).toContain(`(+${300 - PROMPT_LIMITS.arcs} more active arcs not shown)`);
    expect(text).toContain(`(+${400 - PROMPT_LIMITS.seeds} more pending seeds not shown)`);
    expect(text).toContain("more hidden arcs not shown");
    expect(text).toContain("(+170 more older notes not shown)");
    expect(text).not.toContain(huge(PROMPT_LIMITS.text + 1));
    expect(text.length).toBeLessThan(70_000);
  });

  test("what needs action is never the part cut: the arcs longest without progress come first, the most overdue seeds come first, and the person's own hidden arc is always sent", () => {
    expect(text).toContain("[arc-0]");
    expect(text).not.toContain("[arc-299]");
    expect(text).toContain("[hid-199]");
    expect(text).toContain("PLAYER-PLANTED");
    expect(text).toContain("[n199]");
    expect(text).not.toContain("[n0]");
  });
});
