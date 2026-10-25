/**
 * The Compendium core over a 239-entry fixture book (fixture-book.ts): reading, the derived tree, the Dashboard's
 * aggregates, relationships and cross-references. Counts are hand-derived from the fixture, not from the code under test.
 */
import { describe, expect, test } from "bun:test";
import type { LorebookCategory, LorebookEntry } from "../../entities/lorebook/schema";
import { emptyLoreEntry } from "../lore/empty-book";
import { parseStructured, knownFields, REQUIRED_FIELDS, arcOf, buildCrossRefs, buildDashboard, buildRelationshipGraph, buildTree, linksOf, mirrorOf, alreadyMirrored, readBook, readEntry, shouldUseTyped, backlinksOf, ENTRY_TYPES, ENTRY_TYPE_INFO, type CompendiumEntry, type EntryType, type TreeNode } from "./index";
import { fixtureBook, FIXTURE_SIZE, typedEntry } from "./fixture-book";

const book = readBook(fixtureBook());
const byId = (id: string) => book.find((e) => e.id === id)!;
const child = (node: TreeNode, label: string) => node.children.find((c) => c.label === label)!;
const labels = (node: TreeNode) => node.children.map((c) => `${c.label}:${c.entryCount}`);

describe("reading entries", () => {
  test("the fixture really holds 239 entries", () => expect(book).toHaveLength(FIXTURE_SIZE));

  test("a typed entry reads its type, name, aliases, tagline, featured flag; a blank name falls to the title", () => {
    expect(byId("c-mira")).toMatchObject({ type: "character", name: "Mira Vance", aliases: ["The Lamplighter"], tagline: "Keeps the last lantern lit.", featured: true, retired: false, enabled: true });
    expect(byId("c-blank").name).toBe("Unnamed Guest");
    expect(byId("w-3").name).toBe("Concept 3"); // topic stands in for name, as RoleCall does
    expect(byId("c-ghost")).toMatchObject({ retired: true, enabled: false });
  });

  test("a classic entry, an unknown type and a malformed bag all read as classic, and structured data keeps its unknown fields", () => {
    expect(byId("classic-0")).toMatchObject({ type: null, data: {}, name: "Classic 0" });
    const odd = emptyLoreEntry("odd");
    for (const metadata of [{ entry_type: "dragon", structured_data: { name: "X" } }, { entry_type: 5 }, { structured_data: "no" }, undefined] as const) {
      expect(readEntry({ ...odd, metadata }, 0).type).toBeNull();
    }
    const data = { name: "Zed", x_custom: { deep: [1, 2, { keep: true }] }, tagline: 7 };
    const read = readEntry(typedEntry("z", "Zed", "item", data), 3);
    expect(read.data).toEqual(data);
    expect(read.tagline).toBe(""); // a non-text tagline is not text
    expect(read.order).toBe(3);
  });

  test("a summary reads its name from title, a concept from topic, and a blank name falls through", () => {
    expect(readEntry(typedEntry("s", "Fallback", "summary", { title: "Chapter One" }), 0).name).toBe("Chapter One");
    expect(readEntry(typedEntry("w", "Fallback", "worldbuilding", { name: " ", title: "", topic: "Tides" }), 0).name).toBe("Tides");
  });

  test("every type has a label, a bucket, a section and a theme token, and no token is a colour", () => {
    expect(ENTRY_TYPES).toHaveLength(11);
    for (const type of ENTRY_TYPES) {
      const info = ENTRY_TYPE_INFO[type];
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.token).toMatch(/^--[a-z-]+$/);
    }
    expect(new Set(ENTRY_TYPES.map((t) => ENTRY_TYPE_INFO[t].token)).size).toBe(11);
  });
});

