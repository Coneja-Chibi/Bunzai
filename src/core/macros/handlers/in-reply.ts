/**
 * In-reply ask macros: RoleCall's handler inside ADR-012.
 *
 * "Tell the narrator to write this, and when it writes that, set a variable." One macro generates
 * both halves: the instruction rendered into the prompt, and the capture registration a
 * post-generation hook runner would consume to commit the answer, strip the tag, and clear the ask.
 *
 *   {{pick_in_reply::Pick the next Director::HEARTTHROB::SCORIA::into=session:callsign}}
 *   {{ask_in_reply::Summarize her mood in one word::into=session:mood}}
 *   {{pick_in_reply_or_keep::...::into=session:callsign}}  (skips if already set)
 *
 * No extra model call: the answer rides the main generation. defers
 * RoleCall's post-generation hook runner (hooks.ts / runMacroHooks) to a later step, so this file
 * takes only the two pieces these handlers need from it, ported verbatim:
 *
 * - `IN_REPLY_ASKS_KEY`: the hidden local-variable key the registry lives under.
 * - `InReplyAsk`: the shape of one registered ask.
 *
 * Everything else in hooks.ts (parsing the reply, committing the answer, stripping the tag) is not
 * here; a later port of the hook runner should import these two from this file rather than
 * redeclaring them.
 *
 * Changed from RoleCall, and why: RC's `resolveVar` (handlers/variables.ts) and `readScopedValue`/
 * `isEmptyValue` (handlers/state.ts) are reused as-is: `resolveVar` is a thin wrapper this port
 * doesn't need (its work is `resolveVariableTarget` from ../scopes, already the ported core), and
 * `readScopedValue`/`isEmptyValue` come from ./state, the state-family port of RC's state.ts.
 */
import { resolveVariableTarget } from "../scopes";
import type { MacroContext, MacroDefinition, MacroResult, MacroVariableValue } from "../types";
import { isRecord } from "../../guards";
import { isEmptyValue, readScopedValue } from "./state";

/** Registry variable the in-reply macros write; a later hook runner consumes it. */
export const IN_REPLY_ASKS_KEY = "__in_reply_asks";

export interface InReplyAsk {
  /** scope:key the answer commits to. */
  into: string;
  /** Options for pick-mode asks. */
  options?: string[];
  mode: "pick" | "ask";
  /** Keep the tag visible in the reply instead of stripping it. */
  visible?: boolean;
}

const NAMED_ARG_RE = /^(into|tag|visible)\s*=\s*(.+)$/;

interface ParsedAskArgs {
  question: string;
  options: string[];
  into?: string;
  tag?: string;
  visible: boolean;
}

function parseAskArgs(args: string[]): ParsedAskArgs {
  const positional: string[] = [];
  let into: string | undefined;
  let tag: string | undefined;
  let visible = false;

  for (const arg of args) {
    const named = NAMED_ARG_RE.exec(arg);
    if (named) {
      const value = (named[2] ?? "").trim();
      if (named[1] === "into") into = value;
      else if (named[1] === "tag") tag = value;
      else visible = value.toLowerCase() === "true";
    } else {
      positional.push(arg);
    }
  }

  return { question: positional[0] ?? "", options: positional.slice(1).filter((o) => o.length > 0), into, tag, visible };
}

/** Default tag from the target key: session:callsign -> CALLSIGN. */
function deriveTag(into: string): string {
  const bare = into.includes(":") ? into.slice(into.indexOf(":") + 1) : into;
  const tag = bare.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return tag || "ANSWER";
}

function renderInstruction(parsed: ParsedAskArgs, tag: string, mode: "pick" | "ask"): string {
  const what = mode === "pick" ? "choice" : "answer";
  const choose = mode === "pick" && parsed.options.length > 0 ? ` choosing exactly one of: ${parsed.options.join(", ")}.` : ".";
  const hidden = parsed.visible ? "" : " That line is machine-read and will be removed from the visible reply.";
  return `(Directive: ${parsed.question} Begin your reply with the line "[SET ${tag}: <your ${what}>]"${choose}${hidden})`;
}

/** Build the side effect merging this ask into the registry variable. */
function registerAsk(context: MacroContext, tag: string, ask: InReplyAsk): MacroResult["sideEffects"] {
  const existing = context.localVariables.get(IN_REPLY_ASKS_KEY)?.value;
  const registry: Record<string, MacroVariableValue> = isRecord(existing) ? { ...existing } : {};
  registry[tag] = ask as unknown as MacroVariableValue;
  return [{ type: "setLocalVar", key: IN_REPLY_ASKS_KEY, value: registry }];
}

function makeAskHandler(mode: "pick" | "ask", keepExisting: boolean) {
  return (args: string[], context: MacroContext): MacroResult => {
    const parsed = parseAskArgs(args);
    if (!parsed.question) return { value: "", success: false, error: "A question is required" };
    if (!parsed.into) return { value: "", success: false, error: "into=scope:key is required" };
    if (mode === "pick" && parsed.options.length === 0) return { value: "", success: false, error: "pick_in_reply requires at least one option" };

    if (keepExisting && !isEmptyValue(readScopedValue(parsed.into, context))) return { value: "", success: true };

    // Historical replay: never re-register asks or re-render instructions.
    if (context.readOnly) return { value: "", success: true };

    // Normalize `into` to its resolved storage form so a later capture commit and any reader agree
    // on the key.
    const target = resolveVariableTarget(parsed.into, context);
    const into = (target.isGlobal ? "global:" : "") + target.key;

    const tag = parsed.tag ? parsed.tag.toUpperCase() : deriveTag(parsed.into);
    const ask: InReplyAsk = {
      into,
      mode,
      ...(mode === "pick" ? { options: parsed.options } : {}),
      ...(parsed.visible ? { visible: true } : {}),
    };

    return { value: renderInstruction(parsed, tag, mode), success: true, sideEffects: registerAsk(context, tag, ask) };
  };
}

const pickInReplyMacro: MacroDefinition = {
  name: "pick_in_reply",
  description: "Have the narrator pick one option in its reply; the answer lands in a variable. {{pick_in_reply::question::opt1::opt2::into=scope:key}}",
  args: [
    { name: "question", description: "What to decide", required: true },
    { name: "options", description: "Options (positional)", required: true },
    { name: "into", description: "into=scope:key target variable", required: true },
  ],
  category: "preset",
  hasSideEffects: true,
  handler: makeAskHandler("pick", false),
};

const askInReplyMacro: MacroDefinition = {
  name: "ask_in_reply",
  description: "Have the narrator answer freeform in its reply; the answer lands in a variable. {{ask_in_reply::question::into=scope:key}}",
  args: [
    { name: "question", description: "What to answer", required: true },
    { name: "into", description: "into=scope:key target variable", required: true },
  ],
  category: "preset",
  hasSideEffects: true,
  handler: makeAskHandler("ask", false),
};

const pickInReplyOrKeepMacro: MacroDefinition = {
  name: "pick_in_reply_or_keep",
  description: "Like pick_in_reply, but renders nothing when the target variable is already set.",
  args: [
    { name: "question", description: "What to decide", required: true },
    { name: "options", description: "Options (positional)", required: true },
    { name: "into", description: "into=scope:key target variable", required: true },
  ],
  category: "preset",
  hasSideEffects: true,
  handler: makeAskHandler("pick", true),
};

export const IN_REPLY_MACROS: readonly MacroDefinition[] = [pickInReplyMacro, askInReplyMacro, pickInReplyOrKeepMacro];
