/**
 * The Script Sheet rules and its blocks (RoleCall's packages/presets-core/src/script-sheet.ts and script-sheet-prompts.ts).
 * A sheet is one instruction; the card, persona, lore, memory and history it needs are seated around it, so the
 * instruction may not insert them itself (`{{char}}` and `{{user}}` are fine). The scriptsheet kind sends its blocks
 * through `sheetAsPreset`, the writing family's one reading (core/writing.ts). The rules are checked where a sheet is
 * written and when it is sent, never when it is read.
 */
import type { PresetBody, PresetPrompt, PromptPlacement } from "../../entities/preset/schema";
import type { ScriptSheetBody } from "../../entities/scriptsheet/schema";

export const SCRIPT_SHEET_LIMIT = 100_000;

/** Context the sheet seats on its own, by every spelling a prompt can use (RoleCall's context-macros.ts). */
const CONTEXT_MACRO = new RegExp(`\\{\\{\\s*(?:${[
  "description", "chardesc", "chardescription", "character\\.description", "personality", "charpersonality",
  "character\\.personality", "scenario", "character\\.scenario", "persona", "userpersona", "mesexamples", "examples",
  "exampledialogue", "character\\.examples", "mesexamplesraw", "examplesraw", "charprompt", "characterprompt",
  "charinstruction", "charjailbreak", "characterinstruction", "message history", "message_history", "history", "chatlog",
  "chat_history", "summary", "chatsummary", "memories", "memory", "lorebook", "lore", "entry", "character",
  "personadescription", "dialogueexamples", "world", "character\\.phi",
].join("|")})(?:\\s*(?:::|\\()[\\s\\S]*?)?\\s*\\}\\}`, "i");

/** Why `content` cannot be a Script Sheet, or null when it can. */
export function scriptSheetProblem(content: string): string | null {
  if (!content.trim()) return "Write some instructions first.";
  if (content.length > SCRIPT_SHEET_LIMIT) return `Instructions can be at most ${SCRIPT_SHEET_LIMIT.toLocaleString("en-US")} characters.`;
  if (CONTEXT_MACRO.test(content)) return "Character, history, lore and memory are included automatically. Remove context insertion macros, or use a Preset for custom placement. {{char}} and {{user}} are supported.";
  return null;
}

/** RoleCall's DEFAULT_CONTEXT_SLOTS (packages/presets-core/src/context-slots.ts). */
const CONTEXT_SLOTS: readonly (readonly [string, string])[] = [
  ["charDescription", "{{description}}"], ["charPersonality", "{{personality}}"], ["scenario", "{{scenario}}"],
  ["personaDescription", "{{persona}}"], ["worldInfoBefore", "{{lore}}"], ["summary", "{{summary}}"],
  ["memories", "{{memories}}"], ["dialogueExamples", "{{mesExamples}}"],
];
const NOT_MARKERS = new Set(["script-sheet", "card-system", "card-post-history", "summary"]);

const row = (id: string, content: string, placement: PromptPlacement = "relative"): PresetPrompt => ({
  id, name: id === "script-sheet" ? "Script Sheet" : id, content, role: "system", enabled: true, systemPrompt: true,
  marker: !NOT_MARKERS.has(id), placement, injectionDepth: 0, injectionOrder: 0, forbidOverrides: false,
});

/** RoleCall's scriptSheetPrompts: the instruction, the card's system prompt, the context, the history, the card's post-history instructions. */
export const sheetPrompts = (content: string): PresetPrompt[] => [
  row("script-sheet", content),
  row("card-system", "{{charPrompt}}"),
  ...CONTEXT_SLOTS.map(([id, macro]) => row(id, macro)),
  row("chatHistory", "{{message_history}}", "in_chat"),
  row("card-post-history", "{{charInstruction}}", "append_preset"),
];

/** A sheet as the preset it sends: its blocks, its samplers and its words, so a sheet also becomes a preset with nothing lost. */
export const sheetAsPreset = (sheet: ScriptSheetBody): PresetBody => ({
  name: sheet.name,
  ...(sheet.description !== undefined ? { description: sheet.description } : {}),
  ...(sheet.samplers ? { samplers: sheet.samplers } : {}),
  prompts: sheetPrompts(sheet.content),
});
