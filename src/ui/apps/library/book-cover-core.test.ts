/** Cover preferences accept only installed layers and keep imported content outside their boundary. */
import { describe, expect, test } from "bun:test";
import { coverBackgrounds, coverDesigns, parseBookCover, readBookCover, saveBookCover, COVER_PREF } from "./book-cover-core";

describe("book cover preferences", () => {
  test("rejects unknown layers and malformed preferences", () => {
    for (const value of [null, "cover", {}, { design: "../../outside", background: "ruby" }]) expect(parseBookCover(value)).toBeNull();
  });
  test("saves and clears a validated choice without losing other books", () => {
    const design = coverDesigns[0], background = coverBackgrounds[0];
    expect(design).toBeDefined();
    expect(background).toBeDefined();
    if (!design || !background) return;
    const values = new Map<string, unknown>();
    const prefs = { get: (key: string) => values.get(key), set: (key: string, value: unknown) => { values.set(key, value); } };
    const choice = { design: design.slug, background: background.slug, title: "The Paper Moon" };
    saveBookCover(prefs, "one", choice);
    saveBookCover(prefs, "two", choice);
    expect(readBookCover(prefs, "one")).toEqual(choice);
    saveBookCover(prefs, "one", null);
    expect(readBookCover(prefs, "one")).toBeNull();
    expect(readBookCover(prefs, "two")).toEqual(choice);
    expect(values.size).toBe(1);
    expect(values.has(COVER_PREF)).toBe(true);
  });
});
