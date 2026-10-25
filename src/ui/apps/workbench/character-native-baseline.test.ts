/** Unrun regression for complete untouched hydration surviving a partial native save snapshot. */
import { expect, test } from "bun:test";
import { acceptedNativeBaseline } from "./character-native-baseline";

test("an untouched existing format keeps its newer complete accepted hydration", () => {
  const submitted = { risu: { raw: { additionalAssets: [] } } };
  const stored = { risu: { raw: { additionalAssets: [], description: "sealed authored text" } } };
  const accepted = acceptedNativeBaseline(submitted, stored, new Set());
  expect(accepted).toEqual(stored);
  expect(accepted.risu).not.toBe(stored.risu);
});

test("a submitted native format advances to the submitted value", () => {
  const submitted = { risu: { raw: { description: "saved" } } };
  const stored = { risu: { raw: { description: "before" } } };
  expect(acceptedNativeBaseline(submitted, stored, new Set(["risu"]))).toEqual(submitted);
});
