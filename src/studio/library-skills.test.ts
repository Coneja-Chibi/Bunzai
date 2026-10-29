/** The linked skills a turn reads: through the one library reader, checked by the skill decoder, gone ones and repeated names left out. */
import { expect, test } from "bun:test";
import { emptySkillBody } from "../entities/skill/schema";
import { linkedSkills } from "./library-skills";

const entity = (id: string, body: unknown, kind = "skill") => ({ schemaVersion: "1", kind, id, body });
const store: Record<string, unknown> = {
  sword: entity("sword", { ...emptySkillBody("Sword fight"), text: "Footwork first." }),
  again: entity("again", { ...emptySkillBody("sword FIGHT"), text: "Twice." }),
  broken: entity("broken", { name: "Broken" }),
  lies: entity("lies", { ...emptySkillBody("Lying tells"), when: "always" }),
  tool: entity("tool", { name: "x" }, "tool"),
};
const read = async (kind: string, id: string) => (kind === "skill" ? store[id] ?? null : null);

test("reads each linked skill in order, leaving out gone, unreadable and same-named ones, none open yet", async () => {
  const skills = await linkedSkills(read, ["sword", "gone", "broken", "again", "tool", "lies"]);
  expect(skills.map((s) => [s.id, s.body.name, s.open])).toEqual([["sword", "Sword fight", false], ["lies", "Lying tells", false]]);
});

test("no reader or no list reads nothing", async () => {
  expect(await linkedSkills(undefined, ["sword"])).toEqual([]);
  expect(await linkedSkills(read, undefined)).toEqual([]);
});
