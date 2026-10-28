/**
 * How RoleCall runs macros during assembly (`prompt-assembly.ts` sections 3 and 10, at the pin):
 * the full engine first, then a second pass for its own names the engine does not know ({{lore}},
 * {{message_history}}, {{character}}, {{phi}}, and the rest), each result memoized for the turn.
 * Stored history runs read-only, seeded from its own text so a {{pick}} in an old message never
 * re-rolls, and never fires an old {{setvar}} again.
 */
import { createDefaultContext, processMacros, type MacroContext } from "../macros";
import type { MacroSink } from "./macro-report";

/** Where RoleCall's {{message_history}} expands, replaced after the macro pass. */
export const HISTORY_MARKER = "__INJECT_MESSAGE_HISTORY__";

const LEGACY_MACRO = /\{\{([a-zA-Z_.]+)\}\}/gi;

export interface MacroPass {
  /** Prompt text, the greeting, and the current message: macros may change variables. */
  write(text: string): string;
  /** Stored history: read-only, with a seed of its own. */
  historical(text: string): string;
  /** A text this turn builds from state it reads (a tracker's template): read-only like history, but its macro errors and uses go to the turn's macro report like any other. */
  reported(text: string): string;
  /** RoleCall's own macro names, filled in as assembly learns them. */
  legacy: Record<string, string>;
  context: MacroContext;
}

/** RoleCall's per-message seed: a 32-bit string hash of the text, never zero. */
function seedOf(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

/** `sink` watches the write passes only: stored history runs read-only and says nothing about this turn. */
export function macroPass(overrides: Partial<MacroContext>, legacy: Record<string, string>, randomSeed: number, sink?: MacroSink): MacroPass {
  const context = createDefaultContext(overrides);
  const cache = new Map<string, string>();
  const readOnlyCache = new Map<string, string>();
  // RoleCall's dice come from one ambient generator across the turn; here each write pass takes the
  // next seed, so two different texts never roll alike and the turn stays reproducible.
  let calls = 0;
  const isLegacy = (macro: string): boolean => {
    const m = /^{{([a-zA-Z_.]+)}}$/.exec(macro);
    return m !== null && Object.hasOwn(legacy, m[1]!.toLowerCase());
  };
  const secondPass = (text: string) => text.replace(LEGACY_MACRO, (match, name: string) => legacy[name.toLowerCase()] ?? match);

  const run = (text: string, memo: Map<string, string>, evaluate: (t: string) => string): string => {
    if (!text || text.length < 4) return text;
    const hit = memo.get(text);
    if (hit !== undefined) return hit;
    const out = text.includes("{{") ? secondPass(evaluate(text)) : text;
    memo.set(text, out);
    return out;
  };

  return {
    legacy,
    context,
    write: (text) => run(text, cache, (t) => {
      const done = processMacros(t, { ...context, randomSeed: randomSeed + calls++ });
      // A name the second pass fills in ({{lore}}, {{summary}}) fails the engine first and is not a failure.
      sink?.add({ ...done, errors: done.errors.filter((e) => !isLegacy(e.macro)) });
      return done.text;
    }),
    reported: (text) => {
      const done = processMacros(text, { ...context, readOnly: true, randomSeed: seedOf(text), localVariables: new Map(context.localVariables) });
      sink?.add({ ...done, errors: done.errors.filter((e) => !isLegacy(e.macro)) });
      return secondPass(done.text);
    },
    historical: (text) =>
      run(text, readOnlyCache, (t) =>
        processMacros(t, { ...context, readOnly: true, randomSeed: seedOf(t), localVariables: new Map(context.localVariables) }).text,
      ),
  };
}
