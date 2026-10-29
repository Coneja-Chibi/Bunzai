/**
 * The Carousel's sections and drawn order. These decide what shift-click ranges over and what
 * Select all stages, so a wrong order here stages pieces nobody pointed at.
 */
import { describe, expect, test } from "bun:test";
import { cardFacts, carouselSections, promptFormatWords, drawnPieces, importedAgo, orderPieces, roman, sectionView, tokenLabel, withSectionView } from "./carousel-core";

const piece = (kind: string, id: string, importedAt?: string) => ({
  kind,
  id,
  name: id,
  ...(importedAt ? { importedAt } : {}),
});

const counts = [
  { kind: "character", count: 2 },
  { kind: "lorebook", count: 0 },
  { kind: "preset", count: 3 },
];

describe("carouselSections", () => {
  test("one section per deck that holds anything, in rail order, numbered without gaps", () => {
    const sections = carouselSections({
      pieces: [piece("preset", "p1"), piece("character", "c1"), piece("character", "c2"), piece("preset", "p2")],
      counts,
      order: "all",
      lastOpened: {},
    });

    // The empty lorebook deck gets no heading, and the preset section is II, not III.
    expect(sections.map((s) => [s.deck.kind, s.numeral])).toEqual([["character", "I"], ["preset", "II"]]);
    expect(sections[1]?.pieces.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(sections[1]?.total).toBe(3);
  });

  test("the deck chosen at setup comes first, and the numbering follows the drawn order", () => {
    const sections = carouselSections({
      pieces: [piece("character", "c1"), piece("preset", "p1")],
      counts,
      order: "all",
      lastOpened: {},
      first: "preset",
    });

    expect(sections.map((s) => [s.deck.kind, s.numeral])).toEqual([["preset", "I"], ["character", "II"]]);
  });

  test("a deck with no match during a search is left out, and keeps its studio total when shown", () => {
    const sections = carouselSections({ pieces: [piece("preset", "p2")], counts, order: "all", lastOpened: {} });

    expect(sections.map((s) => s.deck.kind)).toEqual(["preset"]);
    expect(sections[0]?.numeral).toBe("I");
    expect(sections[0]?.total).toBe(3);
  });

  test("a kind the rail does not know still gets its section rather than vanishing", () => {
    const sections = carouselSections({
      pieces: [piece("widget", "w1")],
      counts: [...counts, { kind: "widget", count: 1 }],
      order: "all",
      lastOpened: {},
    });

    expect(sections.map((s) => s.deck.plural)).toEqual(["Widgets"]);
  });
});

describe("orderPieces", () => {
  test("Recent is newest first by the later of imported and last opened", () => {
    const pieces = [
      piece("preset", "old", "2026-01-01T00:00:00Z"),
      piece("preset", "new", "2026-09-01T00:00:00Z"),
      piece("preset", "opened", "2025-01-01T00:00:00Z"),
    ];
    const lastOpened = { "preset:opened": Date.parse("2026-09-20T00:00:00Z") };

    expect(orderPieces(pieces, "recent", lastOpened).map((p) => p.id)).toEqual(["opened", "new", "old"]);
  });

  test("All keeps the order it was given (search rank or studio order)", () => {
    const pieces = [piece("preset", "b", "2026-09-01T00:00:00Z"), piece("preset", "a", "2026-01-01T00:00:00Z")];
    expect(orderPieces(pieces, "all", {}).map((p) => p.id)).toEqual(["b", "a"]);
  });

  test("Recent never drops a piece, even one open on the Workbench", () => {
    // The Workbench recents rail hides open pieces because they are already tabs. A shelf that did
    // the same would read as work gone missing.
    const pieces = [piece("preset", "a"), piece("preset", "b")];
    expect(orderPieces(pieces, "recent", {})).toHaveLength(2);
  });
});

describe("drawnPieces", () => {
  test("is every section end to end, so a shift range crosses decks the way the eye does", () => {
    const sections = carouselSections({
      pieces: [piece("preset", "p1"), piece("character", "c1")],
      counts,
      order: "all",
      lastOpened: {},
    });
    expect(drawnPieces(sections).map((p) => p.id)).toEqual(["c1", "p1"]);
  });
});

test("roman numerals", () => {
  expect([1, 2, 3, 4, 7, 9, 14].map(roman)).toEqual(["I", "II", "III", "IV", "VII", "IX", "XIV"]);
});

describe("importedAgo", () => {
  const now = Date.parse("2026-09-24T12:00:00Z");
  test("says imported, in whole units, singular where it should be", () => {
    expect(importedAgo("2026-09-24T11:59:40Z", now)).toBe("Imported just now");
    expect(importedAgo("2026-09-24T11:00:00Z", now)).toBe("Imported 1 hour ago");
    expect(importedAgo("2026-09-21T12:00:00Z", now)).toBe("Imported 3 days ago");
    expect(importedAgo("2026-09-03T12:00:00Z", now)).toBe("Imported 3 weeks ago");
    expect(importedAgo("2025-06-01T12:00:00Z", now)).toBe("Imported 1 year ago");
  });
  test("an absent or unreadable stamp says nothing rather than a wrong date", () => {
    expect(importedAgo(undefined, now)).toBeNull();
    expect(importedAgo("not a date", now)).toBeNull();
  });
});

describe("cardFacts", () => {
  const meta = {
    lore: { harbor: { enabled: false, entryCount: 213 } },
    regex: { tidy: { enabled: true, ruleCount: 1, enabledRuleCount: 1, doesWhat: "Trims stray asterisks." } },
    persona: { wren: { pronouns: "she/her", sectionCount: 2, brief: "A night keeper." } },
  };

  test("lorebooks carry their entry count and off switch", () => {
    const facts = cardFacts({ kind: "lorebook", id: "harbor", name: "Harbor" }, meta);
    expect(facts.pill).toBe("213 entries");
    expect(facts.off).toBe(true);
  });

  test("regex sets carry rule counts and their one-liner", () => {
    const facts = cardFacts({ kind: "regex", id: "tidy", name: "Tidy" }, meta);
    expect(facts.pill).toBe("1 rule");
    expect(facts.stats).toEqual([{ label: "Rules", value: "1" }, { label: "On", value: "1" }]);
    expect(facts.words).toBe("Trims stray asterisks.");
  });

  test("personas carry pronouns and their brief", () => {
    const facts = cardFacts({ kind: "persona", id: "wren", name: "Wren" }, meta);
    expect(facts.stats[0]).toEqual({ label: "Pronouns", value: "she/her" });
    expect(facts.words).toBe("A night keeper.");
  });

  test("a piece the shelves have not described yet states nothing", () => {
    expect(cardFacts({ kind: "lorebook", id: "unknown", name: "U" }, meta)).toEqual({ stats: [], off: false });
  });
});

test("token labels", () => {
  expect([812, 3400, 92_600, 1_250_000].map(tokenLabel)).toEqual(["812", "3.4K", "92.6K", "1.3M"]);
});

describe("sectionView", () => {
  test("each deck keeps its own view", () => {
    const stored = { lorebook: "shelf", character: "showcase" };
    expect(sectionView(stored, "lorebook", ["grid", "shelf"])).toBe("shelf");
    expect(sectionView(stored, "character", ["grid", "showcase"])).toBe("showcase");
  });

  test("a deck with no choice, or a choice it does not offer, shows the cards", () => {
    // The regex Sets view stored for lorebooks must never draw: it would render another deck's shelf.
    expect(sectionView({ lorebook: "regex-shelf" }, "lorebook", ["grid", "shelf"])).toBe("cards");
    expect(sectionView({}, "preset", ["grid"])).toBe("cards");
    expect(sectionView("grid", "preset", ["grid"])).toBe("cards");
    expect(sectionView(null, "preset", ["grid"])).toBe("cards");
  });

  test("changing one deck keeps the others and drops junk", () => {
    expect(withSectionView({ lorebook: "shelf", bad: 3 }, "preset", "list")).toEqual({ lorebook: "shelf", preset: "list" });
    expect(withSectionView(undefined, "preset", "list")).toEqual({ preset: "list" });
  });
});

describe("promptFormatWords", () => {
  test("says what the format holds and that nothing applies it yet, with no dash", () => {
    expect(promptFormatWords(["instruct", "context"])).toBe("Instruct and context. Used by text-completion connections, which Bunzai does not have yet.");
    expect(promptFormatWords(["context"])).toStartWith("Context. Used by");
    expect(promptFormatWords(undefined)).toBe("Used by text-completion connections, which Bunzai does not have yet.");
    expect(promptFormatWords(["instruct"])).not.toMatch(/\u2014/);
  });
});
