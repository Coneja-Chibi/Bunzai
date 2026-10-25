/**
 * The Generation tab's parameter groups, as plain rules (RoleCall's SamplerPanel.tsx:604-628 and
 * CategorySection :425): what a card shows, what a change writes, and the "N/M enabled" counts. A scene
 * keeps only what differs from its preset (ChatStore rule 19). Min P, Top A and the three penalties also
 * exist as typed preset fields; a card shows the effective one until the scene writes its own entry. Pure.
 */
import type { ChatPresetSamplers } from "../../../stage/contracts/chat-store";
import type { PresetSamplers } from "../../../entities/preset/schema";
import { paramsIn, type ParamDef, type ParamValue } from "../../../stage/params";
import type { SceneGeneration, SceneParam } from "../../../stage/params/scene";

type Params = NonNullable<SceneGeneration["params"]>;

/** The parameters that are also typed preset fields, with the no-op value the request leaves out. */
const TYPED: Readonly<Record<string, { field: keyof PresetSamplers; neutral: number }>> = {
  min_p: { field: "minP", neutral: 0 },
  top_a: { field: "topA", neutral: 0 },
  frequency_penalty: { field: "frequencyPenalty", neutral: 0 },
  presence_penalty: { field: "presencePenalty", neutral: 0 },
  repetition_penalty: { field: "repetitionPenalty", neutral: 1 },
};

export interface CardState {
  on: boolean;
  /** What the card's control shows; null for a parameter with no starting value. */
  value: ParamValue | null;
}

/** The typed preset value in effect for this parameter, when it is one that does something. */
function typedValue(def: ParamDef, typed: PresetSamplers): number | undefined {
  const t = TYPED[def.id];
  const v = t ? typed[t.field] : undefined;
  return typeof v === "number" && v !== t!.neutral ? v : undefined;
}

/** `typed` is the preset's samplers with the scene's own typed overrides over them. */
export function cardState(def: ParamDef, params: SceneGeneration["params"], typed: PresetSamplers): CardState {
  const entry = params?.[def.id];
  if (entry) return { on: entry.on, value: entry.value ?? def.default };
  const inherited = typedValue(def, typed);
  return inherited === undefined ? { on: false, value: def.default } : { on: true, value: inherited };
}

/** The scene's parameters after one card changed. Switching a boolean on sends true, off sends false (RoleCall handleToggle). */
export function setCard(def: ParamDef, params: SceneGeneration["params"], typed: PresetSamplers, change: { on?: boolean; value?: ParamValue }): Params {
  const now = cardState(def, params, typed);
  const on = change.on ?? now.on;
  const value = change.value ?? (change.on !== undefined && def.kind === "boolean" ? on : params?.[def.id]?.value);
  const next: Params = { ...params };
  // Off with nothing to remember, and nothing inherited to switch off: the scene has no entry.
  if (!on && value === undefined && typedValue(def, typed) === undefined) delete next[def.id];
  else next[def.id] = { on, ...(value === undefined ? {} : { value }) } satisfies SceneParam;
  return next;
}

export const enabledCount = (defs: readonly ParamDef[], params: SceneGeneration["params"], typed: PresetSamplers): number =>
  defs.filter((d) => cardState(d, params, typed).on).length;

/** A sub-toggle's parent: its card is greyed while the parent is off. */
export const parentOn = (def: ParamDef, params: SceneGeneration["params"], typed: PresetSamplers, all: readonly ParamDef[]): boolean => {
  const parent = def.parentId ? all.find((p) => p.id === def.parentId) : undefined;
  if (def.parentId && !parent) return params?.[def.parentId]?.on === true;
  return parent ? cardState(parent, params, typed).on : true;
};

/** The scene's samplers with every generation parameter back to off: the params list and the typed fields the cards also show. */
export function resetParams(samplers: ChatPresetSamplers): ChatPresetSamplers {
  const next: Record<string, unknown> = { ...samplers };
  delete next["params"];
  for (const { field } of Object.values(TYPED)) delete next[field];
  return next as ChatPresetSamplers;
}

/** How many cards are on across the four groups, as the tab's "N parameters enabled" counts them. */
export const groupsEnabled = (params: SceneGeneration["params"], typed: PresetSamplers): number =>
  (["nucleus", "penalties", "constraints", "advanced"] as const).reduce((n, g) => n + enabledCount(paramsIn(g), params, typed), 0);

/** The scene's samplers with one Custom Request Parameters field set; blank text removes the field. */
export function withCustom<T extends SceneGeneration>(samplers: T, key: "customHeaders" | "customBody" | "customExclude", text: string): T {
  const next = { ...samplers };
  if (text.trim()) next[key] = text;
  else delete next[key];
  return next;
}
