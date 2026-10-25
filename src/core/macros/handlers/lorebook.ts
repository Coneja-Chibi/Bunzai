/**
 * Lorebook macros: entry lookup and stats over what the lorebook engine triggered this run.
 * Ported from RoleCall inside ADR-012: no behavior
 * change, only the registration mechanism and `Math.random()` replaced by the handler's seeded
 * `run.random()` (ADR-012: no ambient randomness), same call, same position in the run.
 *
 * `{{lorebook}}`/`{{outlet}}` need entry metadata (`groupName`, `enabled`, `lorebookId`) the base
 * `MacroContext`'s `triggeredEntries` doesn't carry, so they stay behind the `LorebookMacroContext`
 * cast, RoleCall's own pattern. The other four macros here read `triggeredEntries`/`activeLorebooks`
 * straight off the base context.
 *
 * `outlet` is also declared by the runtime family (another agent's file); lorebook.ts registers
 * first in catalog.ts, so this file's `outlet` is the one that runs. Left as RoleCall has it.
 */
import type { HandlerRun, MacroContext, MacroDefinition, MacroResult } from "../types";

export interface LorebookMacroContext extends MacroContext {
  allLorebookEntries?: Array<{
    id: string;
    title: string;
    content: string;
    groupName?: string | null;
    enabled: boolean;
    lorebookId: string;
  }>;
}

/** {{lorebook::EntryName}}: content of a lorebook entry by (case/whitespace-insensitive) title. */
const lorebookMacro: MacroDefinition = {
  name: "lorebook",
  aliases: ["lore", "entry"],
  description: "Get content of a lorebook entry by name",
  args: [{ name: "name", description: "Entry name/title", required: true }],
  category: "lorebook",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const name = args[0]?.toLowerCase().trim();
    if (!name) return { value: "", success: false, error: "Entry name required" };
    const entries = (context as LorebookMacroContext).allLorebookEntries;
    if (!entries) return { value: "", success: true };
    const entry = entries.find((e) => e.title.toLowerCase().trim() === name);
    return { value: entry?.content ?? "", success: true };
  },
};

/** {{outlet::name}}: ST-compatible alias, same lookup as {{lorebook::name}}. */
const outletMacro: MacroDefinition = {
  name: "outlet",
  description: "Named outlet - same as {{lorebook::name}}",
  args: [{ name: "name", description: "Entry name/title", required: true }],
  category: "lorebook",
  handler: (args: string[], context: MacroContext, run: HandlerRun): MacroResult => lorebookMacro.handler(args, context, run),
};

/** {{lorebookRandom::GroupName}}: a random entry's content from an inclusion group. */
const lorebookRandomMacro: MacroDefinition = {
  name: "lorebookrandom",
  aliases: ["lorerand", "randlore"],
  description: "Get random entry content from an inclusion group",
  args: [{ name: "groupName", description: "Inclusion group name", required: true }],
  category: "lorebook",
  handler: (args: string[], context: MacroContext, run: HandlerRun): MacroResult => {
    const groupName = args[0]?.toLowerCase().trim();
    if (!groupName) return { value: "", success: false, error: "Group name required" };
    const entries = (context as LorebookMacroContext).allLorebookEntries;
    if (!entries) return { value: "", success: true };
    const groupEntries = entries.filter((e) => e.groupName?.toLowerCase().trim() === groupName && e.enabled);
    if (groupEntries.length === 0) return { value: "", success: true };
    const randomIndex = Math.floor(run.random() * groupEntries.length);
    return { value: groupEntries[randomIndex]?.content ?? "", success: true };
  },
};

const lorebookCountMacro: MacroDefinition = {
  name: "lorebookcount",
  aliases: ["lorecount", "activeentries"],
  description: "Number of currently triggered lorebook entries",
  category: "lorebook",
  handler: (_args: string[], context: MacroContext): MacroResult => ({ value: (context.triggeredEntries || []).length.toString(), success: true }),
};

const lorebookTokensMacro: MacroDefinition = {
  name: "lorebooktokens",
  aliases: ["loretokens"],
  description: "Approximate tokens used by triggered entries",
  category: "lorebook",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const totalChars = (context.triggeredEntries || []).reduce((sum, e) => sum + e.content.length, 0);
    return { value: Math.ceil(totalChars / 4).toString(), success: true };
  },
};

const triggeredEntriesMacro: MacroDefinition = {
  name: "triggeredentries",
  aliases: ["triggered", "activeentrynames"],
  description: "Comma-separated list of triggered entry names",
  category: "lorebook",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: (context.triggeredEntries || []).map((e) => e.title).join(", "),
    success: true,
  }),
};

const lorebookListMacro: MacroDefinition = {
  name: "lorebooklist",
  aliases: ["lorebooks"],
  description: "Comma-separated list of active lorebook names",
  category: "lorebook",
  handler: (_args: string[], context: MacroContext): MacroResult => ({
    value: (context.activeLorebooks || []).map((l) => l.name).join(", "),
    success: true,
  }),
};

export const LOREBOOK_MACROS: readonly MacroDefinition[] = [
  lorebookMacro,
  outletMacro,
  lorebookRandomMacro,
  lorebookCountMacro,
  lorebookTokensMacro,
  triggeredEntriesMacro,
  lorebookListMacro,
];
