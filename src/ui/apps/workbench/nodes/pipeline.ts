/**
 * The Nodes view's Pipeline layer (pure): a preset's blocks in build order (off ones kept and marked),
 * what feeds each marker slot, the lore pass counts, the dry-run request, the derived (non-editable)
 * wires, and the geometry the canvas needs to land those wires on ports.
 */
import { blockTokens, buildOrder, FEATURE_MARKER_SLOTS, isFeatureMarkerSlot, markerLabel, slotLabel, type FeatureMarkerSlot } from "../../../../core/preset";
import { estimateEntryTokens, loreSummary } from "../../../../core/lore";
import { roughTokenCount } from "../../../../core/tokens/estimate";
import type { LorebookBody } from "../../../../entities/lorebook/schema";
import type { PresetBody } from "../../../../entities/preset";
import { isRecord } from "../../../../core/guards";
import { keyOf } from "../../../_shared/piece-key";
import { refsOf } from "./links";
import type { Pt } from "./geometry";
import type { StudioEntitySummary } from "../../../app-contract";
import type { SceneForecast } from "../../../app-contract-scenes";

export type Owner = "character" | "persona" | "lore" | "scene";

/** Which piece (or step) fills each marker slot. */
export const MARKER_OWNER: Readonly<Record<string, Owner>> = {
  charDescription: "character",
  charPersonality: "character",
  scenario: "character",
  dialogueExamples: "character",
  personaDescription: "persona",
  worldInfoBefore: "lore",
  worldInfoAfter: "lore",
  chatHistory: "scene",
};

export const LORE_KEY = "engine:lore";
export const REQUEST_KEY = "engine:request";
export const pipeKey = (presetKey: string): string => `pipe:${presetKey}`;

/* ---------- context: whose cast feeds the markers ---------- */

export interface ContextPiece { id: string; name: string; fromScene: boolean }
export interface PipelineContext { character: ContextPiece | null; persona: ContextPiece | null }
export interface SceneCast { characterId: string; characterName: string; personaId?: string; personaName?: string }

/** The scene's cast when a scene is picked (a scene with no persona has none), else the first character and persona on the canvas. */
export function contextOf(scene: SceneCast | null, canvas: readonly { id: string; kind: string; name: string }[]): PipelineContext {
  if (scene) {
    return {
      character: { id: scene.characterId, name: scene.characterName, fromScene: true },
      persona: scene.personaId ? { id: scene.personaId, name: scene.personaName ?? "", fromScene: true } : null,
    };
  }
  const first = (kind: string): ContextPiece | null => {
    const hit = canvas.find((p) => p.kind === kind);
    return hit ? { id: hit.id, name: hit.name, fromScene: false } : null;
  };
  return { character: first("character"), persona: first("persona") };
}

/** The lorebooks the context reads: the character's and persona's, plus the scene's own, minus the ones it switched off. */
export function loreIdsOf(characterBody: unknown, personaBody: unknown, scene: { added: readonly string[]; off: readonly string[] } | null): string[] {
  const ids = [...refsOf(characterBody, "knowledgeRefs"), ...refsOf(personaBody, "knowledgeRefs"), ...(scene?.added ?? [])];
  return [...new Set(ids)].filter((id) => !scene?.off.includes(id));
}

/* ---------- what feeds the slots ---------- */

export interface LoreStats { books: number; entries: number; enabled: number; alwaysOn: number; alwaysOnTokens: number }

/** The dry run of the lore pass: only what is certain without a chat (always-on entries fire; keyword entries need the story). */
export function loreStats(books: readonly LorebookBody[]): LoreStats {
  const out: LoreStats = { books: books.length, entries: 0, enabled: 0, alwaysOn: 0, alwaysOnTokens: 0 };
  for (const book of books) {
    const s = loreSummary(book);
    out.entries += s.entryCount;
    out.enabled += s.enabledCount;
    for (const e of Array.isArray(book.entries) ? book.entries : []) {
      if (e.enabled && e.constant) { out.alwaysOn += 1; out.alwaysOnTokens += estimateEntryTokens(e); }
    }
  }
  return out;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const field = (body: unknown, ...path: string[]): unknown => path.reduce<unknown>((acc, k) => (isRecord(acc) ? acc[k] : undefined), body);

/** The text each slot would splice in, from the context's bodies. Absent when the piece is not read (yet). */
export function slotTexts(characterBody: unknown, personaBody: unknown): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  if (characterBody) {
    out["charDescription"] = text(field(characterBody, "identity", "description"));
    out["charPersonality"] = text(field(characterBody, "persona", "personality"));
    out["scenario"] = text(field(characterBody, "persona", "scenario"));
    out["dialogueExamples"] = text(field(characterBody, "examples", "exampleMessages"));
  }
  if (personaBody) out["personaDescription"] = text(field(personaBody, "content"));
  return out;
}