describe("the derived tree", () => {
  const tree = buildTree(book, []);

  test("a mostly typed book uses the typed path: eleven buckets in RoleCall's order, then Unsorted, and every enabled entry once", () => {
    expect(shouldUseTyped(book)).toMatchObject({ use: true, typedCount: 227, totalEnabled: 233 });
    expect(tree.typed).toBe(true);
    expect(tree.root.entryCount).toBe(233);
    expect(labels(tree.root)).toEqual(["Cast:59", "Places:30", "Items:20", "Powers:10", "Organizations:12", "Events:20", "Plots:8", "Threats:12", "Worldbuilding:20", "Narrative:24", "Bestiary:12", "Unsorted:6"]);
    const ids: string[] = [];
    const walk = (n: TreeNode) => { ids.push(...n.entryIds); n.children.forEach(walk); };
    walk(tree.root);
    expect(ids).toHaveLength(233);
    expect(new Set(ids).size).toBe(233);
    expect(ids).not.toContain("off-0"); // switched off
    expect(ids).not.toContain("ret-0"); // retired
  });

  test("Cast groups by first affiliation, largest first, Unaffiliated last", () => {
    expect(labels(child(tree.root, "Cast"))).toEqual(["Lantern Guild:16", "Salt Court:16", "Ashen Wardens:14", "Unaffiliated:13"]);
  });

  test("Places nest by parent; a missing parent or a cycle still shows once; counts add up", () => {
    const places = child(tree.root, "Places");
    expect(labels(places).slice(0, 3)).toEqual(["The Realm:17", "Cycle A:2", "Lost Hamlet:1"]);
    expect(places.children).toHaveLength(13); // Realm, Cycle A, Lost Hamlet, ten top-level extras
    expect(places.children.reduce((n, c) => n + c.entryCount, 0)).toBe(30);
    const harbor = child(child(places, "The Realm"), "Harbor City");
    expect(harbor.entryCount).toBe(15);
    expect(labels(harbor).slice(0, 2)).toEqual(["Dock Ward:1", "Lamp Row:2"]); // only the top level is sorted, as in RoleCall
    expect(child(places, "Cycle A").children.map((c) => c.label)).toEqual(["Cycle B"]);
    expect(tree.stats.maxDepth).toBe(6); // root, Places, Realm, Harbor, Lamp Row, Cellars
  });

  test("Events group by first related plot with Standalone last; Threats rank by severity with legacy words folded in", () => {
    expect(labels(child(tree.root, "Events"))).toEqual(["The Missing Lantern:4", "The Salt War:4", "The Quiet Season:4", "Old Debts:3", "Standalone:5"]);
    expect(labels(child(tree.root, "Threats"))).toEqual(["Extinction Level:2", "Catastrophic:1", "Major:3", "Notable:2", "Minor:3", "Unrated:1"]);
  });

  test("Worldbuilding, Narrative and Bestiary group as RoleCall's builders do", () => {
    expect(labels(child(tree.root, "Worldbuilding"))).toEqual(["Magic:6", "Law:5", "Custom:5", "General:4"]);
    const narrative = child(tree.root, "Narrative");
    expect(labels(narrative)).toEqual(["Old Debts:5", "The Missing Lantern:5", "The Quiet Season:5", "The Salt War:5", "Unlinked Summaries:4"]);
    expect(narrative.children[0]!.kind).toBe("arc");
    expect(labels(child(tree.root, "Bestiary"))).toEqual(["Beast:3", "Spirit:3", "Construct:3", "Unclassified:3"]);
  });

  test("stats count nodes, depth and leaves of the tree itself", () => {
    let nodes = 0;
    let leaves = 0;
    const walk = (n: TreeNode) => { nodes += 1; if (n.children.length === 0) leaves += 1; n.children.forEach(walk); };
    walk(tree.root);
    expect(tree.stats).toMatchObject({ nodeCount: nodes, leafCount: leaves, maxDepth: 6 });
  });

  test("detection: under five enabled entries, or under half typed, falls back to categories; exactly half is typed", () => {
    const typed = (n: number) => Array.from({ length: n }, (_, i) => readEntry(typedEntry(`t${i}`, `T${i}`, "item", {}), i));
    const classic = (n: number) => Array.from({ length: n }, (_, i) => readEntry({ ...emptyLoreEntry(`c${i}`), title: `C${i}` }, i));
    expect(shouldUseTyped([...typed(4)]).use).toBe(false);
    expect(shouldUseTyped([...typed(3), ...classic(4)]).use).toBe(false);
    expect(shouldUseTyped([...typed(4), ...classic(4)]).use).toBe(true);
    expect(shouldUseTyped([]).ratio).toBe(0);
  });

  test("a classic book uses its categories in sort order; no category, or one that is gone, lands in General", () => {
    const categories: LorebookCategory[] = [{ id: "cat-people", name: "People", sortOrder: 2 }, { id: "cat-empty", name: "Empty", sortOrder: 1 }];
    const classicOnly = book.filter((e) => e.id.startsWith("classic-"));
    const t = buildTree(classicOnly, categories);
    expect(t.typed).toBe(false);
    expect(labels(t.root)).toEqual(["People:3", "General:3"]);
    expect(child(t.root, "General").entryIds).toEqual(["classic-3", "classic-4", "classic-5"]);
  });

  test("an empty book has an empty tree", () => {
    const t = buildTree([]);
    expect(t.root.children).toEqual([]);
    expect(t.stats).toEqual({ nodeCount: 1, maxDepth: 1, leafCount: 1 });
  });

  test("key order in stored JSON never changes the result (F8)", () => {
    const shuffle = (v: unknown): unknown => Array.isArray(v) ? v.map(shuffle) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, shuffle(x)])) : v;
    const shuffled = readBook(fixtureBook().map((e) => ({ ...e, metadata: shuffle(e.metadata) as LorebookEntry["metadata"] })));
    const a = buildTree(book);
    const b = buildTree(shuffled);
    expect(b).toEqual(a);
    expect(buildDashboard(shuffled, b)).toEqual(buildDashboard(book, a));
    expect(buildRelationshipGraph(shuffled).mismatches.map((m) => m.edge.sourceEntryId)).toEqual(buildRelationshipGraph(book).mismatches.map((m) => m.edge.sourceEntryId));
  });
});

