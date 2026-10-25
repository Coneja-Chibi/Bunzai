/**
 * What the Generation tab hands every section and what a section hands back. The tab owns the one scene
 * preset writer (`own`), so every section that writes samplers writes through it. A section is a panel it draws
 * itself; it reports its enabled count and a Reset to the tab with `useGenerationSection`, so the tab's header and
 * Reset cover every group.
 */
import { createContext, useContext, useEffect, useRef, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { BoothPreset } from "../use-booth-preset";
import type { ScenePresetOwn } from "../use-scene-preset-own";

export interface GenerationEnv {
  ctx: AppContext;
  chat: Chat;
  onChat(chat: Chat): void;
  /** The scene's own preset values and their one debounced writer (shared with Prompting and the Booth). */
  own: ScenePresetOwn;
  /** The scene's library preset, read-only here. */
  preset: BoothPreset;
  /** Thinking is on for this scene: Reasoning Effort is a level. The Enable Thinking that Clear Thinking hangs from. */
  thinking: boolean;
}

export interface GenerationSection {
  id: string;
  Panel(props: { env: GenerationEnv; query: string }): JSX.Element | null;
}

interface Reporter { report(id: string, count: number, reset?: () => void): void }
export const GenerationReport = createContext<Reporter>({ report: () => undefined });

/** Tell the tab how many parameters this section has switched on and how to reset them. */
export function useGenerationSection(id: string, count: number, reset?: () => void): void {
  const { report } = useContext(GenerationReport);
  const latest = useRef(reset);
  latest.current = reset;
  useEffect(() => { report(id, count, () => latest.current?.()); }, [report, id, count]);
}
