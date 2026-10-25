/**
 * User-defined macro functions: RoleCall's
 * handler, inside ADR-012. Define reusable macro "functions" with positional arguments:
 *
 *   Define:  {{macro::name::body with {{$1}} placeholders}}
 *   Call:    {{macro::name::arg1::arg2}}
 *
 * Definitions live in `context.userMacros`, ephemeral: one prompt-assembly pass, never persisted.
 */
import type { MacroContext, MacroDefinition, MacroResult } from "../types";

/**
 * {{macro::name::body}} defines a user macro. {{macro::name::arg1::arg2}} calls a previously
 * defined one. Disambiguation: if `name` already exists in userMacros, call; otherwise, 2+ args
 * define (args[1] is the body); 1 arg is an error (undefined macro).
 *
 * Positional placeholders {{$1}}, {{$2}}, etc. are string-replaced at call time. Unreplaced
 * placeholders are stripped to empty string.
 */
const userMacro: MacroDefinition = {
  name: "macro",
  description: "Define or call a user-defined macro function",
  category: "variables",
  args: [
    { name: "name", description: "Macro name", required: true },
    { name: "body/args", description: "Body (when defining) or positional arguments (when calling)", required: false },
  ],
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length === 0) return { value: "", success: false, error: "Macro name required" };

    const name = args[0]!.toLowerCase().trim();

    if (context.userMacros.has(name)) {
      let body = context.userMacros.get(name)!;
      for (let i = 1; i < args.length; i++) body = body.replaceAll(`{{$${i}}}`, args[i]!);
      body = body.replace(/\{\{\$\d+\}\}/g, "");
      return { value: body, success: true };
    }

    if (args.length < 2) return { value: "", success: false, error: `Undefined macro: ${name}` };

    context.userMacros.set(name, args[1]!);
    return { value: "", success: true };
  },
};

export const USER_MACROS_MACROS: readonly MacroDefinition[] = [userMacro];
