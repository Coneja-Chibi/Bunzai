/**
 * The Storyboards dossiers (RoleCall lib/compendium/dossiers/*): what each reads from the book's entries, the order it sorts them in, the stats it
 * counts and the digest the narrator gets, line for line. Entries are hand-made so every expectation is derived from RoleCall's code, not from the output.
 */
import { describe, expect, test } from "bun:test";
import type { Rec } from "../../guards";
import { readBook } from "../read";
import type { EntryType } from "../types";
import { typedEntry } from "../fixture-book";
import { DEFAULT_PROFILE, buildDossier, lineLimit, normalizeProfile, profileLabel, slug, storyboardsText, type ContextProfile } from "./index";

const book = (...entries: [string, EntryType, Rec, Rec?][]) => readBook(entries.map(([title, type, data, meta]) => typedEntry(title.toLowerCase().replace(/\W+/g, "-"), title, type, data, meta)));
const profile = (mode: ContextProfile["mode"], radius = 8): ContextProfile => ({ mode, radius });

describe("the context profile", () => {
  test("an unknown mode is Focused, the radius is 1 to 30 (8 for Radius, else 5), and lines are limited per mode", () => {
    expect(normalizeProfile(undefined)).toEqual({ mode: "focused", radius: 5 });
    expect(normalizeProfile({ mode: "radius" })).toEqual({ mode: "radius", radius: 8 });
    expect(normalizeProfile({ mode: "weird", radius: 99 })).toEqual({ mode: "focused", radius: 30 });
    expect(normalizeProfile({ mode: "full", radius: 0 }).radius).toBe(1);
    expect([lineLimit(profile("compact"), 8), lineLimit(profile("compact"), 2), lineLimit(profile("focused"), 8), lineLimit(profile("radius", 12), 8), lineLimit(profile("full"), 8)]).toEqual([3, 2, 8, 12, 999]);
    expect(profileLabel("radius")).toBe("Radius");
  });

  test("a slug is lower-case words joined by hyphens, accents folded, and never empty", () => {
    expect([slug("The Missing Lantern!"), slug("Mira Vance"), slug("Café"), slug("***")]).toEqual(["the-missing-lantern", "mira-vance", "cafe", "untitled"]);
  });
});

describe("Quest Board", () => {
  const entries = book(
    ["The Missing Lantern", "plot", { status: "active", type: "main", description: "Find it.", tagline: "Three clues left.", objectives: [{ description: "Search the docks", status: "done" }, { description: "Ask Dov", status: "open" }, "Break into the vault"], central_characters: ["Mira Vance"], deadline: "Midwinter" }],
    ["Old Debts", "plot", { status: "blocked", urgency: 60, central_characters: ["Dov Ketter", "Mira Vance"] }],
    ["The Quiet Season", "plot", { status: "resolved", reward_pending: true }],
    ["The Salt War", "plot", { status: "failed" }],
    ["Side Errand", "plot", { status: "active" }],
    ["Mira Vance", "character", { name: "Mira Vance" }],
  );

  test("sorts plots by urgency and files them as critical, active, blocked, completed and failed", () => {
    const q = buildDossier("quests", entries, DEFAULT_PROFILE);
    if (q.type !== "quests") throw new Error("type");
    expect(q.critical.map((x) => x.name)).toEqual(["The Missing Lantern"]);
    expect(q.active.map((x) => x.name)).toEqual(["The Missing Lantern", "Side Errand"]);
    expect(q.blocked.map((x) => x.name)).toEqual(["Old Debts"]);
    expect(q.completed.map((x) => x.name)).toEqual(["The Quiet Season"]);
    expect(q.failed.map((x) => x.name)).toEqual(["The Salt War"]);
  });

  test("urgency is explicit when given, else 30 plus 25 for a deadline and 20 for a main quest; progress counts the objectives done", () => {
    const q = buildDossier("quests", entries, DEFAULT_PROFILE);
    if (q.type !== "quests") throw new Error("type");
    const lantern = q.critical[0]!;
    expect(lantern.urgency).toBe(75);
    expect(lantern.progress).toBe("1 / 3");
    expect(lantern.objectives.map((o) => [o.slug, o.status])).toEqual([["search-the-docks", "done"], ["ask-dov", "open"], ["break-into-the-vault", "open"]]);
    expect(q.blocked[0]!.urgency).toBe(60);
    expect(q.completed[0]!.urgency).toBe(5);
  });

  test("the stats are RoleCall's: active includes critical, imminent is urgency 70 or more among live quests, pressure is the live mean", () => {
    const q = buildDossier("quests", entries, DEFAULT_PROFILE);
    if (q.type !== "quests") throw new Error("type");
    expect(q.stats).toEqual({ active: 3, blocked: 1, imminentDeadlines: 1, linkedCharacters: 2, failurePressure: Math.round((75 + 30 + 60) / 3), rewardBacklog: 1 });
  });

  test("the digest is RoleCall's, with no line about tool calls", () => {
    const q = buildDossier("quests", entries, DEFAULT_PROFILE);
    expect(q.ai.text).toBe([
      "[QUEST BOARD]", "[CRITICAL]", "- {the-missing-lantern} The Missing Lantern: 1 / 3; deadline Midwinter.", "  objectives: {ask-dov}=open, {break-into-the-vault}=open",
      "[ACTIVE]", "- {the-missing-lantern} The Missing Lantern: Three clues left..", "  objectives: {ask-dov}=open, {break-into-the-vault}=open", "- {side-errand} Side Errand: active.",
      "[BLOCKED]", "- {old-debts} Old Debts: blocked; linked Dov Ketter, Mira Vance.",
      "[USE]", "- Keep active goals alive in narration without resolving them for the user.", "- Let missed deadlines and failures create visible consequences.",
    ].join("\n"));
    expect(q.ai.text).not.toContain("tool calls");
    expect(q.ai.tokens).toBe(Math.ceil(q.ai.text.length / 4));
  });

  test("Compact leaves out objectives and the blocked list; Full and Radius add the failures", () => {
    const compact = buildDossier("quests", entries, profile("compact")).ai.text;
    expect(compact).not.toContain("[BLOCKED]");
    expect(compact).not.toContain("objectives:  ");
    expect(compact).not.toContain("[FAILURES]");
    expect(buildDossier("quests", entries, profile("full")).ai.text).toContain("[FAILURES]\n- {the-salt-war} The Salt War: failed.");
    expect(buildDossier("quests", entries, profile("radius", 8)).ai.text).toContain("[FAILURES]");
  });

  test("a retired plot is the person's removal: it is neither listed nor sent", () => {
    const retired = readBook([typedEntry("p1", "Gone", "plot", { status: "active" }, { retired: { at: 1 } })]);
    const q = buildDossier("quests", retired, DEFAULT_PROFILE);
    if (q.type !== "quests") throw new Error("type");
    expect(q.critical.length + q.active.length).toBe(0);
  });
});

