/** TrackHare's pure rules: grouping, sorting, reason badges, Chains grouping, the badge count, and
 * the button's saved place. */
import { describe, expect, test } from "bun:test";
import type { SceneTrace, TraceLoreHit } from "../../../../app-contract-scenes";
import {
  badgeCount, bookGroups, chainGroups, clampButtonRect, DEFAULT_BUTTON_RECT,
  parseButtonRect, parseDensity, parseSort, reasonBadge, rollBadge, sortHits,
} from "./hare-core";

const hit = (over: Partial<TraceLoreHit> = {}): TraceLoreHit => ({
  bookId: "b1", entryId: "e1", bookName: "Keeper's Log", title: "The lighthouse", reason: "constant",
  matched: [], tokens: 10, place: "World", loop: 0, ...over,
});

describe("bookGroups", () => {
  test("groups by book, each book in first-seen (placement) order", () => {
    const hits = [hit({ title: "a", bookName: "Book A" }), hit({ title: "b", bookName: "Book B" }), hit({ title: "c", bookName: "Book A" })];
    const groups = bookGroups(hits);
    expect(groups.map((g) => g.bookName)).toEqual(["Book A", "Book B"]);
    expect(groups[0]!.hits.map((h) => h.title)).toEqual(["a", "c"]);
    expect(groups[1]!.hits.map((h) => h.title)).toEqual(["b"]);
  });

  test("empty input is an empty list", () => {
    expect(bookGroups([])).toEqual([]);
  });
});

describe("sortHits", () => {
  const hits = [hit({ title: "Zed", tokens: 5 }), hit({ title: "Amy", tokens: 50 }), hit({ title: "Mox", tokens: 20 })];

  test("placement keeps the trace's own order", () => {
    expect(sortHits(hits, "placement").map((h) => h.title)).toEqual(["Zed", "Amy", "Mox"]);
  });

  test("A to Z sorts by title", () => {
    expect(sortHits(hits, "az").map((h) => h.title)).toEqual(["Amy", "Mox", "Zed"]);
  });

  test("size sorts by tokens, largest first", () => {
    expect(sortHits(hits, "size").map((h) => h.title)).toEqual(["Amy", "Mox", "Zed"]);
  });

  test("never mutates the input array", () => {
    const before = [...hits];
    sortHits(hits, "az");
    expect(hits).toEqual(before);
  });
});

describe("reasonBadge", () => {
  test("constant: pin, --stage-macro, ALWAYS ON", () => {
    expect(reasonBadge(hit({ reason: "constant" }), [])).toEqual({ icon: "lucide:pin", tone: "var(--stage-macro)", text: "ALWAYS ON" });
  });

  test("key and secondary: key icon, --stage-ok, the matched word", () => {
    expect(reasonBadge(hit({ reason: "key", matched: ["storm"] }), [])).toEqual({ icon: "lucide:key", tone: "var(--stage-ok)", text: 'KEY: "storm"' });
    expect(reasonBadge(hit({ reason: "secondary", matched: ["tide"] }), [])).toEqual({ icon: "lucide:key", tone: "var(--stage-ok)", text: 'KEY: "tide"' });
  });

  test("recursion: link icon, --deck-lorebook, names who woke it and the loop from `chains`", () => {
    const chains = [{ from: "The storm of '09", to: "The lantern", keyword: "lantern" }];
    expect(reasonBadge(hit({ title: "The lantern", reason: "recursion", loop: 1 }), chains))
      .toEqual({ icon: "lucide:link", tone: "var(--deck-lorebook)", text: "WOKEN BY: The storm of '09 (loop 1)" });
  });

  test("recursion with no matching chain still answers (defensive, never throws)", () => {
    expect(reasonBadge(hit({ title: "Orphan", reason: "recursion", loop: 2 }), []).text).toBe("WOKEN BY: another entry (loop 2)");
  });

  test("sticky: clock icon, --stage-danger-text, plain STICKY without a stickyLeft (an old trace)", () => {
    expect(reasonBadge(hit({ reason: "sticky" }), [])).toEqual({ icon: "lucide:clock", tone: "var(--stage-danger-text)", text: "STICKY" });
  });

  test("sticky: STICKY: N turns left when stickyLeft is present, singular for 1", () => {
    expect(reasonBadge(hit({ reason: "sticky", stickyLeft: 2 }), []).text).toBe("STICKY: 2 turns left");
    expect(reasonBadge(hit({ reason: "sticky", stickyLeft: 1 }), []).text).toBe("STICKY: 1 turn left");
    expect(reasonBadge(hit({ reason: "sticky", stickyLeft: 0 }), []).text).toBe("STICKY: 0 turns left");
  });

  test("special and emotion: key icon, --stage-var", () => {
    expect(reasonBadge(hit({ reason: "special", matched: ["dread"] }), [])).toEqual({ icon: "lucide:key", tone: "var(--stage-var)", text: 'KEY: "dread"' });
    expect(reasonBadge(hit({ reason: "emotion" }), []).tone).toBe("var(--stage-var)");
  });
});

describe("rollBadge", () => {
  test("a roll adds its own badge in --stage-warn", () => {
    expect(rollBadge(hit({ roll: { rolled: 34, needed: 60 } }))).toEqual({ text: "CHANCE: rolled 34, needed 60", tone: "var(--stage-warn)" });
  });

  test("no roll: null", () => {
    expect(rollBadge(hit())).toBeNull();
  });
});

