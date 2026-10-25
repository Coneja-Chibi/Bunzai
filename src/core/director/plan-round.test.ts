/**
 * Reading the planning command's arguments: a bad directive refuses the round, a bad entry elsewhere costs only that entry, and the command is offered as RoleCall offers it minus
 * the Storyboards' dossier field.
 */
import { describe, expect, test } from "bun:test";
import { PLANNING_TOOL, PLANNING_TOOL_NAME, readPlanningRound } from "./plan-round";

const ok = (over: Record<string, unknown> = {}) => ({
  directive: { mood: "tense", pacing: "slow" }, arcUpdates: [], seedUpdates: [], invisibleArcUpdates: [], analysis: {}, chapterUpdate: { action: "none", title: "x" }, ...over,
});

describe("the command", () => {
  test("it is the one forced command, its required fields are the six sections, and the dossier field is gone", () => {
    expect(PLANNING_TOOL.function.name).toBe(PLANNING_TOOL_NAME);
    expect(PLANNING_TOOL.function.parameters.required).toEqual(["directive", "arcUpdates", "seedUpdates", "invisibleArcUpdates", "analysis", "chapterUpdate"]);
    expect(JSON.stringify(PLANNING_TOOL)).not.toMatch(/dossier|batch_update|set_directive|update_analysis/);
    expect(JSON.stringify(PLANNING_TOOL)).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("the directive", () => {
  test.each([[null], ["x"], [{}], [{ mood: "tense" }], [{ pacing: "slow" }], [{ mood: "tense", pacing: "sluggish" }], [{ mood: "  ", pacing: "slow" }]])("a directive of %j refuses the round", (directive) => {
    const read = readPlanningRound(ok({ directive }));
    expect(read.ok).toBe(false);
  });

  test("arguments that are not an object refuse the round", () => {
    expect(readPlanningRound("nope").ok).toBe(false);
    expect(readPlanningRound(null).ok).toBe(false);
    expect(readPlanningRound([]).ok).toBe(false);
  });

  test("a whole directive is kept field by field; empty groups and malformed entries are left out; texts and lists are bounded", () => {
    const read = readPlanningRound(ok({ directive: {
      mood: "m", pacing: "fast", include: { characters: ["A", "", 3, "B"], themes: [] }, avoid: {}, endingHook: "h".repeat(2_000), narrativeGoal: "g",
      arcDirections: [{ arcName: "Arc", instruction: "do", urgency: "forceful" }, { arcName: "NoInstruction" }, { arcName: "Arc2", instruction: "x", urgency: "loud" }],
      callbacks: [{ reference: "r", instruction: "i" }, { reference: "only" }], characterBeats: [{ character: "A", beat: "b", motivation: "why" }, { character: "B" }],
      dialogueGuidance: [{ character: "A", tone: "dry", hints: ["x"] }, { character: "B" }], sceneGuidance: { setting: "s", tension_level: 99 },
    } }));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const d = read.round.directive;
    expect(d.include).toEqual({ characters: ["A", "B"] });
    expect(d.avoid).toBeUndefined();
    expect(d.endingHook).toHaveLength(1_200);
    expect(d.arcDirections).toEqual([{ arcName: "Arc", instruction: "do", urgency: "forceful" }, { arcName: "Arc2", instruction: "x", urgency: "moderate" }]);
    expect(d.callbacks).toEqual([{ reference: "r", instruction: "i" }]);
    expect(d.characterBeats).toEqual([{ character: "A", beat: "b", motivation: "why" }]);
    expect(d.dialogueGuidance).toEqual([{ character: "A", tone: "dry", hints: ["x"] }]);
    expect(d.sceneGuidance).toEqual({ setting: "s", tension_level: 10 });
  });
});

describe("the other sections", () => {
  test("a bare-string analysis is the account of what happened; string intentions become intentions", () => {
    const a = readPlanningRound(ok({ analysis: "They argued." }));
    expect(a.ok && a.round.analysis).toEqual({ whatHappened: "They argued." });
    const b = readPlanningRound(ok({ analysis: { intentions: ["Raise the stakes", { description: "Slow down", priority: "must", targetTurn: "soon" }, { nope: 1 }] } }));
    expect(b.ok && b.round.analysis.intentions).toEqual([{ description: "Raise the stakes" }, { description: "Slow down", priority: "must", targetTurn: "soon" }]);
  });

  test("arc updates need an id or a title; a horizon given as short-term is short; a next beat's target turn is coerced; a bad status is dropped, not the update", () => {
    const read = readPlanningRound(ok({ arcUpdates: [
      { arcId: "arc-1", status: "climax", horizon: "short-term", nextBeat: { description: "The door opens", targetTurn: "12" }, markNextBeatDelivered: true },
      { title: "A new thread", status: "sideways" }, { description: "no identity" }, "junk",
    ] }));
    expect(read.ok && read.round.arcUpdates).toEqual([
      { arcId: "arc-1", status: "climax", horizon: "short", nextBeat: { description: "The door opens", targetTurn: 12 }, markNextBeatDelivered: true },
      { arcId: "A new thread", title: "A new thread" },
    ]);
  });

  test("a seed update with no action reinforces; with an unknown action it reinforces too, and one with no title is dropped", () => {
    const read = readPlanningRound(ok({ seedUpdates: [{ title: "Bell" }, { title: "Key", action: "PLANT", payoffHorizon: "epic" }, { action: "plant" }] }));
    expect(read.ok && read.round.seedUpdates).toEqual([{ title: "Bell", action: "reinforce" }, { title: "Key", action: "plant", payoffHorizon: "epic" }]);
  });

  test("a hidden-arc update needs a title and a known action", () => {
    const read = readPlanningRound(ok({ invisibleArcUpdates: [{ title: "Cabal", action: "add", plannedBeats: [{ description: "meet" }, { completed: true }] }, { title: "No action" }, { action: "add" }] }));
    expect(read.ok && read.round.invisibleArcUpdates).toEqual([{ title: "Cabal", action: "add", plannedBeats: [{ description: "meet" }] }]);
  });

  test("the chapter decision defaults to none with the story's first title", () => {
    const read = readPlanningRound(ok({ chapterUpdate: "start please" }));
    expect(read.ok && read.round.chapterUpdate).toEqual({ action: "none", title: "The Story Begins" });
  });
});