describe("Cast", () => {
  const entries = book(
    ["Mira Vance", "character", { name: "Mira Vance", role: "Lamplighter", affinity: 80, trust: 60, currentEmotion: "wary", emotionIntensity: 40, scenePresence: { isPresent: true }, dynamics: { loyalty: 90, "old-grudge": 20 }, memories: ["The night the light went out", { text: "Dov lied", impact: "negative", weight: 9 }], relationships: [{ with: "Dov Ketter", nature: "ally" }, { with: "Sela Brandt", nature: "rival" }], currentThoughts: "Where is it?" }],
    ["Dov Ketter", "character", { name: "Dov Ketter", category: "friend", affinity: 20, relationships: [{ with: "Mira Vance", nature: "ally" }] }],
    ["Sela Brandt", "character", { name: "Sela Brandt", category: "enemy" }],
    ["Nobody", "character", { name: "Nobody", category: "unknown", affinity: 5 }],
  );

  test("builds a case file per character with meters, memories, relationships and scene presence, the people in the scene first", () => {
    const c = buildDossier("cast", entries, DEFAULT_PROFILE);
    if (c.type !== "cast") throw new Error("type");
    expect(c.cast.map((m) => m.name)[0]).toBe("Mira Vance");
    const mira = c.cast[0]!;
    expect(mira.inScene).toBe(true);
    expect(mira.metrics.map((m) => [m.label, m.value])).toEqual([["Affinity", 80], ["Trust", 60], ["Loyalty", 90], ["Old Grudge", 20]]);
    expect(mira.memories.map((m) => [m.text, m.impact, m.weight])).toEqual([["The night the light went out", "unknown", 8], ["Dov lied", "negative", 9]]);
    expect(mira.relationships.map((r) => [r.target, r.nature])).toEqual([["Dov Ketter", "ally"], ["Sela Brandt", "rival"]]);
    expect(mira.hiddenState).toBe(1);
  });

  test("the stats are RoleCall's: hostile is an enemy or an affinity of 25 or less unless unknown; drift is 2 per low meter unless unknown", () => {
    const c = buildDossier("cast", entries, DEFAULT_PROFILE);
    if (c.type !== "cast") throw new Error("type");
    expect(c.stats).toEqual({ totalCast: 4, activeCast: 1, offstageCast: 3, highAffinity: 1, hostile: 2, hiddenState: 1, pinnedMemories: 2, drift: 2 });
  });

  test("the digest names who is in the scene with their meters and first memory, then the relationship edges, and carries RoleCall's two rules", () => {
    const c = buildDossier("cast", entries, DEFAULT_PROFILE);
    expect(c.ai.text).toBe([
      "[CAST]", "- {mira-vance} Mira Vance: affinity 80; trust 60; emotion wary 40.", "  Memory {the-night-the-light-went-out}: The night the light went out",
      "[RELATIONSHIPS]", "- Mira Vance -> Dov Ketter (ally).", "- Mira Vance -> Sela Brandt (rival).", "- Dov Ketter -> Mira Vance (ally).",
      "[USE]", "- Keep NPC emotions, affinity, trust, and recent memories consistent.", "- Do not expose private thoughts or hidden knowledge unless a dedicated visibility rule allows it.",
    ].join("\n"));
  });

  test("with nobody in the scene the first of the cast is named, and Compact drops memories and edges", () => {
    const quiet = book(["A", "character", { name: "A", affinity: 50 }], ["B", "character", { name: "B", relationships: [{ with: "A", nature: "friend" }] }]);
    const text = buildDossier("cast", quiet, profile("compact")).ai.text;
    expect(text).toBe(["[CAST]", "- {a} A: affinity 50.", "- {b} B.", "[USE]", "- Keep NPC emotions, affinity, trust, and recent memories consistent.", "- Do not expose private thoughts or hidden knowledge unless a dedicated visibility rule allows it."].join("\n"));
  });
});

