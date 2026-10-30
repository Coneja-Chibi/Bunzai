/** The Dramaturg's settings resolve to the scene's model, no reasoning level and temperature 0.7; the Prop being in the scene's Props is what turns it on. */
import { describe, expect, test } from "bun:test";
import { DRAMATURG_DEFAULT_TEMPERATURE, DRAMATURG_PROP_ID, DRAMATURG_QUESTION_MAX, dramaturgOn, resolveDramaturg } from "./settings";

describe("the Dramaturg's settings", () => {
  test("defaults: no model of its own, no reasoning level, 0.7; a set value wins", () => {
    expect(DRAMATURG_DEFAULT_TEMPERATURE).toBe(0.7);
    expect(DRAMATURG_QUESTION_MAX).toBe(8_000);
    expect(resolveDramaturg({})).toEqual({ temperature: 0.7 });
    expect(resolveDramaturg({ model: { id: "c", model: "deep" }, reasoning: "high", temperature: 0 })).toEqual({ model: { id: "c", model: "deep" }, reasoning: "high", temperature: 0 });
  });

  test("on only while the dramaturg Prop is in the scene's Props", () => {
    expect(DRAMATURG_PROP_ID).toBe("dramaturg");
    expect(dramaturgOn({})).toBe(false);
    expect(dramaturgOn({ props: { on: ["story-director"] } })).toBe(false);
    expect(dramaturgOn({ props: { on: ["dramaturg"] } })).toBe(true);
  });
});
