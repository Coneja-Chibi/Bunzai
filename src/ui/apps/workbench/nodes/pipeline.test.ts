/** The Pipeline layer's pure core: build order, slot sources, the dry run, and what the request node reports. */
import { expect, test } from "bun:test";
import type { PresetPrompt } from "../../../../entities/preset";
import { emptyPresetBody } from "../../../../entities/preset/schema";
import type { StudioEntitySummary } from "../../../app-contract";
import { contextOf, dryRequest, featureRows, loreIdsOf, markerWires, pipelineModel, pipelineRows, requestView, slotTexts } from "./pipeline";

export const block = (id: string, over: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id, name: id, content: `text of ${id}`, role: "system", enabled: true, systemPrompt: false, marker: false,
  placement: "relative", injectionDepth: 4, injectionOrder: 100, forbidOverrides: false, ...over,
});
const marker = (id: string, slot: string, over: Partial<PresetPrompt> = {}): PresetPrompt =>
  block(id, { name: id, content: "", marker: true, markerSlot: slot, ...over });
const presetOf = (...prompts: PresetPrompt[]) => ({ ...emptyPresetBody("Cut"), prompts });
const none = { texts: {}, lore: null };

test("every block shows in build order, off ones kept and marked, with the totals counting only what is on", () => {
  const body = presetOf(
    block("late", { placement: "append_preset", content: "z".repeat(40) }),
    block("main", { content: "a".repeat(400) }),
    block("depth", { placement: "in_chat", content: "c".repeat(80) }),
    block("off", { enabled: false, content: "b".repeat(4000) }),
    block("first", { placement: "prepend_preset", content: "d".repeat(40) }),
  );
  const s = pipelineRows(body, none);
  expect(s.rows.map((r) => r.id)).toEqual(["first", "main", "off", "depth", "late"]);
  expect(s.rows.find((r) => r.id === "off")).toMatchObject({ on: false, tokens: 1000 });
  expect([s.blocks, s.off]).toEqual([5, 1]);
  expect(s.tokens).toBe(10 + 100 + 20 + 10);
});

test("a tie in placement and Order keeps the authored order", () => {
  const s = pipelineRows(presetOf(block("b"), block("a")), none);
  expect(s.rows.map((r) => r.id)).toEqual(["b", "a"]);
});

test("a marker counts the text of whatever fills it, and the lore pass fills world info", () => {
  const body = presetOf(marker("cd", "charDescription"), marker("wi", "worldInfoBefore"), marker("hist", "chatHistory"));
  const texts = slotTexts({ identity: { description: "x".repeat(80) } }, null);
  const s = pipelineRows(body, { texts, lore: { books: 1, entries: 5, enabled: 5, alwaysOn: 2, alwaysOnTokens: 300 } });
  expect(s.rows.map((r) => [r.id, r.owner, r.tokens])).toEqual([["cd", "character", 20], ["wi", "lore", 300], ["hist", "scene", null]]);
});

test("the context is the picked scene's cast, else the first character and persona on the canvas", () => {
  const canvas = [
    { id: "p1", kind: "persona", name: "Chi" }, { id: "c1", kind: "character", name: "Vera" }, { id: "c2", kind: "character", name: "Iris" },
  ];
  expect(contextOf(null, canvas)).toEqual({ character: { id: "c1", name: "Vera", fromScene: false }, persona: { id: "p1", name: "Chi", fromScene: false } });
  const scene = contextOf({ characterId: "c2", characterName: "Iris" }, canvas);
  expect(scene.character).toEqual({ id: "c2", name: "Iris", fromScene: true });
  expect(scene.persona).toBeNull();
});

test("lorebooks come from the character and persona plus the scene's, minus the ones it switched off", () => {
  expect(loreIdsOf({ knowledgeRefs: ["a", "b"] }, { knowledgeRefs: ["b", "c"] }, { added: ["d"], off: ["a"] })).toEqual(["b", "c", "d"]);
});

