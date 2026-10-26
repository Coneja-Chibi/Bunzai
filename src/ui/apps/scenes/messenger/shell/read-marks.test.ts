/** Read marks without a DOM: the pref is parsed defensively, unread is counted from the mark, and a write happens only when the count moved. */
import { describe, expect, test } from "bun:test";
import type { SceneSummary } from "../../../../../studio/scenes";
import { MAX_MARKS, READ_MARKS_KEY, markRead, readMarks, unreadByCharacter, unreadByScene, unreadLabel, unreadOf } from "./read-marks";

const sc = (id: string, character: string, messageCount: number): SceneSummary => ({ id, messageCount, cast: { character: { id: character } } }) as unknown as SceneSummary;

const prefsOf = (init: Record<string, unknown> = {}) => {
  const map = new Map(Object.entries(init));
  const writes: unknown[] = [];
  return { get: (k: string) => map.get(k), set: (k: string, v: unknown) => { writes.push(v); map.set(k, v); }, map, writes };
};

describe("read marks", () => {
  test("an unset, malformed or partly bad pref reads as the valid entries only", () => {
    expect(readMarks(prefsOf())).toEqual({});
    expect(readMarks(prefsOf({ [READ_MARKS_KEY]: [1, 2] }))).toEqual({});
    expect(readMarks(prefsOf({ [READ_MARKS_KEY]: "x" }))).toEqual({});
    expect(readMarks(prefsOf({ [READ_MARKS_KEY]: { a: { at: 1, count: 3 }, b: { at: 1, count: -1 }, c: { count: 2 }, d: null } }))).toEqual({ a: { at: 1, count: 3 } });
  });

  test("unread counts messages past the mark, never goes negative, and is 0 without a mark", () => {
    const marks = { a: { at: 1, count: 5 } };
    expect(unreadOf(marks, "a", 8)).toBe(3);
    expect(unreadOf(marks, "a", 5)).toBe(0);
    expect(unreadOf(marks, "a", 2)).toBe(0);
    expect(unreadOf(marks, "never-opened", 40)).toBe(0);
  });

  test("marking saves the count and the time, and an unchanged count writes nothing", () => {
    const prefs = prefsOf();
    const one = markRead(prefs, {}, "a", 4, 100);
    expect(one).toEqual({ a: { at: 100, count: 4 } });
    expect(prefs.get(READ_MARKS_KEY)).toEqual(one);
    expect(markRead(prefs, one, "a", 4, 200)).toBe(one);
    expect(prefs.writes).toHaveLength(1);
    const two = markRead(prefs, one, "a", 6, 300);
    expect(two.a).toEqual({ at: 300, count: 6 });
    expect(prefs.writes).toHaveLength(2);
  });

  test("a take switch that lowers the count moves the mark down so new messages still show", () => {
    const prefs = prefsOf();
    const marks = markRead(prefs, markRead(prefs, {}, "a", 10, 1), "a", 3, 2);
    expect(unreadOf(marks, "a", 4)).toBe(1);
  });

  test("the map keeps the newest scenes", () => {
    const prefs = prefsOf();
    let marks: ReturnType<typeof readMarks> = {};
    for (let i = 0; i <= MAX_MARKS; i++) marks = markRead(prefs, marks, `s${i}`, 1, i);
    expect(Object.keys(marks)).toHaveLength(MAX_MARKS);
    expect(marks.s0).toBeUndefined();
    expect(marks[`s${MAX_MARKS}`]).toBeDefined();
  });
});

describe("unread by scene and character", () => {
  const scenes = [sc("a1", "A", 10), sc("a2", "A", 7), sc("b1", "B", 3), sc("c1", "C", 9)];
  const marks = { a1: { at: 1, count: 4 }, a2: { at: 1, count: 5 }, b1: { at: 1, count: 3 } };
  test("the open scene is never unread, scenes without a mark are not flagged, and a character sums its scenes", () => {
    expect(unreadByScene(marks, scenes, "a2")).toEqual({ a1: 6 });
    expect(unreadByScene(marks, scenes, "")).toEqual({ a1: 6, a2: 2 });
    expect(unreadByCharacter(unreadByScene(marks, scenes, ""), scenes)).toEqual({ A: 8 });
  });
  test("the badge caps at 99+", () => {
    expect([1, 99, 100, 640].map(unreadLabel)).toEqual(["1", "99", "99+", "99+"]);
  });
});
