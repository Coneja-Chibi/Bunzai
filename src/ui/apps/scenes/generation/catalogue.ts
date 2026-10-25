/**
 * The sections after Thinking in Replies, in order. A section is a panel the tab hands the shared scene preset writer and the
 * search text (generation-env.ts); it reports its enabled count and Reset with useGenerationSection.
 */
import type { GenerationSection } from "./generation-env";
import { ParamsPanel } from "./params-panel";

export const CATALOGUE: readonly GenerationSection[] = [{ id: "params", Panel: ParamsPanel }];
