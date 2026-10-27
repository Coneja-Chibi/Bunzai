/** Every writing setup the library holds (presets, Script Sheets: core/writing.ts), in one list: what the scene's Writing pickers offer. */
import type { AppContext, StudioEntitySummary } from "../app-contract";
import { asPresetBody, WRITING_KINDS } from "../../core/writing";
import type { PresetBody } from "../../entities/preset/schema";
import { isRecord } from "../../core/guards";
import { kindOf } from "../../generated/kinds";

export const listWritingSetups = (api: Pick<AppContext["api"], "listEntities">): Promise<StudioEntitySummary[]> =>
  Promise.all(WRITING_KINDS.map((kind) => api.listEntities(kind))).then((lists) => lists.flat());

/** A scene's writing setup read as the preset it sends; null when it is not one. Read errors reach the caller. */
export async function readSetupBody(api: Pick<AppContext["api"], "getEntity">, s: { kind: string; id: string }): Promise<PresetBody | null> {
  const e = await api.getEntity(`kind=${encodeURIComponent(s.kind)}&id=${encodeURIComponent(s.id)}`);
  return isRecord(e) ? asPresetBody(s.kind, e["body"]) : null;
}

/** A picker's value for one setup, "kind:id" (an id alone is not unique across kinds). */
export const setupValue = (s: { kind: string; id: string }): string => `${s.kind}:${s.id}`;
/** The setup a picker value names, or null for "" (none). */
export const setupOf = (value: string): { kind: string; id: string } | null => {
  const at = value.indexOf(":");
  return at < 0 ? null : { kind: value.slice(0, at), id: value.slice(at + 1) };
};
/** A setup's label in a picker: its name, then its kind when it is not a preset ("Terse (Script Sheet)"). */
export const setupLabel = (s: { kind: string; name: string }): string => (s.kind === "preset" ? s.name : `${s.name} (${kindOf(s.kind)?.singular ?? s.kind})`);
