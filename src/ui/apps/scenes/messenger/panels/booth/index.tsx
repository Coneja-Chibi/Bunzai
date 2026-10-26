/**
 * The Control Booth's entry for the Messenger shell: the Booth program's body for the side panel, or null for every other program, which the caller draws as before.
 */
import type { ReactNode } from "react";
import type { Program } from "../../programs";
import type { WingArgs } from "../../wing-props";
import { MessengerBooth } from "./messenger-booth";

export function boothProgramBody(program: Program, args: WingArgs | null, open: (id: string) => void): ReactNode | null {
  return program.id === "quickplay" && args ? <MessengerBooth args={args} open={open} /> : null;
}