describe("the Dashboard's numbers", () => {
  const tree = buildTree(book);
  const dash = buildDashboard(book, tree);
  const ids = (list: CompendiumEntry[]) => list.map((e) => e.id);

  test("counts per type leave retired entries out and keep switched-off ones; classic entries are counted apart", () => {
    expect(dash.counts).toEqual({ character: 59, location: 30, item: 23, power: 10, organization: 12, event: 20, plot: 8, threat: 12, worldbuilding: 20, summary: 24, creature: 12 });
    expect(dash.total).toBe(230);
    expect(dash.classic).toBe(6);
    expect(dash.tree).toBe(tree.stats);
  });

  test("featured is a starred entry, else the newest of its type (later in the book), else a touched one", () => {
    expect(dash.featured.character!.id).toBe("c-mira");
    expect(dash.featured.location!.id).toBe("l-20");
    expect(dash.featured.item!.id).toBe("off-2");
    expect(dash.featured.power!.id).toBe("pw-9");
    expect(dash.featured.organization!.id).toBe("o-11");
    expect(dash.featured.event!.id).toBe("e-19");
    expect(dash.featured.creature!.id).toBe("cr-11");
    const touched = buildDashboard(book, tree, new Map([["i-3", 500], ["pw-1", 400]]));
    expect(touched.featured.item!.id).toBe("i-3");
    expect(touched.featured.power!.id).toBe("pw-1");
    expect(touched.featured.character!.id).toBe("c-mira"); // a star still wins
  });

  test("active plots are not started, active, stalled or escalating, newest first; retired plots never show", () => {
    expect(ids(dash.activePlots)).toEqual(["p-7", "p-6", "p-3", "p-2", "p-1", "p-0"]);
  });

  test("active threats drop averted and realized, worst first, newest first within a rank, at most eight", () => {
    expect(ids(dash.activeThreats)).toEqual(["t-5", "t-0", "t-1", "t-9", "t-8", "t-2", "t-6", "t-10"]);
  });

  test("world concepts list every worldbuilding entry; recaps are four plots of four, in turn order", () => {
    expect(dash.worldConcepts).toHaveLength(20);
    expect(dash.recaps.map((g) => `${g.plot}:${g.total}`)).toEqual(["Old Debts:5", "The Missing Lantern:5", "The Quiet Season:5", "The Salt War:5"]);
    expect(ids(dash.recaps[1]!.summaries)).toEqual(["s-16", "s-12", "s-8", "s-4"]);
  });

  test("an empty book has zero counts and no cells", () => {
    const empty = buildDashboard([], buildTree([]));
    expect(empty.total).toBe(0);
    expect(empty.featured).toEqual({});
    expect(empty.activePlots).toEqual([]);
    expect(empty.recaps).toEqual([]);
  });

  test("a character's arc reads its key moments, current phase and falls back sensibly", () => {
    expect(arcOf(byId("c-mira"))).toEqual({ moments: ["Arrives", "Loses the lantern", "Finds it"], current: 1, label: "Loses the lantern" });
    expect(arcOf(readEntry(typedEntry("a", "A", "character", { arc: { key_moments: ["x", "y"] } }), 0))).toEqual({ moments: ["x", "y"], current: 1, label: "y" });
    expect(arcOf(readEntry(typedEntry("b", "B", "character", { arc: { current_phase: "Dawn" } }), 0))).toEqual({ moments: [], current: 0, label: "Dawn" });
    expect(arcOf(byId("c-dov"))).toEqual({ moments: [], current: 0, label: "" });
  });
});

