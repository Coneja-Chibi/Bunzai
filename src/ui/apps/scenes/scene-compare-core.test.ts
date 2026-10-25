/**
 * Tests for the version-compare facts: which versions the panels open on, and the model, preset and sampler rows
 * each version shows.
 */
import { expect, test } from "bun:test";
import { compareMeta, compareStart } from "./scene-compare-core";

// RoleCall's SwipeCompareModal (SwipeCompareModal.tsx:151-156, 33-54): the left panel opens on the version
// the reader was on, the right on the next one (the previous when the current is the last).
test("the panels open on the current version and its neighbour", () => {
  expect(compareStart(0, 3)).toEqual({ left: 0, right: 1 });
  expect(compareStart(1, 3)).toEqual({ left: 1, right: 2 });
  expect(compareStart(2, 3)).toEqual({ left: 2, right: 1 });
  expect(compareStart(1, 2)).toEqual({ left: 1, right: 0 });
});

test("a version with no generation says Unknown Model and no details", () => {
  const meta = compareMeta(1, { createdAt: 0 });
  expect(meta).toMatchObject({ label: "Version 2", model: "Unknown Model", modelKnown: false, preset: null, samplers: [], hasDetails: false });
  expect(meta.time).toBe("");
});

test("model, preset and sampler rows follow RoleCall's order and precision", () => {
  const meta = compareMeta(0, {
    createdAt: new Date(2026, 9, 8, 9, 5).getTime(),
    generation: { model: "openai/gpt-4o", presetName: "Velvet Quill", samplers: { minP: 0.05, topK: 40, temperature: 0.7, topP: 0.9, maxTokens: 600 } },
  });
  expect(meta.model).toBe("openai/gpt-4o");
  expect(meta.modelKnown).toBe(true);
  expect(meta.preset).toBe("Velvet Quill");
  expect(meta.samplers).toEqual([
    { label: "Temperature", value: "0.70" }, { label: "Top P", value: "0.90" }, { label: "Top K", value: "40" }, { label: "Min P", value: "0.050" },
  ]);
  expect(meta.hasDetails).toBe(true);
  expect(meta.time).not.toBe("");
});

test("a preset alone, or samplers alone, still count as details; an unknown preset reads Unknown", () => {
  expect(compareMeta(0, { createdAt: 1, generation: { presetName: "P" } }).hasDetails).toBe(true);
  const only = compareMeta(0, { createdAt: 1, generation: { samplers: { temperature: 1 } } });
  expect(only.hasDetails).toBe(true);
  expect(only.preset).toBeNull();
});

test("non-numeric or missing sampler values are left out", () => {
  const meta = compareMeta(0, { createdAt: 1, generation: { samplers: { temperature: "hot", topK: 20 } } });
  expect(meta.samplers).toEqual([{ label: "Top K", value: "20" }]);
});

// Dry audit A13: the time column guards a finite stamp like every other scene time, so a non-finite createdAt is blank, not "Invalid Date".
test("a version with no usable time shows no time", () => {
  expect(compareMeta(0, { createdAt: Number.POSITIVE_INFINITY }).time).toBe("");
  expect(compareMeta(0, { createdAt: Number.NaN }).time).toBe("");
  expect(compareMeta(0, { createdAt: -5 }).time).toBe("");
  expect(compareMeta(0, { createdAt: 1_700_000_000_000 }).time).not.toBe("");
});
