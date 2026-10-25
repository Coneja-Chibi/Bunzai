/**
 * The writing-tool table: RoleCall's six tools (WritingToolsPanel.tsx GROUPS, and the composer "+" menu's
 * rows) in its order and words. This is the ONE list the Writing Tools tab, the composer menu and the
 * message menu all read, so a name, a sublabel or a shortcut is written once.
 *
 * `built` says the tool works in this build: a tab or menu offers only built tools, and the slice that
 * lands a tool flips it, fills in its `shortcut`, and gives `sends` the words its request really holds.
 * `promptKey` is a preset system prompt the tool uses (edited in place on the Writing Tools tab and in
 * the Preset tab's Templates); `sends` is what the request holds that is not a preset field, shown
 * read-only under "What this sends". Pure.
 */
import type { PresetSystemPrompts } from "../../../entities/preset/schema";

export type ToolId = "regenerate" | "guided" | "continue" | "correct" | "expand-character" | "polish";
export type ToolSectionId = "reply" | "character" | "draft";

export interface WritingTool {
  id: ToolId;
  section: ToolSectionId;
  label: string;
  /** The composer menu row's second line (RoleCall's dock wording). */
  sublabel: string;
  /** The Writing Tools tab's line under the name. */
  description: string;
  /** A keyboard shortcut that works today, shown as the tab's chip; absent when there is none. */
  shortcut?: string;
  /** The preset system prompt this tool sends, when it has one. */
  promptKey?: keyof PresetSystemPrompts;
  /** Where that prompt is used, when it is not everywhere the tool runs. */
  promptNote?: string;
  /** What the request holds that no preset field edits, in plain words. */
  sends?: string;
  built: boolean;
}

export const TOOL_SECTIONS: readonly { id: ToolSectionId; label: string; menuLabel: string }[] = [
  { id: "reply", label: "Change the reply", menuLabel: "Change the reply" },
  { id: "character", label: "Write in character", menuLabel: "Write in character" },
  { id: "draft", label: "Your draft", menuLabel: "Input" },
];

export const WRITING_TOOLS: readonly WritingTool[] = [
  {
    id: "regenerate", section: "reply", label: "Regenerate", sublabel: "re-roll last AI message", description: "Re-roll the last AI message.", shortcut: "Ctrl+Shift+R",
    sends: "Nothing extra. It sends the request a new reply sends, and keeps the answer as another version of that reply.",
    built: true,
  },
  {
    id: "guided", section: "reply", label: "Guided re-roll", sublabel: "re-run the last AI message with instructions", description: "Re-roll it with instructions you type.",
    sends: "What a re-roll sends, then the version being replaced as a rejected draft (an assistant message), then RoleCall's rewind directive with your instruction. The preset's prefill, if any, still comes last.",
    built: true,
  },
  {
    id: "continue", section: "reply", label: "Continue", sublabel: "extend last reply", description: "Extend the last reply.", shortcut: "Ctrl+Shift+C",
    promptKey: "continueNudge", promptNote: "Used when the model cannot take a started reply.",
    sends: "The reply so far, as the start of the model's answer. A model that refuses a started reply is shown it as its own turn, then asked to go on with the Continue Nudge Prompt, or with \"Continue from the preceding assistant message.\" when that is blank.",
    built: true,
  },
  {
    id: "correct", section: "reply", label: "Correct", sublabel: "fix last AI message in place", description: "Fix the last AI message in place.",
    sends: "Correction Tools on the reply, each tool with its own fixed instructions: Spellcheck (fix grammar and spelling with minimal changes, in the character's voice, temperature 0.2), Corrections (rewrite the message to follow a Correction-typed guide's text, temperature 0.3), Rewrite (replace only a highlighted passage: rewrite, expand or reduce, temperature 0.35 to 0.4). The result is shown beside the original and replaces the shown version only when you Apply.",
    built: true,
  },
  {
    id: "expand-character", section: "character", label: "Expand as character", sublabel: "turn your outline into a full in-character message",
    description: "Type an outline, pick a perspective, and the AI writes your message.", promptKey: "impersonation",
    promptNote: "Blank means the default: \"[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don't write as {{char}} or system. Don't describe actions of {{char}}.]\"",
    sends: "The scene's own prompt over the whole take, ending in that prompt, then one line for the perspective (\"Write in first person (I, we).\", \"Write in second person (you).\" or \"Write in third person, by name.\"), then your outline as a hint. It uses the preset's samplers, caps the reply at 2,000 tokens, and prefills with the preset's Assistant Impersonation, never its Assistant Prefill.",
    built: true,
  },
  {
    id: "polish", section: "draft", label: "Polish Input", sublabel: "spellcheck what you typed", description: "Spellcheck and tidy what you typed before sending.",
    sends: "Your draft, with an editor's instructions: fix grammar, spelling and awkward phrasing with minimal changes, keep your voice (told it is the player's own draft, written as your persona), return only the text. Temperature 0.2.",
    built: true,
  },
];

/** The built tools of one section, in order. */
export const toolsIn = (section: ToolSectionId): WritingTool[] => WRITING_TOOLS.filter((t) => t.section === section && t.built);