describe("relationships", () => {
  const graph = buildRelationshipGraph(book);

  test("59 live characters declare 10 relationships; a retired character is left out", () => {
    expect(graph.characterCount).toBe(59);
    expect(graph.edgeCount).toBe(10);
    expect(graph.outgoing.size).toBe(7);
    expect([...graph.outgoing.keys()]).not.toContain("ghost");
  });

  test("targets resolve by exact title or as one whole word; an ambiguous word or an unknown name resolves to nothing", () => {
    const mira = graph.outgoing.get("mira vance")!;
    expect(mira.map((e) => e.resolvedTargetEntryId)).toEqual(["c-dov", "c-sela", undefined]);
    const ines = graph.outgoing.get("ines fushiguro")!;
    expect(ines.map((e) => e.resolvedTargetEntryId)).toEqual([undefined, "c-tomas"]); // "Fushiguro" names two people
    expect(mira[0]).toMatchObject({ nature: "ally", status: "active", sourceEntryId: "c-mira" });
  });

  test("a one-sided edge to a real character is a mismatch; silence is the only reason", () => {
    expect(graph.mismatches.map((m) => `${m.edge.sourceEntryId}>${m.targetEntryId}`)).toEqual(["c-tomas>c-sela", "c-ines>c-tomas", "c-oz>c-mira", "c-blank>c-mira"]);
    // Sela calls Mira an enemy and Mira calls Sela a rival: different labels, both present, so not a mismatch.
    expect(graph.mismatches.some((m) => m.edge.sourceEntryId === "c-sela" || m.edge.sourceEntryId === "c-mira")).toBe(false);
  });

  test("backlinks list everyone who names a character, and unresolved names are kept under their own key", () => {
    expect(backlinksOf(graph, "Mira Vance").map((e) => e.sourceEntryId)).toEqual(["c-dov", "c-sela", "c-oz", "c-blank"]);
    expect(backlinksOf(graph, "nobody at all")).toHaveLength(1);
    expect(backlinksOf(graph, "Nobody Else")).toEqual([]);
  });

  test("a mirror names the source back with RoleCall's defaults, and is not added twice", () => {
    const oz = graph.mismatches.find((m) => m.edge.sourceEntryId === "c-oz")!;
    expect(mirrorOf(oz.edge)).toEqual({ with: "Oz", nature: "unknown", status: "unknown", notes: "" });
    expect(mirrorOf(graph.outgoing.get("dov ketter")![0]!)).toEqual({ with: "Dov Ketter", nature: "ally", status: "active", notes: "" });
    expect(alreadyMirrored(byId("c-mira"), "  dov ketter ")).toBe(true);
    expect(alreadyMirrored(byId("c-mira"), "Oz")).toBe(false);
  });
});

