/**
 * Which regex rules a scene runs, and at what depth: RoleCall's `display_only` and `prompt_only` placements on Bunzai's rule
 * shape (apps/rc lib/regex/apply-regex.ts:96-130, hooks/scene/useDisplayMessages.ts:329-348, lib/ai/prompt-assembly.ts:3496-3522).
 * Pure selection only; nothing here compiles or runs a rule. Execution is the sandbox worker's alone (ADR-009, AGENTS rule 3).
 */
import type { RegexRule } from "../../entities/regex/schema";

export type ScenePhase = "display" | "prompt";

/** A library regex set as a scene reads it: its rules, and the set-level switch. */
export interface SceneSet {
  /** The set's name, for a list that names it. */
  name?: string;
  id: string;
  rules: readonly RegexRule[];
  enabled?: boolean;
}

/**
 * The rules a scene runs for a phase as one list: sets in the order they were switched on (RoleCall applies scripts in that order),
 * each set's rules by sort order. Ids gain the set's position so two sets may reuse an id, and a condition follows its rule.
 */
export function sceneRules(sets: readonly SceneSet[], phase: ScenePhase): RegexRule[] {
  const out: RegexRule[] = [];
  sets.forEach((set, index) => {
    if (set.enabled === false) return;
    const prefix = (id: string): string => `${index}:${id}`;
    for (const rule of [...set.rules].sort((a, b) => a.sortOrder - b.sortOrder)) {
      if (!rule.enabled || !rule.phases.includes(phase)) continue;
      out.push({ ...rule, id: prefix(rule.id), sortOrder: out.length, ...(rule.condition ? { condition: { ...rule.condition, ruleId: prefix(rule.condition.ruleId) } } : {}) });
    }
  });
  return out;
}

/** RoleCall's `message_roles` filter (prompt placement only): a rule naming roles runs for those; a rule naming none, or a malformed list, runs for all. It rides in the rule's sealed extras. */
export function rulesForRole(rules: readonly RegexRule[], role: string): RegexRule[] {
  return rules.filter((rule) => {
    const roles = rule.extras?.["message_roles"];
    return !Array.isArray(roles) || roles.length === 0 || roles.includes(role);
  });
}

/** Display depth: 0 is the last message of the whole take (RoleCall: messages.length - 1 - index). */
export const displayDepth = (index: number, count: number): number => count - 1 - index;

/**
 * Prompt depth per request entry: the conversation's user and assistant messages counted from the end, the message being answered
 * (or the last one) 0. Preset blocks, notes and lore are not conversation and get null (RoleCall: "never from injected preset system blocks").
 */
export function promptDepths(entries: readonly { role: string; chat: boolean }[]): (number | null)[] {
  const depths: (number | null)[] = entries.map(() => null);
  let depth = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (e.chat && (e.role === "user" || e.role === "assistant")) depths[i] = depth++;
  }
  return depths;
}
