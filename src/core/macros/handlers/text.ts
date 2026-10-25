/**
 * Text-processing macros: case conversion, padding, search/replace, regex, and the bare
 * `{{trim}}` whitespace sentinel. Ported from RoleCall
 * inside ADR-012. Registration is a plain array instead of a `registerMacros` call, and
 * `TRIM_SENTINEL` comes from `../normalize`. Behavior changes: {{repeat}} and {{pad}} refuse a
 * result past the output ceiling before building it, and {{regex}} runs only when
 * `context.allowRegex` is set (types.ts says why); RoleCall always runs it.
 */
import { REGEX_OFF, type MacroContext, type MacroDefinition, type MacroResult } from "../types";
import { TRIM_SENTINEL } from "../normalize";
import { parseListArg, listItemToString } from "../lists";
import { MAX_OUTPUT_CHARS } from "../limits";

const upperMacro: MacroDefinition = {
  name: "upper",
  aliases: ["uppercase", "toupper"],
  description: "Convert text to UPPERCASE",
  args: [{ name: "text", description: "Text to convert", required: true }],
  category: "text",
  handler: (args: string[]): MacroResult => ({ value: (args[0] || "").toUpperCase(), success: true }),
};

const lowerMacro: MacroDefinition = {
  name: "lower",
  aliases: ["lowercase", "tolower"],
  description: "Convert text to lowercase",
  args: [{ name: "text", description: "Text to convert", required: true }],
  category: "text",
  handler: (args: string[]): MacroResult => ({ value: (args[0] || "").toLowerCase(), success: true }),
};

const titleMacro: MacroDefinition = {
  name: "title",
  aliases: ["titlecase"],
  description: "Convert text to Title Case",
  args: [{ name: "text", description: "Text to convert", required: true }],
  category: "text",
  handler: (args: string[]): MacroResult => {
    const text = args[0] || "";
    const titled = text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    return { value: titled, success: true };
  },
};

/**
 * {{trim}} or {{trim::text}} - remove surrounding whitespace.
 *
 * Bare {{trim}} (no args, no {{/trim}} block) follows SillyTavern semantics: collapse the
 * whitespace AROUND the macro's position. The handler can't see its neighbors, so it emits a
 * sentinel that the post-process pass (process.ts) resolves. Paired {{trim}}...{{/trim}} blocks
 * are handled by the parser before this handler is ever consulted.
 */
const trimMacro: MacroDefinition = {
  name: "trim",
  description: "Remove surrounding whitespace",
  args: [{ name: "text", description: "Text to trim (optional)", required: false }],
  category: "text",
  handler: (args: string[]): MacroResult => {
    if (args.length === 0) return { value: TRIM_SENTINEL, success: true };
    return { value: (args[0] || "").trim(), success: true };
  },
};

const newlineMacro: MacroDefinition = {
  name: "newline",
  aliases: ["nl", "br"],
  description: "Insert a newline character",
  category: "text",
  handler: (): MacroResult => ({ value: "\n", success: true }),
};

/** {{space}} or {{space::N}} - insert space character(s). Default is 1, optionally N. */
const spaceMacro: MacroDefinition = {
  name: "space",
  aliases: ["sp"],
  description: "Insert space character(s). Use {{space::N}} for N spaces",
  args: [{ name: "count", description: "Number of spaces (default: 1)", required: false }],
  category: "text",
  handler: (args: string[]): MacroResult => {
    const count = args.length > 0 ? parseInt(args[0] ?? "", 10) : 1;
    if (isNaN(count) || count < 0) return { value: " ", success: true }; // Default to 1 space on invalid input
    if (count > 1000) return { value: "", success: false, error: "Space count too large (max 1000)" };
    return { value: " ".repeat(count), success: true };
  },
};

const noopMacro: MacroDefinition = {
  name: "noop",
  aliases: ["nothing", "empty"],
  description: "Returns empty string (useful as placeholder)",
  category: "text",
  handler: (): MacroResult => ({ value: "", success: true }),
};

const reverseMacro: MacroDefinition = {
  name: "reverse",
  description: "Reverse text",
  args: [{ name: "text", description: "Text to reverse", required: true }],
  category: "text",
  handler: (args: string[]): MacroResult => {
    const text = args[0] || "";
    // Array.from handles Unicode properly.
    return { value: Array.from(text).reverse().join(""), success: true };
  },
};

