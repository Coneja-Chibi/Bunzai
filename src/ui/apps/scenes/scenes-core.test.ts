/** The Scenes list's filters, orders, search, relative times, and the P3 gamified list's own
 * grouping: the cast rail, Fan Favorites, the This Week / Earlier split, folder/smart filters,
 * take-strip pips, and a folder's deterministic tint. */
import { expect, test } from "bun:test";
import type { SceneSummary } from "../../../studio/scenes";
import { castRail, fanFavorites, filterScenes, folderTint, shownScenes, since, sinceShort, sortScenes, splitByWeek, takePips } from "./scenes-core";

const DAY = 86_400_000;
const now = 1_000 * DAY;
const scene = (id: string, title: string, characterName: string, ageDays: number, messageCount: number, over: Partial<SceneSummary> = {}): SceneSummary =>
  ({
    id, title, characterName, messageCount, takeCount: 1, activeTake: { name: "main", original: true }, hasPortrait: false,
    updatedAt: now - ageDays * DAY, createdAt: 0, activeBranchId: "b", snapshotVersion: 1, cast: { character: { id: characterName, version: 1 } }, ...over,
  });
const all = [scene("a", "The long storm", "Marguerite", 0.1, 42), scene("b", "Cut the deck", "Nuit", 3, 18), scene("c", "Heist", "The Magpie", 40, 99)];

test("period, search, and order", () => {
  expect(shownScenes(all, { period: "all", order: "recent", query: "", now }).map((s) => s.id)).toEqual(["a", "b", "c"]);
  expect(shownScenes(all, { period: "week", order: "recent", query: "", now }).map((s) => s.id)).toEqual(["a", "b"]);
  expect(shownScenes(all, { period: "all", order: "messages", query: "", now }).map((s) => s.id)).toEqual(["c", "a", "b"]);
  expect(shownScenes(all, { period: "all", order: "recent", query: "nuit", now }).map((s) => s.id)).toEqual(["b"]);
  expect(shownScenes(all, { period: "all", order: "recent", query: "STORM", now }).map((s) => s.id)).toEqual(["a"]);
  // a scene the summary search found joins the title and character matches, inside the period shown
  expect(shownScenes(all, { period: "all", order: "recent", query: "STORM", now, alsoIds: new Set(["c"]) }).map((s) => s.id)).toEqual(["a", "c"]);
  expect(shownScenes(all, { period: "week", order: "recent", query: "zzzz", now, alsoIds: new Set(["c", "a"]) }).map((s) => s.id)).toEqual(["a"]);
  expect(shownScenes(all, { period: "all", order: "recent", query: "", now, alsoIds: new Set(["c"]) }).map((s) => s.id)).toEqual(["a", "b", "c"]);
});

test("relative times read as RoleCall writes them", () => {
  expect(since(now, now)).toBe("less than a minute");
  expect(since(now - 3 * 60_000, now)).toBe("3 minutes");
  expect(since(now - 2 * 3_600_000, now)).toBe("about 2 hours");
  expect(since(now - 3 * DAY, now)).toBe("3 days");
  expect(since(now - 60 * DAY, now)).toBe("about 2 months");
  expect(sinceShort(now - 21 * DAY, now)).toBe("21d");
  expect(sinceShort(now - 2 * 3_600_000, now)).toBe("2h");
});

test("castRail: one tile per character, most recent scene wins the tile's art, count sums, and only the overall newest is playing", () => {
  const vera1 = scene("v1", "The long storm", "Vera", 0.1, 42, { cast: { character: { id: "vera", version: 1 } } });
  const vera2 = scene("v2", "Older Vera scene", "Vera", 10, 5, { cast: { character: { id: "vera", version: 1 } } });
  const nuit = scene("n1", "Cut the deck", "Nuit", 3, 18, { cast: { character: { id: "nuit", version: 1 } } });
  const rail = castRail([vera1, nuit, vera2]); // already newest-first, as listScenes hands it over
  expect(rail).toEqual([
    { characterId: "vera", name: "Vera", latestSceneId: "v1", hasPortrait: false, snapshotVersion: 1, count: 2, playing: true, accent: undefined },
    { characterId: "nuit", name: "Nuit", latestSceneId: "n1", hasPortrait: false, snapshotVersion: 1, count: 1, playing: false, accent: undefined },
  ]);
});

