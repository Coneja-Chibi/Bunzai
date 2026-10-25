/**
 * The Prompting wing's rules (approved wireframe rc-port/scene-preset-wing.html, RoleCall's
 * PresetPanel and usePresetWithOverrides): a block is on by the scene's toggle if it has
 * one, else by the preset; a toggle or sampler set back to the preset's own value is cleared, so the
 * scene only keeps what differs (ChatStore rule 19). Pure.
 */
import type { PresetBody, PresetPrompt, PresetSystemPrompts } from "../../../entities/preset/schema";
import type { ChatPresetSamplers } from "../../../stage/contracts/chat-store";
import type { SceneGeneration } from "../../../stage/params/scene";

export type Toggles = Readonly<Record<string, boolean>>;

export const isOn = (p: PresetPrompt, toggles: Toggles): boolean => (typeof toggles[p.id] === "boolean" ? toggles[p.id]! : p.enabled);

export const onCount = (prompts: readonly PresetPrompt[], toggles: Toggles): number => prompts.filter((p) => isOn(p, toggles)).length;

/** The scene's toggles with one block switched; matching the preset's own switch clears the entry, unless a choice group controls the block (`keep`): then the switch stays, because it must beat the choice (RoleCall keeps an explicit switch even when it equals the default). */
export function toggleBlock(toggles: Toggles, p: PresetPrompt, on: boolean, keep?: ReadonlySet<string>): Record<string, boolean> {
  const next = { ...toggles };
  if (on === p.enabled && !keep?.has(p.id)) delete next[p.id];
  else next[p.id] = on;
  return next;
}

export function toggleGroup(toggles: Toggles, prompts: readonly PresetPrompt[], on: boolean, keep?: ReadonlySet<string>): Record<string, boolean> {
  return prompts.reduce<Record<string, boolean>>((acc, p) => toggleBlock(acc, p, on, keep), { ...toggles });
}

export interface PromptGroup {
  id: string | null;
  name: string;
  /** How deep it nests under other groups; 0 at the top. */
  depth: number;
  prompts: PresetPrompt[];
}

/** RoleCall's list: Uncategorized first, then the preset's groups in order, each under its parent. */
export function groupsOf(body: PresetBody): PromptGroup[] {
  const groups = body.groups ?? [];
  const known = new Set(groups.map((g) => g.id));
  const inGroup = (id: string | null) => body.prompts.filter((p) => (id === null ? !p.groupId || !known.has(p.groupId) : p.groupId === id));
  const out: PromptGroup[] = [];
  const loose = inGroup(null);
  if (loose.length > 0) out.push({ id: null, name: "Uncategorized", depth: 0, prompts: loose });
  const walk = (parent: string | undefined, depth: number, seen: Set<string>) => {
    for (const g of groups) {
      if (g.parentGroupId !== parent || seen.has(g.id)) continue;
      seen.add(g.id);
      const prompts = inGroup(g.id);
      if (prompts.length > 0) out.push({ id: g.id, name: g.name, depth, prompts });
      walk(g.id, depth + 1, seen);
    }
  };
  walk(undefined, 0, new Set());
  return out;
}

/** The typed sampler fields the preset bars write; the scene's generation parameters have their own writer (generation-core.ts). */
export type SamplerKey = Exclude<keyof ChatPresetSamplers, keyof SceneGeneration>;

/** The scene's samplers with one set; the preset's own value clears the scene's. */
export function setSampler<K extends SamplerKey>(samplers: ChatPresetSamplers, key: K, value: ChatPresetSamplers[K], presetValue: ChatPresetSamplers[K] | undefined): ChatPresetSamplers {
  const next = { ...samplers };
  if (value === presetValue) delete next[key];
  else next[key] = value;
  return next;
}

const MARKERS: Readonly<Record<string, string>> = {
  chatHistory: "Chat history",
  worldInfoBefore: "Lore (before)",
  worldInfoAfter: "Lore (after)",
  dialogueExamples: "Example dialogue",
  personaDescription: "Persona",
  charDescription: "Character description",
  charPersonality: "Character personality",
  scenario: "Scenario",
};

/** A marker's slot in plain words (RoleCall's getMarkerLabel). */
export const markerLabel = (id: string): string => MARKERS[id] ?? id;

/** RoleCall's eight always-listed template fields (PresetPanel.tsx ALL_TEMPLATE_FIELDS), in its order. */
export const TEMPLATE_FIELDS: readonly { key: keyof PresetSystemPrompts; label: string }[] = [
  { key: "impersonation", label: "Impersonation Prompt" },
  { key: "newChat", label: "New Chat Prompt" },
  { key: "newGroupChat", label: "New Group Chat Prompt" },
  { key: "newExampleChat", label: "New Example Chat Prompt" },
  { key: "continueNudge", label: "Continue Nudge Prompt" },
  { key: "groupNudge", label: "Group Nudge Prompt" },
  { key: "assistantPrefill", label: "Assistant Prefill" },
  { key: "assistantImpersonation", label: "Assistant Impersonation" },
];

/** A sampler value as RoleCall reads it out (PresetPanel.tsx:2742 formatSamplerDisplay): 200000 is "200K", 1.5 is "1.50" under a fractional step. */
export function formatSampler(value: number, step?: number): string {
  if (value >= 1_000_000) return `${Number.isInteger(value / 1_000_000) ? String(value / 1_000_000) : (value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${Number.isInteger(value / 1000) ? String(value / 1000) : (value / 1000).toFixed(1)}K`;
  if (step !== undefined) return value.toFixed(step < 1 ? 2 : 0);
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** A typed sampler value held to its range and rounded onto its step (PresetPanel.tsx:2916-2924). */
export function commitSampler(value: number, min: number, max: number, step: number): number {
  const rounded = Math.round(Math.min(max, Math.max(min, value)) / step) * step;
  return Number(rounded.toFixed(step < 1 ? 2 : 0));
}

/** The Control Booth's QuickSlider read-out (QuickPlayPanel.tsx:462): a thousand or more is K with one decimal, so 200000 is "200.0K"; below that, the step's decimals. */
export const formatQuickSampler = (value: number, step: number): string => (value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(step < 1 ? 2 : 0));