describe("badgeCount", () => {
  const trace = (lore: SceneTrace["lore"]): SceneTrace => ({
    reply: { messageId: "m1", swipeId: "s1", number: 1, model: "x", take: "Director's Cut" }, blocks: [], window: { context: 100, reply: 50, stated: true },
    trimmed: 0, lore, rawAvailable: true, replies: [],
  });

  test("counts injected only, never cut", () => {
    const lore: NonNullable<SceneTrace["lore"]> = { injected: [hit(), hit({ title: "b" })], cut: [hit({ title: "c" })], missed: [], chains: [], totalTokens: 20, share: 100, seed: 1 };
    expect(badgeCount(trace(lore))).toBe(2);
  });

  test("null lore or null trace: 0", () => {
    expect(badgeCount(trace(null))).toBe(0);
    expect(badgeCount(null)).toBe(0);
  });
});

describe("chainGroups", () => {
  const lore = (injected: TraceLoreHit[], chains: { from: string; to: string; keyword: string }[]): NonNullable<SceneTrace["lore"]> =>
    ({ injected, cut: [], missed: [], chains, totalTokens: 0, share: 0, seed: 1 });

  test("starters fired directly and woke others; ends were woken and woke nothing; links both; standalone neither", () => {
    const injected = [
      hit({ title: "The storm of '09", reason: "key", matched: ["storm"] }),
      hit({ title: "The lantern", reason: "recursion", loop: 1 }),
      hit({ title: "Her brother", reason: "sticky", loop: 2 }),
      hit({ title: "The lighthouse", reason: "constant" }),
    ];
    const chains = [
      { from: "The storm of '09", to: "The lantern", keyword: "lantern" },
      { from: "The lantern", to: "Her brother", keyword: "brother" },
    ];
    const groups = chainGroups(lore(injected, chains));
    expect(groups.starters.map((r) => r.title)).toEqual(["The storm of '09"]);
    expect(groups.links.map((r) => r.title)).toEqual(["The lantern"]);
    expect(groups.ends.map((r) => r.title)).toEqual(["Her brother"]);
    expect(groups.standalone.map((r) => r.title)).toEqual(["The lighthouse"]);
    expect(groups.starters[0]!.lines).toEqual(['woke The lantern with "lantern"']);
    expect(groups.links[0]!.lines).toEqual(["woken by The storm of '09 (loop 1)", 'woke Her brother with "brother"']);
    expect(groups.ends[0]!.lines).toEqual(["woken by The lantern (loop 2)"]);
  });

  test("a standalone row falls back to its own reason text when there is no chain line", () => {
    const groups = chainGroups(lore([hit({ title: "Solo", reason: "constant" })], []));
    expect(groups.standalone[0]!.lines).toEqual(["always on"]);
  });
});

describe("button place: parse, clamp, defaults", () => {
  test("parseButtonRect accepts a well-formed rect and rejects anything else, fail-closed", () => {
    expect(parseButtonRect({ x: 10, y: 20, size: 48 })).toEqual({ x: 10, y: 20, size: 48 });
    expect(parseButtonRect(null)).toBeNull();
    expect(parseButtonRect(undefined)).toBeNull();
    expect(parseButtonRect("garbage")).toBeNull();
    expect(parseButtonRect({ x: 10, y: 20 })).toBeNull();
    expect(parseButtonRect({ x: "10", y: 20, size: 48 })).toBeNull();
    expect(parseButtonRect({ x: NaN, y: 20, size: 48 })).toBeNull();
  });

  test("clampButtonRect clamps size to 40..96 and position inside the container", () => {
    expect(clampButtonRect({ x: 0, y: 0, size: 10 }, { width: 500, height: 500 }).size).toBe(40);
    expect(clampButtonRect({ x: 0, y: 0, size: 999 }, { width: 500, height: 500 }).size).toBe(96);
    expect(clampButtonRect({ x: 1000, y: 1000, size: 48 }, { width: 500, height: 400 })).toEqual({ x: 452, y: 352, size: 48 });
    expect(clampButtonRect({ x: -50, y: -50, size: 48 }, { width: 500, height: 400 })).toEqual({ x: 0, y: 0, size: 48 });
  });

  test("clampButtonRect skips position clamping against a 0x0 (unmeasured) container", () => {
    expect(clampButtonRect({ x: 999, y: 999, size: 48 }, { width: 0, height: 0 })).toEqual({ x: 999, y: 999, size: 48 });
  });

  test("DEFAULT_BUTTON_RECT matches the wireframe's stage position", () => {
    expect(DEFAULT_BUTTON_RECT).toEqual({ x: 96, y: 28, size: 48 });
  });
});

describe("pref parsing: fail-closed", () => {
  test("parseSort", () => {
    expect(parseSort("az")).toBe("az");
    expect(parseSort("size")).toBe("size");
    expect(parseSort("placement")).toBe("placement");
    expect(parseSort("garbage")).toBe("placement");
    expect(parseSort(undefined)).toBe("placement");
  });

  test("parseDensity", () => {
    expect(parseDensity("compact")).toBe("compact");
    expect(parseDensity("detailed")).toBe("detailed");
    expect(parseDensity("garbage")).toBe("detailed");
    expect(parseDensity(undefined)).toBe("detailed");
  });
});
