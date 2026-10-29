/**
 * The linked skills a turn reads (through the one library reader, checked by the skill decoder, gone ones and repeated names left out, open
 * from the scene state) and the picked skills' tools: open_skill answers with the instructions and opens it through the turn's tool door,
 * close_skill closes it, and both list only picked skills.
 */
import { describe, expect, test } from "bun:test";
import { emptySkillBody, type SkillBody } from "../entities/skill/schema";
import type { Delta } from "../core/scene-state/types";
import type { AssemblySkill } from "../core/assembly/skills";
import { linkedSkills, skillTools } from "./library-skills";
import type { ToolsContext } from "./scene-turn-tools";
import type { ToolWrites } from "./scene-turn-writes";

const entity = (id: string, body: unknown, kind = "skill") => ({ schemaVersion: "1", kind, id, body });
const store: Record<string, unknown> = {
  sword: entity("sword", { ...emptySkillBody("Sword fight"), text: "Footwork first." }),
  again: entity("again", { ...emptySkillBody("sword FIGHT"), text: "Twice." }),
  broken: entity("broken", { name: "Broken" }),
  lies: entity("lies", { ...emptySkillBody("Lying tells"), when: "always" }),
  tool: entity("tool", { name: "x" }, "tool"),
};
const read = async (kind: string, id: string) => (kind === "skill" ? store[id] ?? null : null);
const at = (value: true) => ({ value, createdAt: 1, updatedAt: 1 });

describe("linked skills", () => {
  test("reads each in order, leaving out gone, unreadable and same-named ones, and takes open from the skills slot", async () => {
    const skills = await linkedSkills(read, ["sword", "gone", "broken", "again", "tool", "lies"], { skills: { lies: at(true) } });
    expect(skills.map((s) => [s.id, s.body.name, s.open])).toEqual([["sword", "Sword fight", false], ["lies", "Lying tells", true]]);
  });

  test("no reader or no list reads nothing", async () => {
    expect(await linkedSkills(undefined, ["sword"], {})).toEqual([]);
    expect(await linkedSkills(read, undefined, {})).toEqual([]);
  });
});

const picked = (id: string, over: Partial<SkillBody> = {}, open = false): AssemblySkill =>
  ({ id, open, body: { ...emptySkillBody(id), description: `${id} help`, text: `${id} says {{char}}{{nope}}.`, when: "picked", ...over } });
function harness(skills: AssemblySkill[], refuse?: string) {
  const sent: Delta[][] = [];
  const writes: ToolWrites = { now: () => 5, append: async (d) => { sent.push([...d]); return refuse ?? null; } };
  const ctx = { loaded: { skills }, macros: { context: { characterName: "Vera", localVariables: new Map(), globalVariables: new Map() } } } as unknown as ToolsContext;
  const [open, close] = skillTools(ctx, ["open_skill"], writes) as unknown as [
    { definition: { function: { name: string; description: string; parameters: { properties: { name: { enum: string[] } } } } }; parse(r: unknown): { args: AssemblySkill } | { error: string }; run(a: AssemblySkill): Promise<{ text: string }>; stateScoped?: true },
    { definition: { function: { name: string } }; parse(r: unknown): { args: AssemblySkill } | { error: string }; run(a: AssemblySkill): Promise<{ text: string }> },
  ];
  const call = async (tool: typeof close, name: string) => {
    const p = tool.parse({ name });
    if ("error" in p) throw new Error(p.error);
    return (await tool.run(p.args)).text;
  };
  return { open, close, sent, call };
}

describe("open_skill and close_skill", () => {
  test("only picked skills get tools, listed with what each is for; none picked, no tools", () => {
    const h = harness([picked("Haggling"), { ...picked("Always"), body: { ...picked("Always").body, when: "always" } }]);
    expect(h.open.definition.function.name).toBe("open_skill_2");
    expect(h.open.definition.function.description).toContain("- Haggling: Haggling help");
    expect(h.open.definition.function.description).not.toContain("Always");
    expect(h.open.definition.function.parameters.properties.name.enum).toEqual(["Haggling"]);
    expect(h.open.stateScoped).toBe(true);
    expect(skillTools({ loaded: { skills: [] }, macros: {} } as unknown as ToolsContext, [], { now: () => 0, append: async () => null })).toEqual([]);
  });

  test("open answers with the instructions, macros read and unknown ones stripped, and opens it once", async () => {
    const h = harness([picked("Haggling")]);
    expect(await h.call(h.open, "haggling")).toBe("Haggling says Vera.");
    expect(await h.call(h.open, "Haggling")).toBe("Haggling says Vera.");
    expect(h.sent).toEqual([[{ slot: "skills", path: ["Haggling"], value: true, at: 5 }]]);
  });

  test("close closes an open one, and says so of one that is not open without writing", async () => {
    const h = harness([picked("Haggling", {}, true), picked("Lies")]);
    expect(await h.call(h.close, "Lies")).toBe("Lies is not open.");
    expect(await h.call(h.close, "Haggling")).toBe("Closed Haggling.");
    expect(h.sent).toEqual([[{ slot: "skills", path: ["Haggling"], removed: true, at: 5 }]]);
  });

  test("an unknown name is refused with the list, and a refused write is the model's error with nothing kept", async () => {
    const h = harness([picked("Haggling")], "The state change could not be saved, so nothing in that call was written.");
    expect(h.open.parse({ name: "Juggling" })).toEqual({ error: "There is no skill by that name. The skills are: Haggling." });
    await expect(h.call(h.open, "Haggling")).rejects.toThrow("could not be saved");
  });
});

test("a skill open when the reply began is written open again, and one closed then reopened in the same reply is written each time", async () => {
  const h = harness([picked("Haggling", {}, true)]);
  expect(await h.call(h.open, "Haggling")).toBe("Haggling says Vera.");
  expect(await h.call(h.close, "Haggling")).toBe("Closed Haggling.");
  expect(await h.call(h.open, "Haggling")).toBe("Haggling says Vera.");
  expect(h.sent.map((d) => d[0]!.removed ? "closed" : "open")).toEqual(["open", "closed", "open"]);
});
