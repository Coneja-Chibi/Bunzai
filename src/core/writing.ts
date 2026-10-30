/**
 * Writing setups: the kinds a scene's Writing slot holds (every kind whose kind.ts gives `asPreset`: presets, Script
 * Sheets, later promptbooks). They are separate kinds that read one way: as the preset they send, so the turn, Final
 * Cut, the Booth and export need no case for each.
 */
import type { PresetBody } from "../entities/preset/schema";
import { KINDS, kindOf } from "../generated/kinds";

/** The writing kinds, in display order. */
export const WRITING_KINDS: readonly string[] = KINDS.filter((k) => k.asPreset).map((k) => k.id);

export const isWritingKind = (kind: unknown): kind is string => typeof kind === "string" && WRITING_KINDS.includes(kind);

/** A writing piece as the preset it sends, or null for a kind that is not a writing setup. */
export function asPresetBody(kind: string, body: unknown): PresetBody | null {
  const asPreset = kindOf(kind)?.asPreset as ((b: unknown) => PresetBody) | undefined;
  return asPreset ? asPreset(body) : null;
}

/** Why a writing piece cannot be sent as it is, or null (a Script Sheet that breaks its rules). */
export function sendProblem(kind: string, body: unknown): string | null {
  const check = kindOf(kind)?.sendProblem as ((b: unknown) => string | null) | undefined;
  return check ? check(body) : null;
}

/** The kind every writing setup reads as (each kind's `asPreset`). */
const BASE = "preset";

/**
 * The formats that can write a piece of `kind`: its own, and for a writing setup, the preset format of every platform
 * that has none of its own (the piece is written as the preset it sends). The export dialog, the Press and the export
 * route all ask this, so a Script Sheet reaches every platform a preset does.
 */
export function formatsFor<F extends { kind: string; friendly: string }>(formats: readonly F[], kind: string): F[] {
  const own = formats.filter((f) => f.kind === kind);
  if (kind === BASE || !isWritingKind(kind) || kindOf(kind)?.presetExports === false) return own;
  const covered = new Set(own.map((f) => f.friendly));
  return [...own, ...formats.filter((f) => f.kind === BASE && !covered.has(f.friendly))];
}

/** A writing piece made ready for a preset format: as the preset it sends; any other piece is left as it is. */
export function forFormatKind<E extends { kind: string; body: unknown }>(entity: E, formatKind: string): E {
  if (entity.kind === formatKind || formatKind !== BASE || !isWritingKind(entity.kind)) return entity;
  if (kindOf(entity.kind)?.presetExports === false) throw new Error("A Promptbook's phases cannot be exported as a single preset. Choose Bunzai Promptbook to keep the workflow.");
  return { ...entity, kind: BASE, body: asPresetBody(entity.kind, entity.body) };
}
