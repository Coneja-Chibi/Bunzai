/**
 * The workshop's entry for the Messenger shell: the Regex Workshop page's body (the scene's regex scripts as rows), or null for every other program, which the caller draws as before.
 */
import type { ReactNode } from "react";
import type { Program } from "../../programs";
import { onChatOf, type WingArgs } from "../../wing-props";
import { RegexScripts } from "./regex-scripts";

export function workshopProgramBody(program: Program, args: WingArgs | null): ReactNode | null {
  return program.id === "regex" && args ? <RegexScripts ctx={args.ctx} chat={args.scene.chat} onChat={onChatOf(args)} /> : null;
}

export { Workshop, isWorkshopProgram, type WorkshopScene } from "./workshop-layer";