export interface PipelineSources { texts: Partial<Record<string, string>>; lore: LoreStats | null }

/* ---------- rows ---------- */

export interface PipelineRow {
  id: string;
  name: string;
  on: boolean;
  marker: boolean;
  slot?: string;
  owner?: Owner;
  /** null: nothing to count (a slot with no source read, chat history) */
  tokens: number | null;
  role: string;
  /** what the dry run sends for this block */
  text: string;
  /** the feature this block's marker is filled with: the slot's first switched-on marker in the preset's own order, as the assembler picks */
  fills?: FeatureMarkerSlot;
}

export interface PipelineSummary { rows: PipelineRow[]; blocks: number; off: number; tokens: number }

export function pipelineRows(body: PresetBody, src: PipelineSources): PipelineSummary {
  const fills = new Map<string, FeatureMarkerSlot>();
  for (const p of body.prompts) {
    if (p.marker && p.enabled && isFeatureMarkerSlot(p.markerSlot) && ![...fills.values()].includes(p.markerSlot)) fills.set(p.id, p.markerSlot);
  }
  const rows: PipelineRow[] = buildOrder(body).map((b) => {
    const owner = b.marker && b.markerSlot ? MARKER_OWNER[b.markerSlot] : undefined;
    const fromSlot = b.marker && b.markerSlot ? src.texts[b.markerSlot] : undefined;
    const tokens = !b.marker ? blockTokens(b)
      : fromSlot !== undefined ? roughTokenCount(fromSlot)
      : b.markerSlot === "worldInfoBefore" && src.lore ? src.lore.alwaysOnTokens
      : null;
    return {
      id: b.id,
      name: b.name || (b.markerSlot ? (slotLabel(b.markerSlot) ?? b.markerSlot) : "Untitled block"),
      on: b.enabled,
      marker: b.marker,
      ...(b.markerSlot ? { slot: b.markerSlot } : {}),
      ...(owner ? { owner } : {}),
      tokens,
      role: b.role,
      text: b.marker ? (fromSlot ?? markerLabel(b.markerSlot)) : b.content,
      ...(fills.has(b.id) ? { fills: fills.get(b.id)! } : {}),
    };
  });
  return {
    rows,
    blocks: rows.length,
    off: rows.filter((r) => !r.on).length,
    tokens: rows.reduce((sum, r) => sum + (r.on ? (r.tokens ?? 0) : 0), 0),
  };
}

export interface DryMessage { role: string; content: string; tokens: number }

/** The request built from the canvas alone: enabled blocks in build order, macros literal, chat history empty. An estimate. */
export function dryRequest(summary: PipelineSummary): { messages: DryMessage[]; tokens: number } {
  const messages = summary.rows
    .filter((r) => r.on && r.text.trim() !== "")
    // a slot with no source shows its placeholder but counts as nothing: the estimate is only what would be sent
    .map((r) => ({ role: r.role, content: r.text, tokens: r.marker ? (r.tokens ?? 0) : roughTokenCount(r.text) }));
  return { messages, tokens: messages.reduce((sum, m) => sum + m.tokens, 0) };
}

/**
 * A reorder is only offered where it shows: build order follows placement then Order, so a move that
 * leaves the built order as it was is refused (a sentence, no write) rather than saved as an invisible edit.
 */
export function reorderChangesBuild(before: PresetBody, after: PresetBody): boolean {
  const ids = (b: PresetBody): string => buildOrder(b).map((p) => p.id).join("\u0000");
  return ids(before) !== ids(after);
}

/* ---------- geometry (fixed row heights; the CSS uses the same numbers) ---------- */

export const PIPE_W = 270;
export const PIPE_HEAD_H = 55;
export const BLOCK_H = 28;
export const PIPE_FOOT_H = 32;
export const ENGINE_W = 200;
export const LORE_H = 104;
export const REQUEST_H = 178; // room for the scene picker and, with two or more presets, the preset picker

export const pipeHeight = (blocks: number): number => PIPE_HEAD_H + Math.max(1, blocks) * BLOCK_H + PIPE_FOOT_H;
/** Where a wire enters block `index` of an expanded preset. */
export const blockInAnchor = (at: Pt, index: number): Pt => [at[0], at[1] + PIPE_HEAD_H + index * BLOCK_H + BLOCK_H / 2];
export const pipeOutAnchor = (at: Pt, blocks: number): Pt => [at[0] + PIPE_W, at[1] + pipeHeight(blocks) - PIPE_FOOT_H / 2];
export const engineIn = (at: Pt, h: number): Pt => [at[0], at[1] + h / 2];
export const engineOut = (at: Pt, h: number): Pt => [at[0] + ENGINE_W, at[1] + h / 2];

