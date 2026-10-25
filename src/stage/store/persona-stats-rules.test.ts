/** The persona-day aggregation both ChatStore backends use when a scene is born with its history. */
import { describe, expect, test } from "bun:test";
import type { Cast, ChatHistory, ImportedMessage } from "../contracts/chat-store";
import { DAY_MS, dayOf, personaDaysOf } from "./persona-stats-rules";

const ref = (id: string) => ({ id, version: 1, name: id });
const msg = (role: ImportedMessage["role"], day: number, persona?: string): ImportedMessage => ({
  role, createdAt: day * DAY_MS + 5, current: 0, swipes: [{ content: "x", createdAt: day * DAY_MS + 5 }],
  ...(persona === undefined ? {} : { persona: { id: persona, name: persona } }),
});
const history = (...messages: ImportedMessage[]): ChatHistory => ({ createdAt: 0, updatedAt: 0, messages });

describe("personaDaysOf", () => {
  test("counts only user messages, by their stamped persona, falling back to the scene's persona", () => {
    const cast: Cast = { character: ref("c"), persona: ref("scene-persona") };
    const days = personaDaysOf(history(msg("user", 10, "ana"), msg("assistant", 10), msg("user", 11), msg("user", 11, "ana")), cast);
    expect(days.get("ana")).toEqual([10, 11]);
    expect(days.get("scene-persona")).toEqual([11]);
    expect(days.size).toBe(2);
  });
  test("a scene with no persona keeps unstamped user messages under undefined, and has no entry without user messages", () => {
    expect(personaDaysOf(history(msg("user", 3)), { character: ref("c") }).get(undefined)).toEqual([3]);
    expect(personaDaysOf(history(msg("assistant", 3)), { character: ref("c") }).size).toBe(0);
  });
  test("one entry per message, in order, using the shared UTC day", () => {
    const days = personaDaysOf(history(msg("user", 7, "a"), msg("user", 7, "a")), { character: ref("c") });
    expect(days.get("a")).toEqual([7, 7]);
    expect(dayOf(7 * DAY_MS + 5)).toBe(7);
  });
});
