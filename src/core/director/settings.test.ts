/** The Director's settings resolve to automatic tracker updates on, every reply, one call per reply (plan 17). */
import { describe, expect, test } from "bun:test";
import { resolveDirector } from "./settings";

describe("resolveDirector", () => {
  test("auto-update is on, every 1 reply, one call per reply; a set value wins, and off stays off", () => {
    expect(resolveDirector({})).toMatchObject({ autoUpdate: true, every: 1, callsPerReply: 1 });
    expect(resolveDirector({ director: { autoUpdate: false, every: 4, callsPerReply: 5 } })).toMatchObject({ autoUpdate: false, every: 4, callsPerReply: 5 });
    expect(resolveDirector({ director: { every: 7 } })).toMatchObject({ autoUpdate: true, every: 7, callsPerReply: 1 });
  });
});
