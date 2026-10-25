/**
 * The cross-reference explorer's pure side: RoleCall's five edge kinds, the filters (all eleven entry types, unlike RoleCall's modal,
 * which silently drops creatures and powers), what a node connects to, zoom about the pointer, fit to screen, and one layout per book
 * revision however many times the view is drawn.
 */
import { describe, expect, test } from "bun:test";
import { buildCrossRefs, type CrossRefGraph, type EntryType } from "../../../../../core/compendium";
import { readBook } from "../../../../../core/compendium";
import { typedEntry } from "../../../../../core/compendium/fixture-book";
import {
  allFilters, connectionsOf, createLayoutCache, edgeKindOf, edgeLabel, fitView, neighbours, nodeSize, resolvedLinks, searchHits, settleLayout, ticksFor, visibleOf, zoomAt,
  ZOOM_MAX, ZOOM_MIN, type Filters,
} from "./graph-core";

const book = () => buildCrossRefs(readBook([
  typedEntry("mira", "Mira Vance", "character", { relationships: [{ with: "Dov Ketter", nature: "ally" }], affiliations: [{ org: "Lantern Guild" }], current_state: { location: "The Quay" } }),
  typedEntry("dov", "Dov Ketter", "character", { relationships: [{ with: "Mira Vance" }, { with: "Nobody At All" }] }),
  typedEntry("guild", "Lantern Guild", "organization", { leader: "Mira Vance", headquarters: "The Quay" }),
  typedEntry("quay", "The Quay", "location", { connected_to: ["The Quay"] }),
  typedEntry("kraken", "Old Kraken", "creature", { known_locations: ["The Quay"] }),
  typedEntry("wave", "Wave Call", "power", { users: ["Mira Vance"] }),
  typedEntry("lone", "Lone Rock", "location", {}),
]));

describe("edge kinds (RoleCall edgeKind.ts)", () => {
  test("a raw edge falls in one of RoleCall's five buckets, and an unknown one in the last", () => {
    expect([edgeKindOf("ally"), edgeKindOf("faction_present"), edgeKindOf("parent_location"), edgeKindOf("related_plot"), edgeKindOf("related_to")]).toEqual(["relationship", "affiliation", "location", "participant", "mention"]);
    expect(edgeKindOf("something_new")).toBe("mention");
    expect(edgeLabel("woken_by_mira")).toBe("woken by mira");
  });
});

describe("links and filters", () => {
  test("a link needs both ends in the book; a dangling name and a self reference are dropped", () => {
    const g = book();
    expect(g.edges.some((e) => e.to === "Nobody At All")).toBe(true);
    const links = resolvedLinks(g);
    expect(links.some((l) => l.to === undefined || l.from === l.to)).toBe(false);
    expect(links.map((l) => `${l.from}>${l.to}:${l.edge}`)).toContain("mira>dov:relationship");
    expect(links.length).toBe(g.edges.filter((e) => e.toId && e.toId !== e.fromId).length);
  });

  test("every one of the eleven entry types can show, creatures and powers included", () => {
    const g = book();
    const f = allFilters();
    expect(f.types.size).toBe(11);
    const v = visibleOf(g, resolvedLinks(g), f);
    expect(v.nodes.map((n) => n.type).sort()).toEqual(["character", "character", "creature", "location", "location", "organization", "power"]);
  });

  test("turning a type off hides its nodes and every link that touches them", () => {
    const g = book();
    const types = new Set<EntryType>(allFilters().types);
    types.delete("character");
    const v = visibleOf(g, resolvedLinks(g), { ...allFilters(), types });
    expect(v.nodes.some((n) => n.type === "character")).toBe(false);
    expect(v.links.every((l) => l.from !== "mira" && l.to !== "mira" && l.from !== "dov" && l.to !== "dov")).toBe(true);
  });

  test("turning a connection kind off hides those links, and hiding orphans drops nodes with no visible link", () => {
    const g = book();
    const links = resolvedLinks(g);
    const kinds = new Set(allFilters().kinds);
    kinds.delete("relationship");
    const noRel = visibleOf(g, links, { ...allFilters(), kinds });
    expect(noRel.links.some((l) => l.kind === "relationship")).toBe(false);
    const bare: Filters = { ...allFilters(), orphans: false };
    const connected = visibleOf(g, links, bare);
    expect(connected.nodes.some((n) => n.id === "lone")).toBe(false);
    expect(visibleOf(g, links, allFilters()).nodes.some((n) => n.id === "lone")).toBe(true);
  });

  test("a node's connections are each other node once per edge type, and its neighbourhood is the highlight set", () => {
    const g = book();
    const links = resolvedLinks(g);
    const mira = connectionsOf(links, "mira");
    expect(mira.map((c) => `${c.other}:${c.edge}`).sort()).toEqual(["dov:relationship", "guild:affiliation", "guild:leader", "quay:current_location", "wave:wielder"]);
    expect([...neighbours(links, "mira")].sort()).toEqual(["dov", "guild", "mira", "quay", "wave"]);
  });

  test("search matches names, case blind", () => {
    const g = book();
    expect([...searchHits(g.nodes, "  QUAY ")]).toEqual(["quay"]);
    expect(searchHits(g.nodes, "").size).toBe(0);
  });

  test("a node is bigger the more it is referenced, in RoleCall's four steps", () => {
    expect([nodeSize(0), nodeSize(1), nodeSize(2), nodeSize(5), nodeSize(10), nodeSize(99)]).toEqual([30, 30, 38, 46, 56, 56]);
  });
});

