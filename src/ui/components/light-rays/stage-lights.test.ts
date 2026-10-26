/** The effective Stage lights: unknown saves read as moving, and Reduce motion caps moving at still without ever turning Off back on. */
import { expect, test } from "bun:test";
import { effectiveStageLights } from "./stage-lights";

test("every choice, with and without Reduce motion", () => {
  const modes = [undefined, "moving", "still", "off"];
  expect(modes.map((v) => effectiveStageLights(v, false))).toEqual(["moving", "moving", "still", "off"]);
  expect(modes.map((v) => effectiveStageLights(v, true))).toEqual(["still", "still", "still", "off"]);
});

test("an unknown saved value reads as moving", () => {
  for (const bad of [null, "", "dim", 1, {}]) expect(effectiveStageLights(bad, false)).toBe("moving");
});
