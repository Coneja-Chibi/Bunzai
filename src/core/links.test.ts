/** The link table read from the kind hub, and the helpers every link follower uses. */
import { describe, expect, test } from "bun:test";
import { LINK_PORTS, linkedRefs, linksTo, portsOf, referencedBy, resolveLinks, withLinksRenamed } from "./links";

describe("links", () => {
  test("who can point at a kind: the kinds that link to it, then scenes where a scene field holds it", () => {
    expect(referencedBy("lorebook")).toEqual(["character", "persona", "scene"]);
    expect(referencedBy("regex")).toEqual(["character", "preset", "promptbook", "scene"]);
    expect(referencedBy("quickreply")).toEqual(["preset"]);
    expect(referencedBy("pack")).toEqual(["scene"]);
    expect(referencedBy("preset")).toEqual(["scene"]);
    expect(referencedBy("character")).toEqual([]);
  });

  test("the table is what the kinds declare", () => {
    expect(LINK_PORTS.map((p) => `${p.from}.${p.field}->${p.to}`)).toEqual([
      "character.knowledgeRefs->lorebook",
      "character.behaviorRefs->regex",
      "persona.knowledgeRefs->lorebook",
      "preset.behaviorRefs->regex",
      "preset.quickReplyRefs->quickreply",
      "promptbook.cards:scriptsheet->scriptsheet",
      "promptbook.cards:skill->skill",
      "promptbook.cards:tool->tool",
      "promptbook.cards:dice->dice",
      "promptbook.cards:regex->regex",
      "promptbook.cards:tracker->tracker",
      "promptbook.phaseAgents->agent",
      "agent.tools->tool",
      "agent.skills->skill",
    ]);
    expect(portsOf("lorebook")).toEqual([]);
    expect(linksTo("lorebook").map((p) => p.from)).toEqual(["character", "persona"]);
  });

  test("linkedRefs reads every link field and ignores junk", () => {
    expect(linkedRefs("preset", { behaviorRefs: ["r1", 3], quickReplyRefs: ["q1"] })).toEqual([
      { kind: "regex", id: "r1", field: "behaviorRefs" },
      { kind: "quickreply", id: "q1", field: "quickReplyRefs" },
    ]);
    expect(linkedRefs("preset", null)).toEqual([]);
    expect(linkedRefs("lorebook", { knowledgeRefs: ["x"] })).toEqual([]);
  });

  test("renaming rewrites only mapped ids of the right kind and never drops one", () => {
    const body = { knowledgeRefs: ["a", "b"], behaviorRefs: ["a"], other: 1 };
    const out = withLinksRenamed("character", body, new Map([["lorebook:a", "a-2"]]));
    expect(out).toEqual({ knowledgeRefs: ["a-2", "b"], behaviorRefs: ["a"], other: 1 });
    expect(body.knowledgeRefs).toEqual(["a", "b"]);
  });

  test("resolveLinks splits found and missing, and can keep only the links a file embeds", async () => {
    const read = async (kind: string, id: string) => (id === "gone" ? null : { kind, id });
    const all = await resolveLinks("character", { knowledgeRefs: ["b1", "gone"], behaviorRefs: ["r1"] }, read);
    expect(all.found.map((f) => f.id)).toEqual(["b1", "r1"]);
    expect(all.missing).toEqual([{ kind: "lorebook", id: "gone", field: "knowledgeRefs" }]);
    const books = await resolveLinks("character", { knowledgeRefs: ["b1"], behaviorRefs: ["gone"] }, read, "embedded");
    expect(books).toEqual({ found: [{ kind: "lorebook", id: "b1", field: "knowledgeRefs", entity: { kind: "lorebook", id: "b1" } }], missing: [] });
    const preset = await resolveLinks("preset", { behaviorRefs: ["r1"], quickReplyRefs: ["gone"] }, read, "embedded");
    expect(preset.found.map((f) => f.kind)).toEqual(["regex"]);
    expect(preset.missing).toEqual([]);
    expect(LINK_PORTS.filter((p) => p.embedded).map((p) => `${p.from}.${p.field}`)).toEqual(["character.knowledgeRefs", "preset.behaviorRefs", "promptbook.cards:scriptsheet", "promptbook.cards:skill", "promptbook.cards:tool", "promptbook.cards:dice", "promptbook.cards:regex", "promptbook.cards:tracker", "promptbook.phaseAgents"]);
  });
});
