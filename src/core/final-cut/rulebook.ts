/**
 * A preset as a Custom Agent's rulebook (RoleCall lib/post-gen-actions/service.ts:1596-1619): the preset's enabled prompt entries,
 * each as a rule for editing the reply, at most 30 entries, 4,000 characters each and 24,000 in all. A person's per-entry switch
 * (`customPresetPromptStates`, by entry id) wins over the entry's own; a marker or an empty entry is no rule.
 */
import type { PresetBody } from "../../entities/preset/schema";
import type { RulebookEntry } from "./prompts";

export const RULEBOOK_ENTRIES = 30;
export const RULEBOOK_ENTRY_CHARS = 4_000;
export const RULEBOOK_CHARS = 24_000;

export function rulebookOf(preset: Pick<PresetBody, "prompts"> | null | undefined, states: Readonly<Record<string, boolean>> | undefined): RulebookEntry[] {
  const out: RulebookEntry[] = [];
  let total = 0;
  for (const prompt of preset?.prompts ?? []) {
    if (out.length >= RULEBOOK_ENTRIES || total >= RULEBOOK_CHARS) break;
    const content = prompt.marker ? "" : prompt.content.trim();
    if (!content || !(states?.[prompt.id] ?? prompt.enabled)) continue;
    const clipped = content.slice(0, Math.min(RULEBOOK_ENTRY_CHARS, RULEBOOK_CHARS - total));
    total += clipped.length;
    out.push({ id: prompt.id, name: prompt.name || "Prompt entry", content: clipped });
  }
  return out;
}
