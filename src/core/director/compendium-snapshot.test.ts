/** The planner's Compendium snapshot: scene-first character choice, the caps, tensions, and what is left out. */
import { describe, expect, test } from "bun:test";
import { typedEntry } from "../compendium/fixture-book";
import { SNAPSHOT_CHARACTERS, SNAPSHOT_LOCATIONS, SNAPSHOT_TENSIONS, buildCompendiumContext } from "./compendium-snapshot";

const person = (name: string, data: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) => typedEntry(`c-${name}`, name, "character", { name, ...data }, meta);
const place = (name: string, data: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) => typedEntry(`l-${name}`, name, "location", { name, ...data }, meta);
const hints = { recent: [] as string[], names: [] as string[] };

describe("the choice", () => {
  const many = Array.from({ length: 40 }, (_, i) => person(`Person ${String(i).padStart(2, "0")}`));

  test("characters are capped at 15 and locations at 5; with nothing in the scene the person's featured entries come first, then book order", () => {
    const entries = [...many, person("Zed Featured", {}, { featured: true }), ...Array.from({ length: 9 }, (_, i) => place(`Place ${i}`))];
    const text = buildCompendiumContext([{ entries }], hints);
    const chars = text.split("\n").filter((l) => l.startsWith("  - ") && l.includes("Person") || l.includes("Zed"));
    expect(chars).toHaveLength(SNAPSHOT_CHARACTERS);
    expect(text).toContain("  - Zed Featured");
    expect(text).toContain("  - Person 13");
    expect(text).not.toContain("Person 14");
    expect(text.split("Key Locations:")[1]!.split("\n").filter((l) => l.startsWith("  - "))).toHaveLength(SNAPSHOT_LOCATIONS);
  });

  test("characters named in the recent messages, by the card or the persona, or an alias, beat database order; so do the people they are related to", () => {
    const entries = [...many, person("Valen Ash", { aliases: ["the Ash"], relationships: [{ with: "Person 39", nature: "ally" }] }), person("Mira")];
    const text = buildCompendiumContext([{ entries }], { recent: ["Everyone watched the Ash cross the courtyard."], names: ["Mira"] });
    const lines = text.split("\n").filter((l) => l.startsWith("  - "));
    expect(lines.slice(0, 2).map((l) => l.slice(4, 13)).sort()).toEqual(["Mira", "Valen Ash"]);
    expect(lines[2]).toStartWith("  - Person 39");
    expect(text).toContain("Relationships: Person 39 (ally)");
    expect(text).not.toContain("Person 38");
  });

  test("locations the scene mentions, or where its characters are, come first", () => {
    const entries = [person("Mira", { current_state: { location: "The Pier", status: "wounded", condition: "limping" } }), place("Aaa Hall"), place("The Pier", { description: "Salt and rope." }), place("The Lamp Room")];
    const text = buildCompendiumContext([{ entries }], { recent: ["Mira went up to the lamp room."], names: [] });
    const after = text.split("Key Locations:")[1]!.split("\n").filter((l) => l.startsWith("  - ")).map((l) => l.slice(4));
    expect(after.slice(0, 2).sort()).toEqual(["The Lamp Room", "The Pier: Salt and rope."]);
    expect(text).toContain("Status: wounded. limping. At: The Pier");
  });
});

describe("what is left out and what is found", () => {
  test("retired, disabled and other-typed entries, and entries with no type, are not in it; nothing typed gives nothing", () => {
    const entries = [person("Kept"), person("Retired", {}, { retired: true }), { ...person("Off"), enabled: false }, typedEntry("i", "Sword", "item", { name: "Sword" }), { ...person("Classic"), metadata: {} }];
    const text = buildCompendiumContext([{ entries }], hints);
    expect(text).toContain("  - Kept");
    expect(["Retired", "Off", "Sword", "Classic"].some((n) => text.includes(n))).toBe(false);
    expect(buildCompendiumContext([{ entries: [typedEntry("i", "Sword", "item", {})] }], hints)).toBe("");
    expect(buildCompendiumContext([], hints)).toBe("");
  });

  test("tensions come from strained, rival and enemy relationships, at most five, with the notes; a relationships field that is not a list is ignored", () => {
    const entries = [
      ...Array.from({ length: 7 }, (_, i) => person(`P${i}`, { relationships: [{ with: "X", nature: "rival", notes: i === 0 ? "old grudge" : undefined }] })),
      person("Calm", { relationships: [{ with: "Y", nature: "friend", status: "active" }] }), person("Odd", { relationships: "various" }),
      person("Strained", { relationships: [{ with: "Z", nature: "kin", status: "strained" }] }),
    ];
    const text = buildCompendiumContext([{ entries }], hints);
    const tension = text.split("\n").filter((l) => l.startsWith("  Tension:"));
    expect(tension).toHaveLength(SNAPSHOT_TENSIONS);
    expect(tension[0]).toBe("  Tension: P0 / X: rival relationship (active): old grudge");
    expect(text).toContain("Relationships: Z (kin, strained)");
    expect(text).not.toContain("various");
  });

  test("the text is plain: no emoji and no em dash", () => {
    const text = buildCompendiumContext([{ entries: [person("A", { relationships: [{ with: "B", nature: "enemy" }] })] }], hints);
    expect(/[\u2014\u26A1\u2194]/.test(text)).toBe(false);
  });
});