describe("Map and Renown", () => {
  const places = book(
    ["Harbor City", "location", { name: "Harbor City", type: "city", description: "Salt and lamps.", region: "The Coast", dangerLevel: "low", visited: true }],
    ["Dock Ward", "location", { name: "Dock Ward", dangerLevel: "high", region: "The Coast" }],
    ["Old Mine", "location", { name: "Old Mine", dangerLevel: "extreme" }],
  );

  test("Map lists locations by name, counts visited, dangerous and regions, and sends visited places first", () => {
    const m = buildDossier("map", places, DEFAULT_PROFILE);
    if (m.type !== "map") throw new Error("type");
    expect(m.locations.map((l) => l.name)).toEqual(["Dock Ward", "Harbor City", "Old Mine"]);
    expect(m.stats).toEqual({ knownLocations: 3, visitedLocations: 1, dangerousLocations: 2, regions: 1 });
    expect(m.ai.text).toBe([
      "[MAP]", "[LOCATIONS]", "- {harbor-city} Harbor City: city; region The Coast; danger low. Salt and lamps.", "- {dock-ward} Dock Ward: location; region The Coast; danger high.", "- {old-mine} Old Mine: location; danger extreme.",
      "[USE]", "- Keep travel, distance, danger, and current location consistent.",
    ].join("\n"));
  });

  const orgs = book(
    ["Lantern Guild", "organization", { name: "Lantern Guild", reputation: 45, heat: 10, region: "The Coast", favorsBanked: 2, favorsOwed: 1 }],
    ["Salt Court", "organization", { name: "Salt Court", reputation: -50, heatScore: 80, heatLabel: "hunting you" }],
    ["Quiet Order", "organization", { name: "Quiet Order" }],
  );

  test("Renown rates each organization, hottest first, and the digest says admired, wanted, distrusted or neutral", () => {
    const r = buildDossier("renown", orgs, DEFAULT_PROFILE);
    if (r.type !== "renown") throw new Error("type");
    expect(r.standings.map((s) => s.name)).toEqual(["Salt Court", "Lantern Guild", "Quiet Order"]);
    expect(r.stats).toEqual({ standings: 3, hotStandings: 1, wantedStandings: 1, favorsBanked: 2, favorsOwed: 1, regions: 1 });
    expect(r.ai.text).toBe([
      "[RENOWN]", "- {salt-court} Salt Court: wanted; rep -50; heat 80; hunting you.", "- {lantern-guild} Lantern Guild: admired; rep 45; heat 10; region The Coast.", "- {quiet-order} Quiet Order: neutral; rep 0; heat 0.",
      "[OBLIGATIONS]", "- {lantern-guild} banked 2; owed 1.",
      "[USE]", "- NPC reactions should reflect local standing and heat, not generic friendliness.", "- High heat should create scrutiny, blocked access, or ambush risk.", "- Favors and debts should resurface naturally without forcing the scene.",
    ].join("\n"));
  });
});

describe("the narrator's block", () => {
  const entries = book(["Side Errand", "plot", { status: "active" }], ["Mira", "character", { name: "Mira" }]);
  const sources = [{ name: "The Book", entries }];

  test("is RoleCall's header and one section per book and dossier asked for, headed with the profile's name", () => {
    const text = storyboardsText(sources, [{ type: "quests", profile: normalizeProfile({}) }, { type: "cast", profile: normalizeProfile({ mode: "compact" }) }]);
    const lines = text.split("\n");
    expect(lines.slice(0, 2)).toEqual(["[COMPENDIUM STORYBOARDS CONTEXT]", "Live compendium/storyboard context selected by the Storyboards settings. Slugs in {braces} are stable handles for the things named."]);
    expect(text).toContain("\n\n--- The Book / Quest Board / Focused ---\n[QUEST BOARD]");
    expect(text).toContain("\n\n--- The Book / Cast / Compact ---\n[CAST]");
  });

  test("a dossier with nothing in it sends nothing, and no request sends no block", () => {
    expect(storyboardsText(sources, [{ type: "map", profile: DEFAULT_PROFILE }, { type: "renown", profile: DEFAULT_PROFILE }])).toBe("");
    expect(storyboardsText(sources, [])).toBe("");
    expect(storyboardsText([], [{ type: "quests", profile: DEFAULT_PROFILE }])).toBe("");
  });
});