const COL_W = 300;
/** Default spots right of the Links columns: lore pass, then each preset stacked, then the request. */
export function pipelineLayout(presets: readonly { key: string; blocks: number }[]): Record<string, Pt> {
  const x0 = 40 + 3 * COL_W;
  const out: Record<string, Pt> = { [LORE_KEY]: [x0, 60] };
  let y = 60;
  for (const p of presets) { out[pipeKey(p.key)] = [x0 + ENGINE_W + 60, y]; y += pipeHeight(p.blocks) + 24; }
  out[REQUEST_KEY] = [x0 + ENGINE_W + 60 + PIPE_W + 60, 60];
  return out;
}

/* ---------- derived wires ---------- */

export interface PipelineWire {
  id: string;
  /** a node key: a piece, LORE_KEY, or a pipe key */
  from: string;
  /** the row index of the block the wire enters */
  block: number;
  to: string;
  color: string;
  dashed: boolean;
}

const OWNER_COLOR: Record<Owner, string> = {
  character: "var(--deck-character)",
  persona: "var(--deck-persona)",
  lore: "var(--deck-lorebook)",
  scene: "var(--stage-soft)",
};
export const ownerColor = (o: Owner): string => OWNER_COLOR[o];

/**
 * Wires into one preset's marker blocks: the context character and persona (only when their piece is a
 * node on the canvas), and the lore pass into both world info slots. The scene has no node in v1, so
 * chat history wires nowhere; its row says which scene feeds it.
 */
export function markerWires(
  presetKey: string,
  rows: readonly PipelineRow[],
  context: PipelineContext,
  onCanvas: ReadonlySet<string>,
): PipelineWire[] {
  const to = pipeKey(presetKey);
  const out: PipelineWire[] = [];
  rows.forEach((row, block) => {
    if (!row.marker || !row.owner || !row.on) return;
    const from = row.owner === "lore" ? LORE_KEY
      : row.owner === "character" && context.character ? keyOf(context.character.id, "character")
      : row.owner === "persona" && context.persona ? keyOf(context.persona.id, "persona")
      : null;
    if (!from || (row.owner !== "lore" && !onCanvas.has(from))) return;
    out.push({ id: `${from}>${to}>${row.id}`, from, block, to, color: OWNER_COLOR[row.owner], dashed: false });
  });
  return out;
}

/* ---------- the request node ---------- */

export type ForecastState =
  | { t: "none" }
  | { t: "loading" }
  | { t: "ready"; forecast: SceneForecast }
  | { t: "error"; message: string };

export interface RequestView {
  basis: "forecast" | "dry";
  messages: DryMessage[];
  tokens: number;
  /** the node's two meta lines */
  lines: [string, string];
  /** said above the Preview text */
  notes: string[];
}

const DRY_NOTE = "A dry run from the pieces on the canvas: an estimate. Macros stay literal and the chat history is empty.";

export const tokLabel = (n: number): string => `~${n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n}`;

/**
 * What the Request node shows and previews: the picked scene's forecast when it is ready, otherwise the
 * dry run, always saying which one it is (and why, when a scene was picked but could not be forecast).
 */
export function requestView(hasScene: boolean, forecast: ForecastState, dry: { messages: DryMessage[]; tokens: number } | null): RequestView {
  if (hasScene && forecast.t === "ready") {
    const f = forecast.forecast;
    return {
      basis: "forecast",
      messages: f.messages,
      tokens: f.tokens,
      lines: [`${tokLabel(f.tokens)} tok of ${tokLabel(f.window.context)}`, `model: ${f.model}`],
      notes: ["The scene's own request, as a send would build it now.", ...f.notes],
    };
  }
  const why = !hasScene ? [] : forecast.t === "error" ? [`No forecast for this scene (${forecast.message}). Showing the dry run instead.`] : ["Asking the scene for its forecast. Showing the dry run meanwhile."];
  if (!dry) return { basis: "dry", messages: [], tokens: 0, lines: ["no preset on the canvas", "bring a preset up to build"], notes: why };
  return { basis: "dry", messages: dry.messages, tokens: dry.tokens, lines: [`${tokLabel(dry.tokens)} tok (estimate)`, "dry run from the canvas"], notes: [...why, DRY_NOTE] };
}

/* ---------- the layer's model ---------- */

export interface PresetModel { key: string; piece: StudioEntitySummary; summary: PipelineSummary }
export interface PipelineModel {
  presets: PresetModel[];
  /** the preset the request node builds from: the picked scene's when it is on the canvas, else the one chosen on the Request node, else the first */
  active: PresetModel | null;
  request: RequestView;
  defaults: Record<string, Pt>;
}

