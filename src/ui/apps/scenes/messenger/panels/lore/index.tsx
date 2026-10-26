/**
 * The Lorebooks program's entry for the Messenger shell: the Lorebooks body for the side panel, or null for every other program, which the caller draws as before.
 */
import type { ReactNode } from "react";
import type { Program } from "../../programs";
import type { WingArgs } from "../../wing-props";
import { LorePanel } from "./lore-panel";

export function loreProgramBody(program: Program, args: WingArgs | null): ReactNode | null {
  return program.id === "lorebook" && args ? <LorePanel ctx={args.ctx} chat={args.scene.chat} characterName={args.name} onLore={args.setLoreBooks} /> : null;
}
