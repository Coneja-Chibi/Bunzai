/** Default canonical preset prompt used by core preset and assembly tests. */
import type { PresetPrompt } from "../../entities/preset/schema";

export const makePresetPrompt = (overrides: Partial<PresetPrompt> = {}): PresetPrompt => ({
  id: "b",
  name: "Block",
  content: "",
  role: "system",
  enabled: true,
  systemPrompt: false,
  marker: false,
  placement: "relative",
  injectionDepth: 4,
  injectionOrder: 100,
  forbidOverrides: false,
  ...overrides,
});