describe("view", () => {
  test("zoom keeps the point under the pointer where it is, and stays inside the limits", () => {
    const v = zoomAt({ x: 40, y: 20, k: 1 }, 2, { x: 300, y: 200 });
    expect(v.k).toBe(2);
    expect((300 - v.x) / v.k).toBeCloseTo((300 - 40) / 1, 6);
    expect((200 - v.y) / v.k).toBeCloseTo((200 - 20) / 1, 6);
    expect(zoomAt({ x: 0, y: 0, k: 3.9 }, 5, { x: 0, y: 0 }).k).toBe(ZOOM_MAX);
    expect(zoomAt({ x: 0, y: 0, k: 0.21 }, 0.1, { x: 0, y: 0 }).k).toBe(ZOOM_MIN);
  });

  test("fit centres the nodes in the canvas with the padding RoleCall uses", () => {
    const v = fitView([{ x: 0, y: 0, r: 20 }, { x: 400, y: 0, r: 20 }], { width: 1000, height: 700 }, 60);
    expect(v.k).toBeCloseTo((1000 - 120) / 440, 6);
    expect(v.x + 200 * v.k).toBeCloseTo(500, 6);
    expect(v.y).toBeCloseTo(350, 6);
    expect(fitView([], { width: 1000, height: 700 })).toEqual({ x: 0, y: 0, k: 1 });
  });
});

describe("layout", () => {
  test("every node gets a finite place inside the box, and the same graph gives the same places", () => {
    const g = book();
    const a = settleLayout(g);
    const b = settleLayout(g);
    expect(a.at.size).toBe(g.nodes.length);
    for (const p of a.at.values()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(a.box.width);
    }
    expect([...a.at]).toEqual([...b.at]);
  });

  test("a bigger book gets fewer settling steps, never fewer than a few", () => {
    expect(ticksFor(200)).toBe(120);
    expect(ticksFor(450)).toBeLessThan(120);
    expect(ticksFor(450)).toBeGreaterThan(ticksFor(2000));
    expect(ticksFor(100_000)).toBe(6);
  });

  test("the layout runs once per graph however often it is asked for, and again for a new revision's graph", () => {
    let runs = 0;
    const layoutOf = createLayoutCache((g: CrossRefGraph) => { runs += 1; return settleLayout(g); });
    const g = book();
    layoutOf(g);
    layoutOf(g);
    layoutOf(g);
    expect(runs).toBe(1);
    layoutOf(book());
    expect(runs).toBe(2);
  });
});