export function pipelineModel(input: {
  presets: readonly { piece: StudioEntitySummary; body: unknown }[];
  scenePresetId: string | undefined;
  /** the preset picked on the Request node when there is no scene (ignored once a scene names its own) */
  chosenPresetId?: string;
  sources: PipelineSources;
  hasScene: boolean;
  forecast: ForecastState;
}): PipelineModel {
  const presets = input.presets.flatMap(({ piece, body }): PresetModel[] =>
    isRecord(body) && Array.isArray(body["prompts"])
      ? [{ key: keyOf(piece.id, piece.kind), piece, summary: pipelineRows(body as unknown as PresetBody, input.sources) }]
      : []);
  const active = presets.find((p) => p.piece.id === input.scenePresetId)
    ?? presets.find((p) => p.piece.id === input.chosenPresetId)
    ?? presets[0] ?? null;
  return {
    presets,
    active,
    request: requestView(input.hasScene, input.forecast, active ? dryRequest(active.summary) : null),
    defaults: { ...pipelineLayout(presets.map((p) => ({ key: p.key, blocks: p.summary.blocks }))), ...featureLayout() },
  };
}

/* ---------- feature markers (.claude/plans/prompt-placement.md section 2: Nodes edits the preset's markers) ---------- */

export const FEATURE_H = 112;
/** A feature node's port row: the last row, the height of a piece node's port row (geometry.ts ROW_H). */
export const FEATURE_PORT_H = 26;
/** Where a feature's wire leaves its port. */
export const featureOut = (at: Pt): Pt => [at[0] + ENGINE_W, at[1] + FEATURE_H - FEATURE_PORT_H / 2];
/** A feature's wire: to the marker's block in a preset, or to the Request when it keeps its own spot. */
export const featureWireId = (slot: FeatureMarkerSlot, to: string): string => `feature:${slot}>${to}`;
/** The feature and the preset key a feature wire names, or null for any other wire (the Request's has no preset). */
export function featureWire(id: string): { slot: FeatureMarkerSlot; presetKey: string | null } | null {
  const m = /^feature:([^>]+)>(.+)$/.exec(id);
  if (!m || !isFeatureMarkerSlot(m[1])) return null;
  return { slot: m[1], presetKey: m[2] === "request" ? null : m[2]! };
}
/** The block a world point is over on the topmost preset there (the last drawn), or null: a point on that preset's header or foot hits nothing below it. */
export function blockUnder(presets: readonly { key: string; at: Pt; blocks: number }[], pt: Pt): { key: string; row: number } | null {
  for (const p of [...presets].reverse()) {
    const inside = pt[0] >= p.at[0] && pt[0] <= p.at[0] + PIPE_W && pt[1] >= p.at[1] && pt[1] <= p.at[1] + pipeHeight(p.blocks);
    if (!inside) continue;
    const row = blockAt(p.at, p.blocks, pt);
    return row === null ? null : { key: p.key, row };
  }
  return null;
}
/** The block row of an expanded preset under a world point, or null when the point is not on one. */
export function blockAt(at: Pt, blocks: number, pt: Pt): number | null {
  if (pt[0] < at[0] || pt[0] > at[0] + PIPE_W) return null;
  const row = Math.floor((pt[1] - at[1] - PIPE_HEAD_H) / BLOCK_H);
  return row >= 0 && row < blocks ? row : null;
}
export const featureKey = (slot: FeatureMarkerSlot): string => `feature:${slot}`;
const FEATURE_COLOR: Readonly<Record<FeatureMarkerSlot, string>> = {
  trackers: "var(--deck-persona)",
  linkedTrackers: "var(--deck-persona)",
  storyboards: "var(--deck-lorebook)",
};
export const featureColor = (slot: FeatureMarkerSlot): string => FEATURE_COLOR[slot];

/** The row each feature's marker stands at in one preset's build order, or null where the feature keeps its own spot. */
export function featureRows(rows: readonly PipelineRow[]): Record<FeatureMarkerSlot, number | null> {
  const out = Object.fromEntries(FEATURE_MARKER_SLOTS.map((slot) => [slot, null])) as Record<FeatureMarkerSlot, number | null>;
  rows.forEach((row, i) => { if (row.fills) out[row.fills] = i; });
  return out;
}

/** Default spots for the feature nodes: a column under the Lore pass. */
export function featureLayout(): Record<string, Pt> {
  const x0 = 40 + 3 * COL_W;
  return Object.fromEntries(FEATURE_MARKER_SLOTS.map((slot, i) => [featureKey(slot), [x0, 60 + LORE_H + 24 + i * (FEATURE_H + 16)] as Pt]));
}
