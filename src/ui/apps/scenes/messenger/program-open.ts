/**
 * Asking the Messenger to open one of its programs from somewhere that does not hold its navigation (a chip under a reply opening the Trackers program). The page owns the Messenger and the
 * Messenger's navigation hook answers (use-messenger-nav.ts), the same window-event door the Stage and the Story Director's settings link use (use-stage-open.ts). An id that is not a program
 * in the current list is ignored, like any other request for a program that is not there.
 */
export const PROGRAM_OPEN_EVENT = "bunzai:program-open";
export interface ProgramOpenDetail { program: string }

export const openProgram = (program: string): void => { window.dispatchEvent(new CustomEvent<ProgramOpenDetail>(PROGRAM_OPEN_EVENT, { detail: { program } })); };
