/**
 * Preset toggle-introspection macros: "which prompts are toggled on?" as a first-class primitive,
 * so a roster section can read the live prompt list at render time instead of registering setvars
 * or counting separators by hand.
 *
 *   {{enabled::prompt_id}}                  -> "true" / "false"
 *   {{enabled_any::id1::id2}}               -> "true" if ANY enabled
 *   {{enabled_all::id1::id2}}               -> "true" if ALL enabled
 *   {{enabled_count::prefix}}               -> number of enabled matches
 *   {{enabled_list::prefix}}                -> JSON list of identifiers
 *   {{enabled_list::prefix::field}}         -> JSON list of metadata field values
 *   {{join_enabled::prefix::field::sep}}    -> joined field values, no dangling separator
 *   {{when_enabled::id::content}}           -> content only if enabled (lazy)
 *
 * A selector matches a prompt when it equals the prompt's identifier, is a prefix of it, or equals
 * the prompt's `roster` metadata field, so both `hp_dir_` prefix conventions and `roster: director`
 * declarations work.
 *
 * Ported from RoleCall inside
 * ADR-012: no behavior change, only the registration mechanism.
 */
import type { LazyMacroArg, MacroContext, MacroDefinition, MacroResult, MacroVariableValue, PresetPromptInfo } from "../types";
import { formatList, listItemToString } from "../lists";

function allPrompts(context: MacroContext): PresetPromptInfo[] {
  return context.presetPrompts ?? [];
}

/** Does this prompt match the selector (exact id, id prefix, or roster name)? */
export function matchesSelector(prompt: PresetPromptInfo, selector: string): boolean {
  const sel = selector.trim().toLowerCase();
  if (!sel) return false;
  const identifier = prompt.identifier?.toLowerCase() ?? "";
  if (identifier === sel || identifier.startsWith(sel)) return true;
  if (prompt.id.toLowerCase() === sel) return true;
  const roster = prompt.metadata?.roster;
  return typeof roster === "string" && roster.trim().toLowerCase() === sel;
}

/** Enabled prompts matching the selector. */
export function enabledMatching(context: MacroContext, selector: string): PresetPromptInfo[] {
  return allPrompts(context).filter((p) => p.enabled && matchesSelector(p, selector));
}

/** Is the prompt with this exact identifier (or id) enabled? */
function isPromptEnabled(context: MacroContext, idOrIdentifier: string): boolean {
  const sel = idOrIdentifier.trim().toLowerCase();
  return allPrompts(context).some((p) => p.enabled && (p.identifier?.toLowerCase() === sel || p.id.toLowerCase() === sel));
}

/** Read a field from a prompt: metadata first, then the built-ins (id, identifier, name). */
export function promptField(prompt: PresetPromptInfo, field: string): MacroVariableValue | undefined {
  const meta = prompt.metadata?.[field];
  if (meta !== undefined) return meta;
  switch (field) {
    case "id":
      return prompt.id;
    case "identifier":
      return prompt.identifier;
    case "name":
      return prompt.name;
    default:
      return undefined;
  }
}

const enabledMacro: MacroDefinition = {
  name: "enabled",
  aliases: ["is_enabled", "prompt_enabled"],
  description: 'Is the named preset prompt currently toggled on? Returns "true"/"false".',
  args: [{ name: "prompt_id", description: "Prompt identifier", required: true }],
  category: "preset",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const id = args[0];
    if (!id) return { value: "", success: false, error: "Prompt id required" };
    return { value: isPromptEnabled(context, id) ? "true" : "false", success: true };
  },
};

const enabledAnyMacro: MacroDefinition = {
  name: "enabled_any",
  description: "True if ANY of the named prompts are enabled.",
  category: "preset",
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) return { value: "false", success: true };
    return { value: args.some((id) => isPromptEnabled(context, id)) ? "true" : "false", success: true };
  },
};

