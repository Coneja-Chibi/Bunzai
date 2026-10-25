/**
 * Wardrobe classification (RoleCall lib/regex/wardrobe.ts): recognizes message-theme rules by shape and sorts them into rack material
 * and props. A theme is a display rule whose replacement opens with a `<style>` payload. An OUTFIT is anchored on a `[KEY: NAME]` tag and is
 * paired with the preset's roster option that casts it; a COMPONENT is an inline fragment that cooperates with others and is never a wear
 * control. Anything ambiguous classifies as a component, so the rack fails closed. Pure: it reads rules and groups, runs nothing.
 */
import type { RegexRule } from "../../entities/regex/schema";
import type { ChoiceGroup } from "../macros/choice-groups";

export type WardrobeKind = "outfit" | "component";

export interface WardrobeEntry {
  ruleId: string;
  ruleName: string;
  displayName: string;
  kind: WardrobeKind;
  /** The join key to the preset's roster option; outfits only. */
  recordName: string | null;
  /** The first distinct hex colors of the CSS payload, in order, for the rack swatch. */
  swatch: string[];
}

const STYLE_OPENING = /^\s*<style[\s>]/i;
/** An outfit anchors on a bracket tag with an uppercase key and a name: [RECORD: HEARTTHROB], [THEME: NOIR]. Stored patterns keep their escapes, so the bracket may arrive as \[. */
const RECORD_ANCHOR = /\\?\[[A-Z][A-Z0-9_]{1,15}:\s*(?:\\s\*)?\s*([A-Za-z0-9_]+)/;
const HEX_COLOR = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi;
const SERIES_PREFIX = /^.*?(?:\u2014|\u2013|-)\s+/;
const SWATCH_MAX = 4;

export const extractRecordName = (find: string): string | null => RECORD_ANCHOR.exec(find)?.[1] ?? null;

export function extractSwatch(replace: string, max: number = SWATCH_MAX): string[] {
  const seen = new Set<string>();
  for (const m of replace.matchAll(HEX_COLOR)) {
    seen.add(m[0].toLowerCase());
    if (seen.size >= max) break;
  }
  return [...seen];
}

/** "VI Record - HEARTTHROB" reads as "Heartthrob" on the rack. */
export function themeDisplayName(label: string): string {
  const stripped = label.replace(SERIES_PREFIX, "").trim() || label.trim();
  return stripped === stripped.toUpperCase() && /^[A-Z0-9_ ]+$/.test(stripped) ? stripped.charAt(0) + stripped.slice(1).toLowerCase() : stripped;
}

/** null when the rule is not theme-shaped; otherwise an entry whose kind decides its surface. */
export function classifyThemeRule(rule: RegexRule): WardrobeEntry | null {
  if (!rule.phases.includes("display") || !STYLE_OPENING.test(rule.replace)) return null;
  const recordName = extractRecordName(rule.find);
  return { ruleId: rule.id, ruleName: rule.label, displayName: themeDisplayName(rule.label), kind: recordName ? "outfit" : "component", recordName, swatch: extractSwatch(rule.replace) };
}

export interface RosterPairing { entry: WardrobeEntry; groupId: string; optionId: string }

/** Pairs outfits to the roster option that carries their record name in its id or label; outfits nothing claims are unpaired and get no wear control. */
export function pairWithRoster(entries: readonly WardrobeEntry[], groups: readonly Pick<ChoiceGroup, "id" | "type" | "options">[]): { paired: RosterPairing[]; unpaired: WardrobeEntry[] } {
  const paired: RosterPairing[] = [];
  const unpaired: WardrobeEntry[] = [];
  for (const entry of entries) {
    if (entry.kind !== "outfit" || !entry.recordName) continue;
    const record = entry.recordName.toUpperCase();
    let match: RosterPairing | null = null;
    for (const group of groups) {
      if (group.type !== "select_many" && group.type !== "select_one") continue;
      const option = group.options.find((o) => o.id.toUpperCase().includes(record) || o.label.toUpperCase().includes(record));
      if (option) { match = { entry, groupId: group.id, optionId: option.id }; break; }
    }
    if (match) paired.push(match); else unpaired.push(entry);
  }
  return { paired, unpaired };
}
