/**
 * Runtime/environment macros: RoleCall's handler inside
 * ADR-012. System and environment information: max prompt size, mobile flag, last generation type,
 * the chat input field, banned-text and lorebook-outlet markers.
 *
 * `RuntimeContext` fields RoleCall's assembler supplies are not on Bunraku's MacroContext; RoleCall
 * reaches them through a cast, kept here as in stats.ts, for the same reason (plain values, not a
 * host surface).
 *
 * Dropped from RoleCall: `{{orisonPreferences}}`/`{{orisonPreferenceBlock}}` and the two
 * `RuntimeContext` fields behind them. Orison preference memory is on pipeline-hooks.md's stripped
 * list ("Stripped in the port"); their four aliases
 * (orisonprefs/orisonmemory/orisonprefsblock/orisonmemoryblock) are unclaimed by any other family
 * (checked against RoleCall handlers). Their macros are simply unknown now, as
 * pipeline-hooks.md intends for every stripped feature.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "../types";

/** Extended context for runtime-specific fields. */
export interface RuntimeContext extends MacroContext {
  maxPromptTokens?: number;
  isMobile?: boolean;
  lastGenerationType?: "chat" | "impersonate" | "continue" | "regenerate" | "swipe" | "quiet";
  inputContent?: string;
}

/** {{maxPrompt}}. Maximum prompt context size in tokens for the current model/preset; defaults to 4096. */
const maxPromptMacro: MacroDefinition = {
  name: "maxprompt",
  aliases: ["maxcontext", "contextsize"],
  description: "Maximum prompt context size in tokens",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: (ctx.maxPromptTokens ?? 4096).toString(), success: true };
  },
};

/** {{isMobile}}. Whether the user is on a mobile device. */
const isMobileMacro: MacroDefinition = {
  name: "ismobile",
  aliases: ["mobile"],
  description: "Whether the user is on a mobile device",
  category: "identity",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: ctx.isMobile ? "true" : "false", success: true };
  },
};

/** {{lastGenerationType}}. Type of the last generation request (chat, impersonate, continue, ...). */
const lastGenerationTypeMacro: MacroDefinition = {
  name: "lastgenerationtype",
  aliases: ["gentype", "generationtype"],
  description: "Type of last generation (chat, impersonate, continue, etc.)",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: ctx.lastGenerationType || "chat", success: true };
  },
};

/** {{input}}. Content currently in the chat input field; useful for prompt previews and testing. */
const inputMacro: MacroDefinition = {
  name: "input",
  aliases: ["chatinput"],
  description: "Content in the chat input field",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as RuntimeContext;
    return { value: ctx.inputContent || "", success: true };
  },
};

/**
 * {{banned::text}}. Marks text as banned for text completion. Renders empty; the actual banning is
 * handled by the backend when it processes the prompt. Still parsed so it can be extracted from
 * prompts.
 */
const bannedMacro: MacroDefinition = {
  name: "banned",
  aliases: ["ban"],
  description: "Mark text as banned for text completion",
  args: [{ name: "text", description: "Text to ban", required: true }],
  category: "text",
  handler: (): MacroResult => ({ value: "", success: true }),
};

/**
 * {{outlet::name}}. A named anchor point where world info entries can be inserted. Outlets are
 * placeholders replaced by the context builder when it inserts world info; this returns a marker
 * the context builder recognizes later.
 */
const outletMacro: MacroDefinition = {
  name: "outlet",
  description: "Named anchor for world info/lorebook insertion",
  args: [{ name: "name", description: "Outlet name", required: true }],
  category: "lorebook",
  handler: (args: string[]): MacroResult => {
    const outletName = args[0] || "default";
    return { value: `<!-- OUTLET:${outletName} -->`, success: true };
  },
};

export const RUNTIME_MACROS: readonly MacroDefinition[] = [
  maxPromptMacro,
  isMobileMacro,
  lastGenerationTypeMacro,
  inputMacro,
  bannedMacro,
  outletMacro,
];
