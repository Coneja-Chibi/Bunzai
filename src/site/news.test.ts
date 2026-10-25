/** What's new wording: commit prefixes come off, plumbing commits stay hidden. */
import { describe, expect, test } from "bun:test";
import { newsHeadline, plainSubject, visibleChanges } from "./news";

const release = (subjects: string[], headline = "") => ({
  version: "v0.1.41", name: "Bunraku v0.1.41", date: "", url: "", headline,
  commits: subjects.map((subject, i) => ({ hash: `abcdef${i}`, subject })),
});

describe("plainSubject", () => {
  test("drops the conventional prefix and capitalizes", () => {
    expect(plainSubject("fix(kit): reads sized for real presets")).toBe("Reads sized for real presets");
    expect(plainSubject("feat!: big change")).toBe("Big change");
    expect(plainSubject("just words")).toBe("Just words");
  });
});

describe("visibleChanges", () => {
  test("hides release bumps, merges, and chores", () => {
    const shown = visibleChanges(release(["release: v0.1.41", "Merge branch x", "chore: tidy", "feat(studio): the block graveyard"]).commits);
    expect(shown).toEqual(["The block graveyard"]);
  });
});

describe("newsHeadline", () => {
  test("the first visible change, else the headline, else the version", () => {
    expect(newsHeadline(release(["chore: a", "feat: presets arrive"]))).toBe("Presets arrive");
    expect(newsHeadline(release(["chore: a"], "chore: a"))).toBe("A");
    expect(newsHeadline(release([]))).toBe("v0.1.41");
  });
});
