/**
 * The library skills a scene links (ChatPrompting.skills), read for a turn through the turn's one library reader: each is checked by
 * the skill kind's strict decoder, and a gone or unreadable one is left out, as is one whose name another linked skill already has
 * (the block names skills by name). Whether each is open comes from the scene state (the `skills` slot, the next step of the skill
 * build); until then none is.
 */
import type { AssemblySkill } from "../core/assembly/skills";
import type { SkillBody } from "../entities/skill/schema";
import { readPiece, type ReadPiece } from "./library-tools";

/** The linked skills that can be read, in the scene's order. */
export async function linkedSkills(read: ReadPiece | undefined, ids: readonly string[] | undefined): Promise<AssemblySkill[]> {
  const out: AssemblySkill[] = [];
  if (!read) return out;
  for (const id of ids ?? []) {
    const body = (await readPiece(read, "skill", id)) as SkillBody | null;
    if (body && !out.some((s) => s.body.name.toLowerCase() === body.name.toLowerCase())) out.push({ id, body, open: false });
  }
  return out;
}
