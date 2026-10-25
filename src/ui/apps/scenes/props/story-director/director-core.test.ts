/**
 * The Director panel's rules before it draws (director-core.ts): the tab list, arc grouping and sections, the chapter shown, the activity filter and order, the overdue counters, the
 * relative time, the size readout, and the limits the page mirrors from the server's edit file.
 */
import { describe, expect, test } from "bun:test";
import { arcOf, seedOf } from "../../../../../core/director/fixtures";
import { HIDDEN_TEXT_MAX as SERVER_TEXT, HIDDEN_TITLE_MAX as SERVER_TITLE, NOTE_MAX as SERVER_NOTE } from "../../../../../studio/scene-director-edit";
import type { DirectorActivity, DirectorChapter } from "../../../../../stage/contracts/director-types";
import { ACTIVITY_LABELS, DIRECTOR_TABS, HIDDEN_TEXT_MAX, HIDDEN_TITLE_MAX, NOTE_MAX, activityNewestFirst, currentChapter, formatAgo, groupArcs, overdueOf, recentCount, sectionArcs, sizeReadout, statusTone } from "./director-core";

const chapter = (over: Partial<DirectorChapter> = {}): DirectorChapter => ({ id: "c1", number: 1, title: "One", premise: "", status: "active", themes: [], tone: "", majorGoal: "", estimatedTurns: { minimum: 1, target: 2, maximum: 3 }, turnsElapsed: 0, createdAtTurn: 1, ...over });
const line = (id: string, type: DirectorActivity["type"], at: number): DirectorActivity => ({ id, at, turn: 1, type, result: "info", description: id });

describe("the panel's rules", () => {
  test("the five tabs are RoleCall's, in its order", () => {
    expect(DIRECTOR_TABS.map((t) => t.label)).toEqual(["Story", "Arcs", "Analysis", "Activity", "Debug"]);
  });

  test("the limits the page mirrors are the server's", () => {
    expect([NOTE_MAX, HIDDEN_TITLE_MAX, HIDDEN_TEXT_MAX]).toEqual([SERVER_NOTE, SERVER_TITLE, SERVER_TEXT]);
  });

  test("arcs without a chapter come first, then each chapter in number order, labelled like RoleCall", () => {
    const chapters = [chapter({ id: "c2", number: 2, title: "Two" }), chapter({ id: "c1", number: 1, title: "One" })];
    const groups = groupArcs([arcOf({ id: "a", chapterId: "c2" }), arcOf({ id: "b" }), arcOf({ id: "c", chapterId: "c1" }), arcOf({ id: "d", chapterId: "gone" })], chapters);
    expect(groups.map((g) => [g.label, g.arcs.map((a) => a.id)])).toEqual([["Unchaptered", ["b", "d"]], ["Ch. 1: One", ["c"]], ["Ch. 2: Two", ["a"]]]);
  });

  test("active arcs sort epic first to immediate last; complete and abandoned are their own sections", () => {
    const s = sectionArcs([arcOf({ id: "i", horizon: "immediate" }), arcOf({ id: "e", horizon: "epic" }), arcOf({ id: "done", status: "complete" }), arcOf({ id: "x", status: "abandoned" })]);
    expect(s.active.map((a) => a.id)).toEqual(["e", "i"]);
    expect([s.completed.length, s.abandoned.length]).toEqual([1, 1]);
  });

  test("the chapter shown is the one the state points at, else the newest unfinished, else the newest", () => {
    const list = [chapter({ id: "c1", number: 1, status: "complete" }), chapter({ id: "c2", number: 2 }), chapter({ id: "c3", number: 3, status: "complete" })];
    expect(currentChapter(list, "c1")?.id).toBe("c1");
    expect(currentChapter(list, undefined)?.id).toBe("c2");
    expect(currentChapter([list[0]!, list[2]!], "lost")?.id).toBe("c3");
    expect(currentChapter([], "x")).toBeUndefined();
  });

  test("the feed is newest first, and each filter keeps its own types", () => {
    const feed = [line("a", "turn_start", 1), line("b", "arc", 2), line("c", "directive", 3), line("d", "turn_error", 4)];
    expect(activityNewestFirst(feed).map((e) => e.id)).toEqual(["d", "c", "b", "a"]);
    expect(activityNewestFirst(feed, "turns").map((e) => e.id)).toEqual(["d", "a"]);
    expect(activityNewestFirst(feed, "tools").map((e) => e.id)).toEqual(["b"]);
    expect(activityNewestFirst([line("t", "tracker", 5), ...feed], "tools").map((e) => e.id)).toEqual(["b", "t"]);
    expect(activityNewestFirst(feed, "planning").map((e) => e.id)).toEqual(["c"]);
    expect(feed[0]!.id).toBe("a");
  });

  test("labels are RoleCall's words", () => {
    expect(ACTIVITY_LABELS).toMatchObject({ turn_start: "Turn Start", turn_finish: "Turn Done", turn_error: "Turn Error", invisible_arc: "Invisible Arc", directive: "Directive" });
  });

  test("time reads like RoleCall's, and the badge counts the last five minutes", () => {
    expect([formatAgo(0, 12_000), formatAgo(0, 200_000), formatAgo(0, 7_300_000)]).toEqual(["12s ago", "3m ago", "2h ago"]);
    expect(recentCount([line("a", "arc", 0), line("b", "arc", 290_000)], 300_000)).toBe(1);
  });

  test("a seed or hidden arc is overdue at its horizon's threshold", () => {
    expect(overdueOf("short", 2)).toEqual({ text: "2/3", overdue: false });
    expect(overdueOf("short", 3)).toEqual({ text: "3/3", overdue: true });
    expect(overdueOf("epic", 24).overdue).toBe(false);
    expect(seedOf({ turnsActive: 5, payoffHorizon: "medium" }).turnsActive).toBe(5);
  });

  test("a status reads ok, info, warn or muted like RoleCall's badge", () => {
    expect(["active", "complete", "seeding", "building"].map(statusTone)).toEqual(["ok", "info", "warn", "mute"]);
  });

  test("the size readout names the share and warns near the limit", () => {
    expect(sizeReadout({ bytes: 12_400, max: 600_000 })).toEqual({ text: "12.4 KB of 600 KB", near: false });
    expect(sizeReadout({ bytes: 480_000, max: 600_000 }).near).toBe(true);
  });
});
