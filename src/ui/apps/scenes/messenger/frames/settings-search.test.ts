/** The settings search filter: what a section is found by, how hits are ordered, and that an empty box finds nothing. */
import { describe, expect, test } from "bun:test";
import { searchSettings } from "./settings-search";
import type { SettingsScope } from "./settings-window";

const scope = {
  id: "scene", title: "Scene",
  categories: [
    { id: "writing", label: "Writing", icon: "lucide:pen-line", sections: [
      { id: "samplers", title: "Samplers", description: "The numbers that shape each reply.", keywords: ["temperature", "top p"], body: null },
      { id: "note", title: "Scene note", description: "Guidance that rides along.", body: null },
    ] },
    { id: "memory", label: "Memory", icon: "lucide:history", sections: [
      { id: "summary", title: "Summary", description: "What the story remembers.", keywords: ["scene recap"], body: null },
    ] },
  ],
} as unknown as SettingsScope;
const ids = (q: string): string[] => searchSettings(scope, q).map((h) => h.sectionId);

describe("searchSettings", () => {
  test("an empty or blank box finds nothing", () => {
    expect(ids("")).toEqual([]);
    expect(ids("   ")).toEqual([]);
  });

  test("finds a section by title, description, keyword or category, ignoring case", () => {
    expect(ids("SAMPLERS")).toEqual(["samplers"]);
    expect(ids("shape each")).toEqual(["samplers"]);
    expect(ids("temperature")).toEqual(["samplers"]);
    expect(ids("memory")).toEqual(["summary"]);
  });

  test("every typed word has to match somewhere in the section", () => {
    expect(ids("top temperature")).toEqual(["samplers"]);
    expect(ids("top zebra")).toEqual([]);
  });

  test("title matches come before keyword matches, then the nav order", () => {
    expect(ids("scene")).toEqual(["note", "summary"]);
  });

  test("a hit names its category and section for the result row", () => {
    expect(searchSettings(scope, "recap")).toEqual([{ categoryId: "memory", categoryLabel: "Memory", sectionId: "summary", sectionTitle: "Summary" }]);
  });
});