const commentMacro: MacroDefinition = {
  name: "//",
  aliases: ["comment"],
  description: "Invisible comment - returns empty string",
  category: "text",
  handler: (): MacroResult => ({ value: "", success: true }),
};

const lengthMacro: MacroDefinition = {
  name: "length",
  aliases: ["len", "strlen"],
  description: "Get character count of text",
  args: [{ name: "text", description: "Text to measure", required: true }],
  category: "text",
  handler: (args: string[]): MacroResult => ({ value: (args[0] || "").length.toString(), success: true }),
};

/** {{truncate::text::maxLength}} / {{truncate::text::maxLength::suffix}} (default suffix "..."). */
const truncateMacro: MacroDefinition = {
  name: "truncate",
  aliases: ["trunc", "cut"],
  description: "Truncate text to max length with optional suffix",
  args: [
    { name: "text", description: "Text to truncate", required: true },
    { name: "maxLength", description: "Maximum length", required: true },
    { name: "suffix", description: 'Suffix when truncated (default "...")', required: false },
  ],
  category: "text",
  handler: (args: string[]): MacroResult => {
    const text = args[0] || "";
    const maxLength = parseInt(args[1] ?? "", 10);
    const suffix = args[2] ?? "...";
    if (isNaN(maxLength) || maxLength < 0) return { value: "", success: false, error: "Invalid max length" };
    if (text.length <= maxLength) return { value: text, success: true };
    const truncated = text.slice(0, maxLength - suffix.length) + suffix;
    return { value: truncated, success: true };
  },
};

const replaceMacro: MacroDefinition = {
  name: "replace",
  description: "Find and replace in text",
  args: [
    { name: "text", description: "Source text", required: true },
    { name: "find", description: "Text to find", required: true },
    { name: "replacement", description: "Replacement text", required: true },
  ],
  category: "text",
  handler: (args: string[]): MacroResult => {
    if (args.length < 3) return { value: "", success: false, error: "replace requires text, find, and replacement" };
    const text = args[0] ?? "";
    const find = args[1] ?? "";
    const replacement = args[2] ?? "";
    return { value: text.split(find).join(replacement), success: true };
  },
};

/** {{split::text::delimiter::index}} - split and get item at index (negative from end). */
const splitMacro: MacroDefinition = {
  name: "split",
  description: "Split text by delimiter and get item at index",
  args: [
    { name: "text", description: "Text to split", required: true },
    { name: "delimiter", description: "Delimiter", required: true },
    { name: "index", description: "Index to get (0-based, negative from end)", required: true },
  ],
  category: "text",
  handler: (args: string[]): MacroResult => {
    if (args.length < 3) return { value: "", success: false, error: "split requires text, delimiter, and index" };
    const text = args[0] ?? "";
    const delimiter = args[1] ?? "";
    const index = parseInt(args[2] ?? "", 10);
    if (isNaN(index)) return { value: "", success: false, error: "Invalid index" };
    const parts = text.split(delimiter);
    const actualIndex = index < 0 ? parts.length + index : index;
    if (actualIndex < 0 || actualIndex >= parts.length) return { value: "", success: true };
    return { value: parts[actualIndex] ?? "", success: true };
  },
};

/**
 * {{join::delimiter::item1::item2::...}} - join items with delimiter. Also accepts the
 * list-aware form {{join::<list>::sep}}: a JSON/bracket list literal as the sole first arg with
 * exactly one separator arg. A JSON array is never a plausible legacy delimiter, so the two forms
 * never collide.
 */
const joinMacro: MacroDefinition = {
  name: "join",
  description: "Join items with delimiter",
  args: [
    { name: "delimiter", description: "Delimiter between items", required: true },
    { name: "items", description: "Items to join", required: true },
  ],
  category: "text",
  handler: (args: string[]): MacroResult => {
    if (args.length < 2) return { value: "", success: true };
    const first = args[0] ?? "";
    if (args.length === 2 && first.trim().startsWith("[")) {
      const items = parseListArg(first).map(listItemToString).filter((s) => s.length > 0);
      return { value: items.join(args[1] ?? ""), success: true };
    }
    const delimiter = first;
    const items = args.slice(1);
    return { value: items.join(delimiter), success: true };
  },
};

