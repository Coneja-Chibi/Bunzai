/**
 * What a scene keeps of Final Cut: the master switch, the passes with every setting, and the per-tool
 * model overrides. The shapes are core/final-cut/pass.ts's, which also holds the defaults a missing field takes. Split from chat-store.ts
 * for the file-size cap; chat-store.ts re-exports.
 */
import type { FinalCutPass, FinalCutSettings, FinalCutTools } from "../../core/final-cut/pass";

export type ChatFinalCut = FinalCutSettings;
export type { FinalCutPass, FinalCutTools };

/** A change to a scene's Final Cut: a key given replaces it, null clears it, a key left out stays. */
export interface ChatFinalCutPatch {
  on?: boolean | null;
  passes?: FinalCutPass[] | null;
  tools?: FinalCutTools | null;
}
