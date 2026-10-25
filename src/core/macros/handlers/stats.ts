/**
 * Stats and meta macros: RoleCall's handler inside ADR-012.
 * Token counts, budgets, and API cost information. These fields (token counts, budgets, cost rates)
 * are not on Bunraku's MacroContext; RoleCall reaches them through a cast, and `StatsMacroContext`
 * keeps that pattern here rather than adding fields to the shared context (its header: "no host
 * surface on MacroContext... a handler that reaches outside needs its own ADR" -- these fields are
 * plain numbers, not a host surface, so the cast is the right seam, matching RoleCall's own choice).
 *
 * Changed from RoleCall (ADR-012): RoleCall formats with a bare `.toLocaleString()`, which reads the
 * host's locale. Here numbers format in `context.locale`, "en-US" when absent, like the time macros.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "../types";

/** Extended context for stats macros: token/cost fields RoleCall's assembler supplies at build time. */
export interface StatsMacroContext extends MacroContext {
  tokenCount?: number;
  tokenBudget?: number;
  responseTokens?: number;
  sessionTokens?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

/** {{tokenCount}}. Current prompt token estimate. */
const tokenCountMacro: MacroDefinition = {
  name: "tokencount",
  aliases: ["tokens", "prompttokens"],
  description: "Current prompt token count (estimated)",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    return { value: (ctx.tokenCount ?? 0).toLocaleString(ctx.locale ?? "en-US"), success: true };
  },
};

/** {{tokenBudget}}. Maximum context size. Owns `maxcontext`/`contextsize`; runtime.ts's maxprompt also aliases them and loses. */
const tokenBudgetMacro: MacroDefinition = {
  name: "tokenbudget",
  aliases: ["maxcontext", "contextsize"],
  description: "Maximum context size in tokens",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    return { value: (ctx.tokenBudget ?? 0).toLocaleString(ctx.locale ?? "en-US"), success: true };
  },
};

/** {{tokenRemaining}}. Available tokens remaining. */
const tokenRemainingMacro: MacroDefinition = {
  name: "tokenremaining",
  aliases: ["tokensremaining", "remainingtokens"],
  description: "Tokens remaining in context budget",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    const remaining = (ctx.tokenBudget ?? 0) - (ctx.tokenCount ?? 0);
    return { value: Math.max(0, remaining).toLocaleString(ctx.locale ?? "en-US"), success: true };
  },
};

/** {{responseTokens}}. Maximum response tokens allowed. */
const responseTokensMacro: MacroDefinition = {
  name: "responsetokens",
  aliases: ["maxtokens", "maxresponse"],
  description: "Maximum response tokens setting",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    return { value: (ctx.responseTokens ?? 0).toLocaleString(ctx.locale ?? "en-US"), success: true };
  },
};

/** {{sessionTokens}}. Total tokens used this session (input + output). */
const sessionTokensMacro: MacroDefinition = {
  name: "sessiontokens",
  aliases: ["totaltokens"],
  description: "Total tokens used this session (input + output)",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    return { value: (ctx.sessionTokens ?? 0).toLocaleString(ctx.locale ?? "en-US"), success: true };
  },
};

/** {{costEstimate}}. Estimated API cost for the session, roughly split 60% input / 40% output. */
const costEstimateMacro: MacroDefinition = {
  name: "costestimate",
  aliases: ["cost", "apicost"],
  description: "Estimated API cost for this session",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    if (!ctx.costPerInputToken || !ctx.costPerOutputToken) return { value: "N/A", success: true };

    const sessionTokens = ctx.sessionTokens ?? 0;
    const inputTokens = Math.floor(sessionTokens * 0.6);
    const outputTokens = Math.floor(sessionTokens * 0.4);
    const cost = inputTokens * ctx.costPerInputToken + outputTokens * ctx.costPerOutputToken;

    if (cost < 0.01) return { value: "<$0.01", success: true };
    return { value: `$${cost.toFixed(2)}`, success: true };
  },
};

/** {{contextUsage}}. Context usage as a percentage. */
const contextUsageMacro: MacroDefinition = {
  name: "contextusage",
  aliases: ["usage"],
  description: "Context usage as percentage",
  category: "chat",
  handler: (_args: string[], context: MacroContext): MacroResult => {
    const ctx = context as StatsMacroContext;
    const budget = ctx.tokenBudget ?? 0;
    const count = ctx.tokenCount ?? 0;
    if (budget <= 0) return { value: "0%", success: true };
    return { value: `${Math.round((count / budget) * 100)}%`, success: true };
  },
};

export const STATS_MACROS: readonly MacroDefinition[] = [
  tokenCountMacro,
  tokenBudgetMacro,
  tokenRemainingMacro,
  responseTokensMacro,
  sessionTokensMacro,
  costEstimateMacro,
  contextUsageMacro,
];