/** {{repeat::text::count}} - repeat text N times (max 1000). */
const repeatMacro: MacroDefinition = {
  name: "repeat",
  description: "Repeat text N times",
  args: [
    { name: "text", description: "Text to repeat", required: true },
    { name: "count", description: "Number of repetitions", required: true },
  ],
  category: "text",
  handler: (args: string[]): MacroResult => {
    const text = args[0] || "";
    const count = parseInt(args[1] ?? "", 10);
    if (isNaN(count) || count < 0) return { value: "", success: false, error: "Invalid count" };
    if (count > 1000) return { value: "", success: false, error: "Count too large (max 1000)" };
    // Bunraku's bound (ADR-012): refuse before allocating a result past the output ceiling.
    if (text.length * count > MAX_OUTPUT_CHARS) return { value: "", success: false, error: `Result too large (max ${MAX_OUTPUT_CHARS} characters)` };
    return { value: text.repeat(count), success: true };
  },
};

/** {{regex::text::pattern::replacement}} - global, case-insensitive regex replace. */
const regexMacro: MacroDefinition = {
  name: "regex",
  aliases: ["regexp"],
  description: "Regex find and replace",
  args: [
    { name: "text", description: "Source text", required: true },
    { name: "pattern", description: "Regex pattern", required: true },
    { name: "replacement", description: "Replacement (supports $1, $2, etc.)", required: true },
  ],
  category: "text",
  handler: (args: string[], context: MacroContext): MacroResult => {
    if (args.length < 3) return { value: "", success: false, error: "regex requires text, pattern, and replacement" };
    if (!context.allowRegex) return { value: "", success: false, error: REGEX_OFF };
    const text = args[0] ?? "";
    const pattern = args[1] ?? "";
    const replacement = args[2] ?? "";
    try {
      const regex = new RegExp(pattern, "gi");
      return { value: text.replace(regex, replacement), success: true };
    } catch {
      return { value: "", success: false, error: `Invalid regex: ${pattern}` };
    }
  },
};

const wordcountMacro: MacroDefinition = {
  name: "wordcount",
  aliases: ["words"],
  description: "Count words in text",
  args: [{ name: "text", description: "Text to count", required: true }],
  category: "text",
  handler: (args: string[]): MacroResult => {
    const text = args[0] || "";
    const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
    return { value: words.length.toString(), success: true };
  },
};

/** {{pad::text::length::char::direction}} - direction: left, right (default), or both/center. */
const padMacro: MacroDefinition = {
  name: "pad",
  description: "Pad text to specified length",
  args: [
    { name: "text", description: "Text to pad", required: true },
    { name: "length", description: "Target length", required: true },
    { name: "char", description: "Padding character (default: space)", required: false },
    { name: "direction", description: "left, right, or both (default: right)", required: false },
  ],
  category: "text",
  handler: (args: string[]): MacroResult => {
    const text = args[0] || "";
    const length = parseInt(args[1] ?? "", 10);
    const char = args[2] || " ";
    const direction = (args[3] || "right").toLowerCase();
    if (isNaN(length) || length < 0) return { value: "", success: false, error: "Invalid length" };
    if (text.length >= length) return { value: text, success: true };
    // Bunraku's bound (ADR-012): refuse before allocating a result past the output ceiling.
    if (length > MAX_OUTPUT_CHARS) return { value: "", success: false, error: `Length too large (max ${MAX_OUTPUT_CHARS})` };
    const padChar = char.charAt(0) || " ";
    switch (direction) {
      case "left":
        return { value: text.padStart(length, padChar), success: true };
      case "both":
      case "center": {
        const totalPad = length - text.length;
        const leftPad = Math.floor(totalPad / 2);
        const rightPad = totalPad - leftPad;
        return { value: padChar.repeat(leftPad) + text + padChar.repeat(rightPad), success: true };
      }
      case "right":
      default:
        return { value: text.padEnd(length, padChar), success: true };
    }
  },
};

export const TEXT_MACROS: readonly MacroDefinition[] = [
  upperMacro,
  lowerMacro,
  titleMacro,
  trimMacro,
  newlineMacro,
  spaceMacro,
  noopMacro,
  reverseMacro,
  commentMacro,
  lengthMacro,
  truncateMacro,
  replaceMacro,
  splitMacro,
  joinMacro,
  repeatMacro,
  regexMacro,
  wordcountMacro,
  padMacro,
];