describe("cross-references", () => {
  const graph = buildCrossRefs(book);
  const mira = linksOf(graph, "c-mira");

  test("every live typed entry is a node; a retired one is not", () => {
    expect(graph.nodes).toHaveLength(230);
    expect(graph.nodes.some((n) => n.id === "c-ghost" || n.id === "ret-0")).toBe(false);
  });

  test("an entry's outgoing links are the names that resolve; a name that does not is a dangling edge", () => {
    expect(mira.outgoing.map((e) => `${e.edge}>${e.toId}`)).toEqual(["relationship>c-dov", "affiliation>o-0", "sibling>c-dov"]);
    const dangling = graph.edges.filter((e) => e.fromId === "c-mira" && e.toId === undefined).map((e) => e.to);
    expect(dangling).toEqual(["Sela", "Nobody At All", "Brass Lantern"]);
  });

  test("incoming links come from any type that names the entry, and count toward its refs", () => {
    expect(linksOf(graph, "c-mira").incoming.map((e) => `${e.fromId}:${e.edge}`)).toEqual(["c-dov:relationship", "c-oz:relationship", "c-blank:relationship", "i-0:owner", "pw-0:wielder", "p-0:central_character"]);
    expect(graph.nodes.find((n) => n.id === "c-dov")!.refs).toBe(4);
    expect(linksOf(graph, "pw-0").incoming.map((e) => e.edge)).toEqual(["grants_power"]);
  });

  test("a name matches case-insensitively and an entry that names itself has no link to itself", () => {
    const self = buildCrossRefs([
      readEntry(typedEntry("a", "Ada", "character", { name: "Ada", relationships: [{ with: "ADA" }, { with: "bob" }] }), 0),
      readEntry(typedEntry("b", "Bob", "character", { name: "Bob" }), 1),
    ]);
    expect(linksOf(self, "a").outgoing.map((e) => e.toId)).toEqual(["b"]);
    expect(linksOf(self, "a").incoming).toEqual([]);
    expect(self.nodes.find((n) => n.id === "a")!.refs).toBe(1); // RoleCall counts the self-name toward refs too
  });
});