test("castRail: the tile's accent is its most recent scene's, never overwritten by an older one", () => {
  const veraLatest = scene("v1", "The long storm", "Vera", 0.1, 42, { cast: { character: { id: "vera", version: 1 } }, accent: "#111111" });
  const veraOlder = scene("v2", "Older Vera scene", "Vera", 10, 5, { cast: { character: { id: "vera", version: 1 } }, accent: "#222222" });
  const rail = castRail([veraLatest, veraOlder]);
  expect(rail[0]!.accent).toBe("#111111");
});

test("splitByWeek: 7 days is the line, each half keeps its incoming order", () => {
  const { thisWeek, earlier } = splitByWeek(all, now);
  expect(thisWeek.map((s) => s.id)).toEqual(["a", "b"]);
  expect(earlier.map((s) => s.id)).toEqual(["c"]);
});

test("fanFavorites: only starred scenes, newest star first", () => {
  const starred1 = scene("f1", "Old star", "Vera", 5, 1, { favoredAt: now - 5 * DAY });
  const starred2 = scene("f2", "New star", "Vera", 1, 1, { favoredAt: now - 1 * DAY });
  const unstarred = scene("f3", "No star", "Vera", 2, 1);
  expect(fanFavorites([unstarred, starred1, starred2]).map((s) => s.id)).toEqual(["f2", "f1"]);
});

test("filterScenes: character, folder, and the longest-stories smart filter", () => {
  const vera = scene("v1", "V", "Vera", 1, 5, { cast: { character: { id: "vera", version: 1 } }, folderId: "main" });
  const nuit = scene("n1", "N", "Nuit", 1, 90, { cast: { character: { id: "nuit", version: 1 } } });
  expect(filterScenes([vera, nuit], { character: "vera" }).map((s) => s.id)).toEqual(["v1"]);
  expect(filterScenes([vera, nuit], { folder: "main" }).map((s) => s.id)).toEqual(["v1"]);
  expect(filterScenes([vera, nuit], { smart: "longest" }).map((s) => s.id)).toEqual(["n1", "v1"]);
  expect(filterScenes([vera, nuit], {}).map((s) => s.id)).toEqual(["v1", "n1"]);
});

test("sortScenes: recent, A-Z, and messages", () => {
  expect(sortScenes(all, "recent").map((s) => s.id)).toEqual(["a", "b", "c"]);
  expect(sortScenes(all, "az").map((s) => s.title)).toEqual(["Cut the deck", "Heist", "The long storm"]);
  expect(sortScenes(all, "messages").map((s) => s.id)).toEqual(["c", "a", "b"]);
});

test("takePips: caps at 5 dots, then an overflow count", () => {
  expect(takePips(1)).toEqual({ pips: 1, overflow: 0 });
  expect(takePips(5)).toEqual({ pips: 5, overflow: 0 });
  expect(takePips(8)).toEqual({ pips: 5, overflow: 3 });
});

test("folderTint: stable per id, drawn from the deck palette", () => {
  const t1 = folderTint("mainplot");
  expect(folderTint("mainplot")).toBe(t1);
  expect(t1).toMatch(/^var\(--deck-(character|lorebook|persona|pack|preset|regex)\)$/);
  // six buckets, so distinct ids are not guaranteed distinct tints - but the spread across a
  // handful of ids must use more than one bucket, or the "hash" is really a constant.
  const tints = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(folderTint));
  expect(tints.size).toBeGreaterThan(1);
});
