/**
 * The library skills a scene links (ChatPrompting.skills), read for a turn through the turn's one library reader: each is checked by
 * the skill kind's strict decoder, and a gone or unreadable one is left out, as is one whose name another linked skill already has
 * (the block names skills by name). Whether each is open comes from the scene state's `skills` slot (core/skill.ts).
 *
 * The picked skills' two narrator tools are made here too, the way the trackers' update tool is (library-trackers.ts): `open_skill`
 * lists every picked skill (name and what it is for) in its own description, so only that list costs anything until one opens, and
 * answers with the opened skill's instructions in the same call; `close_skill` closes one. Each is a `stateScoped` write through the
 * turn's one tool door: its only effect is the open skills' deltas pending on the reply being written.
 */
import { processMacros } from "../core/macros";
import { withoutDeadline } from "../core/macros/deadline";
import { stripUnresolvedMacros } from "../core/assembly/sanitize";
import { HISTORY_MARKER } from "../core/assembly/macro-pass";
import { isRecord } from "../core/guards";
import { openSkills, skillDelta } from "../core/skill";
import { freeName } from "../core/tools";
import { lineOf } from "../core/tracker";
import type { AssemblySkill } from "../core/assembly/skills";
import type { SceneState } from "../core/scene-state/types";
import type { SkillBody } from "../entities/skill/schema";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { INVALID_TOOL, type NarratorTool } from "../stage/provider/tool-loop";
import { readPiece, type ReadPiece } from "./library-tools";
import type { ToolsContext } from "./scene-turn-tools";
import type { ToolWrites } from "./scene-turn-writes";

export const OPEN_SKILL = "open_skill";
export const CLOSE_SKILL = "close_skill";

/** The linked skills that can be read, in the scene's order, each open or not in `state`. */
export async function linkedSkills(read: ReadPiece | undefined, ids: readonly string[] | undefined, state: SceneState): Promise<AssemblySkill[]> {
  const out: AssemblySkill[] = [];
  if (!read) return out;
  const open = openSkills(state);
  for (const id of ids ?? []) {
    const body = (await readPiece(read, "skill", id)) as SkillBody | null;
    if (body && !out.some((s) => s.body.name.toLowerCase() === body.name.toLowerCase())) out.push({ id, body, open: open.has(id) });
  }
  return out;
}

/** A skill's instructions as the model reads them in a tool answer: the turn's macros, read-only, and what no macro answers stripped. */
function rendered(ctx: ToolsContext, text: string): string {
  const context = ctx.macros.context;
  const out = context ? processMacros(text, { ...withoutDeadline(context), readOnly: true, randomSeed: 1 }).text : text;
  return stripUnresolvedMacros(out, HISTORY_MARKER).trim();
}

const nameParam = (names: readonly string[]) => ({
  type: "object",
  properties: { name: { type: "string", enum: names, description: "The skill's name, exactly as listed." } },
  required: ["name"],
  additionalProperties: false,
});

/** `open_skill` and `close_skill` for the turn's picked skills, or none when the scene links none. `taken` are the names the other tools already use. */
export function skillTools(ctx: ToolsContext, taken: readonly string[], writes: ToolWrites): NarratorTool<never>[] {
  const picked = (ctx.loaded.skills ?? []).filter((s) => s.body.when === "picked");
  if (picked.length === 0) return [];
  const names = picked.map((s) => s.body.name);
  /** Which are open as the reply stands: where the prompt left them, then every call this reply made. */
  const open = new Set(picked.filter((s) => s.open).map((s) => s.id));
  /** The skills this reply opened itself. */
  const openedNow = new Set<string>();
  const parse = (raw: unknown): { args: AssemblySkill } | { error: string } => {
    const name = isRecord(raw) && typeof raw["name"] === "string" ? raw["name"].trim().toLowerCase() : "";
    const skill = picked.find((s) => s.body.name.toLowerCase() === name);
    return skill ? { args: skill } : { error: `There is no skill by that name. The skills are: ${names.join(", ")}.` };
  };
  const write = async (skill: AssemblySkill, on: boolean): Promise<void> => {
    const refused = await writes.append([skillDelta(skill.id, on, writes.now())]);
    if (refused) throw new Error(refused);
    if (on) open.add(skill.id);
    else open.delete(skill.id);
  };
  const usedNames = new Set([INVALID_TOOL, ...taken]);
  const openName = freeName(OPEN_SKILL, usedNames);
  const closeName = freeName(CLOSE_SKILL, usedNames);
  const list = picked.map((s) => `- ${lineOf(s.body.name)}: ${lineOf(s.body.description) || "(no description)"}`).join("\n");
  const openTool: NarratorTool<AssemblySkill> = {
    access: SCENE_ACTION_TIERS["narrator.skill"],
    stateScoped: true,
    definition: { type: "function", function: { name: openName, description: `Open a skill when you need its instructions: they are returned now and stay in your prompt on later replies until the skill is closed. The skills:\n${list}`, parameters: nameParam(names) } },
    parse,
    run: async (skill) => {
      // Always written, once a reply: a skill the turn's close rule is closing still counts as open here, and this later write is what keeps it open.
      if (!(openedNow.has(skill.id) && open.has(skill.id))) await write(skill, true);
      openedNow.add(skill.id);
      return { text: rendered(ctx, skill.body.text) || "This skill has no instructions.", detail: { skill: skill.id } };
    },
  };
  const closeTool: NarratorTool<AssemblySkill> = {
    access: SCENE_ACTION_TIERS["narrator.skill"],
    stateScoped: true,
    definition: { type: "function", function: { name: closeName, description: "Close an open skill when it no longer applies: it leaves your prompt from the next reply.", parameters: nameParam(names) } },
    parse,
    run: async (skill) => {
      if (!open.has(skill.id)) return { text: `${skill.body.name} is not open.` };
      await write(skill, false);
      return { text: `Closed ${skill.body.name}.`, detail: { skill: skill.id } };
    },
  };
  return [openTool as NarratorTool<never>, closeTool as NarratorTool<never>];
}
