/** The link table and graph derivation: shared targets stay one node, unopened targets become ghosts. */
import { expect, test } from "bun:test";
import type { StudioEntitySummary } from "../../../app-contract";
import { LINK_PORTS, canLink, deriveGraph, refsOf, withRef } from "./links";

const piece = (kind: string, id: string, name = id): StudioEntitySummary => ({ kind, id, name });

test("canLink follows the table and nothing else", () => {
  expect(canLink("character", "knowledgeRefs", "lorebook")).toBe(true);
  expect(canLink("preset", "quickReplyRefs", "quickreply")).toBe(true);
  expect(canLink("character", "knowledgeRefs", "regex")).toBe(false);
  expect(canLink("lorebook", "knowledgeRefs", "lorebook")).toBe(false);
  expect(canLink("persona", "behaviorRefs", "regex")).toBe(false);
  expect(LINK_PORTS).toHaveLength(5);
});

test("a lorebook linked by two pieces is one node with two wires", () => {
  const open = [piece("character", "c1"), piece("persona", "p1"), piece("lorebook", "b1")];
  const { nodes, edges } = deriveGraph(open, {
    "character:c1": { knowledgeRefs: ["b1"] },
    "persona:p1": { knowledgeRefs: ["b1"] },
  }, () => undefined);
  expect(nodes.filter((n) => n.kind === "lorebook")).toHaveLength(1);
  expect(nodes.every((n) => !n.ghost)).toBe(true);
  expect(edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual(["character:c1>lorebook:b1", "persona:p1>lorebook:b1"]);
});

test("a referenced piece that is not open is a ghost, named from the library when known", () => {
  const known = piece("regex", "r1", "Tidy asterisks");
  const { nodes, edges } = deriveGraph(
    [piece("preset", "s1")],
    { "preset:s1": { behaviorRefs: ["r1", "gone"], quickReplyRefs: ["q1"] } },
    (kind, id) => (kind === "regex" && id === "r1" ? known : undefined),
  );
  const ghosts = nodes.filter((n) => n.ghost);
  expect(ghosts.map((n) => [n.key, n.name, n.summary === known])).toEqual([
    ["regex:r1", "Tidy asterisks", true],
    ["regex:gone", "Missing piece", false],
    ["quickreply:q1", "Missing piece", false],
  ]);
  expect(edges).toHaveLength(3);
});

test("a duplicated id in a ref list draws one wire", () => {
  const { edges } = deriveGraph([piece("character", "c1")], { "character:c1": { knowledgeRefs: ["b1", "b1"] } }, () => undefined);
  expect(edges).toHaveLength(1);
});

test("withRef attaches once, detaches, and removes an emptied field", () => {
  const body = { identity: { name: "A" }, knowledgeRefs: ["b1"] };
  expect(withRef(body, "knowledgeRefs", "b2", true).knowledgeRefs).toEqual(["b1", "b2"]);
  expect(withRef(body, "knowledgeRefs", "b1", true).knowledgeRefs).toEqual(["b1"]);
  const emptied = withRef(body, "knowledgeRefs", "b1", false);
  expect("knowledgeRefs" in emptied).toBe(false);
  expect(emptied.identity).toEqual({ name: "A" });
  expect(body.knowledgeRefs).toEqual(["b1"]);
  expect(refsOf({ behaviorRefs: ["r", 3, null] }, "behaviorRefs")).toEqual(["r"]);
});