test("marker wires follow the context and only start from pieces that are on the canvas", () => {
  const rows = pipelineRows(presetOf(marker("cd", "charDescription"), marker("pd", "personaDescription"), marker("wi", "worldInfoBefore"), marker("off", "scenario", { enabled: false })), none).rows;
  const ctx = { character: { id: "c2", name: "Iris", fromScene: true }, persona: { id: "p1", name: "Chi", fromScene: false } };
  const wires = markerWires("preset:s1", rows, ctx, new Set(["character:c1", "character:c2"]));
  expect(wires.map((w) => w.from).sort()).toEqual(["character:c2", "engine:lore"]);
  expect(markerWires("preset:s1", rows, ctx, new Set(["character:c2", "persona:p1"])).map((w) => w.from).sort()).toEqual(["character:c2", "engine:lore", "persona:p1"]);
});

test("the dry run sends the enabled blocks in build order with slot text where it is known, and says it is an estimate", () => {
  const body = presetOf(block("main", { content: "a".repeat(40) }), marker("cd", "charDescription"), marker("hist", "chatHistory"), block("off", { enabled: false }));
  const summary = pipelineRows(body, { texts: { charDescription: "She is tall." }, lore: null });
  const dry = dryRequest(summary);
  expect(dry.messages.map((m) => m.content)).toEqual(["a".repeat(40), "She is tall.", "the chat history splices in here"]);
  // the unfilled chat-history slot is shown but counts as nothing, so the estimate is only what would be sent
  expect(dry.messages[2]!.tokens).toBe(0);
  expect(dry.tokens).toBe(dry.messages[0]!.tokens + dry.messages[1]!.tokens);
  const view = requestView(false, { t: "none" }, dry);
  expect(view.basis).toBe("dry");
  expect(view.lines[0]).toContain("(estimate)");
  expect(view.notes.join(" ")).toContain("estimate");
});

test("a picked scene's forecast replaces the dry run; a forecast that fails falls back and says why", () => {
  const dry = { messages: [{ role: "system", content: "dry", tokens: 1 }], tokens: 1 };
  const forecast = { messages: [{ role: "system" as const, content: "real", tokens: 5 }], tokens: 5, window: { context: 32000, reply: 1000, stated: true }, model: "m1", notes: ["Prompt regex runs when you send."] };
  const ready = requestView(true, { t: "ready", forecast }, dry);
  expect(ready).toMatchObject({ basis: "forecast", tokens: 5, lines: ["~5 tok of ~32.0k", "model: m1"] });
  expect(ready.messages.map((m) => m.content)).toEqual(["real"]);
  const failed = requestView(true, { t: "error", message: "no connection" }, dry);
  expect(failed.basis).toBe("dry");
  expect(failed.notes[0]).toContain("no connection");
  expect(requestView(true, { t: "loading" }, dry).basis).toBe("dry");
});

test("the request builds from the picked scene's preset when it is on the canvas, else the first", () => {
  const a: StudioEntitySummary = { kind: "preset", id: "a", name: "A" };
  const b: StudioEntitySummary = { kind: "preset", id: "b", name: "B" };
  const input = { presets: [{ piece: a, body: presetOf(block("x")) }, { piece: b, body: presetOf(block("y"), block("z")) }], sources: none, hasScene: false, forecast: { t: "none" } as const };
  expect(pipelineModel({ ...input, scenePresetId: "b" }).active?.piece.id).toBe("b");
  expect(pipelineModel({ ...input, scenePresetId: "gone" }).active?.piece.id).toBe("a");
  // the Request node's own pick applies with no scene, and a scene's preset still wins over it
  expect(pipelineModel({ ...input, scenePresetId: undefined, chosenPresetId: "b" }).active?.piece.id).toBe("b");
  expect(pipelineModel({ ...input, scenePresetId: "a", chosenPresetId: "b" }).active?.piece.id).toBe("a");
  expect(pipelineModel({ ...input, presets: [{ piece: a, body: undefined }], scenePresetId: undefined }).presets).toHaveLength(0);
});

test("each feature lands at the row of its first switched-on marker, or keeps its own spot (the assembler's own rule)", () => {
  const { rows } = pipelineRows(presetOf(block("main"), marker("t1", "trackers", { enabled: false }), marker("t2", "trackers"), marker("t3", "trackers"), marker("sb", "storyboards")), none);
  expect(featureRows(rows)).toEqual({ trackers: 2, linkedTrackers: null, storyboards: 4 });
});