describe("typed entry fields (from RoleCall's Remember_* schemas)", () => {
  const SAMPLE: Record<EntryType, Record<string, unknown>> = {
    character: { name: "A", aliases: ["B"], role: "ally", age: "ancient", physical: { summary: "x" }, relationships: [{ with: "B" }], notable_stats: "strong", family: { spouse: "C" } },
    location: { name: "A", type: "city", parent_location: "B", connected_to: ["C"], history: "old" },
    item: { name: "A", type: "relic", condition: "good", abilities: ["a"], activation: { how: "x" } },
    power: { name: "A", category: "attack", mastery: "nascent", source: "innate", users: ["B"], tagline: "t" },
    organization: { name: "A", type: "guild", members: [{ name: "B" }], founded: { when: "x" }, symbols: { a: "b" } },
    event: { name: "A", type: "battle", significance: "major", participants: [{ name: "B" }], when: "dawn" },
    plot: { name: "A", type: "mystery", status: "active", stakes_per_character: { B: "x" }, themes: ["t"] },
    threat: { name: "A", nature: "social", scope: "local", severity: "major", status: "active", source: { reference: "B" } },
    worldbuilding: { topic: "A", category: "magic", description: "d", key_facts: ["k"] },
    summary: { title: "A", summary: "s", messages_covered: 12, turn_range: { from: 1, to: 2 }, mood: "tense" },
    creature: { name: "A", classification: "beast", rarity: "rare", tameable: true, ecology: { diet: "x" } },
  };

  test("one valid entry per type parses with no issues, nothing missing and nothing unknown", () => {
    for (const type of ENTRY_TYPES) {
      const parsed = parseStructured(type, SAMPLE[type]!);
      expect({ type, issues: parsed.issues, missing: parsed.missing, extras: parsed.extras }).toEqual({ type, issues: [], missing: [], extras: [] });
      expect(parsed.data).toBe(SAMPLE[type]!);
      expect(REQUIRED_FIELDS[type].every((f) => knownFields(type).includes(f))).toBe(true);
    }
  });

  test("a known field of the wrong kind is reported, never dropped, and null counts as absent", () => {
    const data = { name: "A", aliases: "Bee", age: 30, role: "villain", tameable: "yes", turn: null, extra_note: { keep: true } };
    const parsed = parseStructured("character", data);
    expect(parsed.issues).toEqual([{ field: "aliases", expected: "a list" }, { field: "age", expected: "text" }, { field: "role", expected: "one of protagonist, antagonist, ally, rival, neutral, background, deity, player_character" }]);
    expect(parsed.extras).toEqual(["tameable", "turn", "extra_note"]); // tameable belongs to creatures
    expect(parsed.data).toEqual(data);
    expect(parseStructured("creature", { name: "A", tameable: "yes", intelligence: "sapient", variants: null }).issues).toEqual([{ field: "tameable", expected: "true or false" }]);
    expect(parseStructured("summary", { title: "A", summary: "s", messages_covered: "12" }).issues).toEqual([{ field: "messages_covered", expected: "a number" }]);
    expect(parseStructured("plot", { name: "A", stakes_per_character: 5 }).issues).toEqual([{ field: "stakes_per_character", expected: "text or an object" }]);
  });

  test("required fields that are absent, blank or null are listed", () => {
    expect(parseStructured("character", {}).missing).toEqual(["name"]);
    expect(parseStructured("character", { name: "  " }).missing).toEqual(["name"]);
    expect(parseStructured("worldbuilding", { topic: "T", category: null }).missing).toEqual(["category", "description"]);
    expect(parseStructured("summary", { title: "T" }).missing).toEqual(["summary"]);
  });

  test("over the fixture book only the three legacy severity words are reported, and the only unknown field is tagline", () => {
    const extras = new Set<string>();
    const flagged: string[] = [];
    for (const e of book.filter((x) => x.type !== null)) {
      const parsed = parseStructured(e.type!, e.data);
      for (const issue of parsed.issues) flagged.push(`${e.id}:${issue.field}`);
      parsed.extras.forEach((x) => extras.add(x));
    }
    expect(flagged).toEqual(["t-5:severity", "t-6:severity", "t-7:severity"]); // existential, moderate, resolved: kept and counted as their modern words
    expect([...extras].sort()).toEqual(["tagline"]); // the dashboard reads a tagline that no Remember_* tool lists
  });

  test("key order never changes what is reported", () => {
    const shuffled = Object.fromEntries(Object.entries({ name: "A", aliases: "x", zed: 1, role: "ally" }).reverse());
    const a = parseStructured("character", { name: "A", aliases: "x", zed: 1, role: "ally" });
    const b = parseStructured("character", shuffled);
    expect(b.issues).toEqual(a.issues);
    expect([...b.extras]).toEqual(a.extras);
  });
});