const enabledAllMacro: MacroDefinition = {
  name: "enabled_all",
  description: "True if ALL of the named prompts are enabled.",
  category: "preset",
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) return { value: "false", success: true };
    return { value: args.every((id) => isPromptEnabled(context, id)) ? "true" : "false", success: true };
  },
};

const enabledCountMacro: MacroDefinition = {
  name: "enabled_count",
  description: "Number of enabled prompts whose id starts with prefix (or whose roster matches).",
  args: [{ name: "prefix", description: "Id prefix or roster name", required: true }],
  category: "preset",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const selector = args[0];
    if (!selector) return { value: "0", success: true };
    return { value: String(enabledMatching(context, selector).length), success: true };
  },
};

const enabledListMacro: MacroDefinition = {
  name: "enabled_list",
  description: "List enabled prompts matching prefix/roster. Optional ::field pulls a metadata field.",
  args: [
    { name: "prefix", description: "Id prefix or roster name", required: true },
    { name: "field", description: "Metadata field to pull (optional)", required: false },
  ],
  category: "preset",
  handler: (args: string[], context: MacroContext): MacroResult => {
    const selector = args[0];
    if (!selector) return { value: "", success: false, error: "Prefix or roster name required" };
    const matched = enabledMatching(context, selector);
    const field = args[1];
    if (field) {
      const values = matched.map((p) => promptField(p, field)).filter((v): v is MacroVariableValue => v !== undefined);
      return { value: formatList(values), success: true };
    }
    return { value: formatList(matched.map((p) => p.identifier)), success: true };
  },
};

/** {{join_enabled::prefix::field::sep}}: the roster one-liner, no dangling separator. */
const joinEnabledMacro: MacroDefinition = {
  name: "join_enabled",
  description: 'Join a metadata field of all enabled prompts matching prefix/roster. {{join_enabled::hp_cw_::label::, }}',
  args: [
    { name: "prefix", description: "Id prefix or roster name", required: true },
    { name: "field", description: 'Metadata field (use "identifier" for ids)', required: false },
    { name: "sep", description: 'Separator (default ", ")', required: false },
  ],
  category: "preset",
  // Lazy so the separator keeps its whitespace: eager args are trimmed, and ", " would become ",".
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const selector = args[0]?.evaluate().trim() ?? "";
    if (!selector) return { value: "", success: false, error: "Prefix or roster name required" };
    const field = args[1]?.evaluate().trim() || "identifier";
    const sep = args.length > 2 ? (args[2]?.evaluate() ?? "") : ", ";
    const values = enabledMatching(context, selector)
      .map((p) => promptField(p, field))
      .filter((v): v is MacroVariableValue => v !== undefined)
      .map(listItemToString)
      .filter((s) => s.length > 0);
    return { value: values.join(sep), success: true };
  },
};

/** {{when_enabled::prompt_id::content}}: content only when enabled; a skipped branch never runs. */
const whenEnabledMacro: MacroDefinition = {
  name: "when_enabled",
  description: "Render content only if the named prompt is enabled.",
  args: [
    { name: "prompt_id", description: "Prompt identifier", required: true },
    { name: "content", description: "Content to render when enabled", required: true },
  ],
  category: "preset",
  lazyHandler: (args: LazyMacroArg[], context: MacroContext): MacroResult => {
    const id = args[0]?.evaluate().trim() ?? "";
    if (!id) return { value: "", success: false, error: "Prompt id required" };
    if (!isPromptEnabled(context, id)) return { value: "", success: true };
    const content = args.slice(1).map((a) => a.raw).join("::");
    return { value: content, success: true };
  },
};

export const PRESET_INTROSPECTION_MACROS: readonly MacroDefinition[] = [
  enabledMacro,
  enabledAnyMacro,
  enabledAllMacro,
  enabledCountMacro,
  enabledListMacro,
  joinEnabledMacro,
  whenEnabledMacro,
];
