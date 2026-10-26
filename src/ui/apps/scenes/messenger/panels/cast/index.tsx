/**
 * The Cast panels' entry for the Messenger shell: given the program that is open, the page's wing arguments and the shell's `open`, the body for Participants (the member list), or the
 * Full Chat editor body wrapped in the inspector tabs for Characters and My Persona; null for every other program, which the caller draws as before.
 */
import type { ReactNode } from "react";
import type { Program } from "../../programs";
import type { WingArgs } from "../../wing-props";
import { CastInspector, isEditorProgram } from "./cast-inspector";
import { MembersPanel } from "./members-panel";

export function castProgramBody(program: Program, args: WingArgs | null, open: (id: string) => void, fallback: () => ReactNode): ReactNode | null {
  if (program.id === "participants") return args ? <MembersPanel ctx={args.ctx} scene={args.scene} onOpenProgram={open} /> : fallback();
  if (isEditorProgram(program.id)) return <CastInspector program={program.id} onOpenProgram={open}>{fallback()}</CastInspector>;
  return null;
}
