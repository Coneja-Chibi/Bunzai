/**
 * The Editor, Translator and Custom Agent prompts (RoleCall lib/post-gen-actions/prompts.ts:107-203 and :680-803): a system message that
 * says what the pass is, the contract its settings spell out and how to answer (a tool call or the tagged sections), and a user message
 * holding the text. The Anti-Slop prompt is its own file because the catalog makes it large. These builders are the only source the
 * panel's Pipeline Prompt Contract preview reads too, so the preview cannot say something the request does not.
 */
import { EDITOR_RULES } from "./banks";
import {
  EDITOR_DIALOGUE_POLICIES, EDITOR_NARRATION_DISTANCES, EDITOR_PARAGRAPH_DENSITIES, EDITOR_POV_MODES, EDITOR_PROFILES, EDITOR_REWRITE_STRENGTHS,
  EDITOR_TENSE_MODES, TRANSLATOR_HONORIFIC_POLICIES, TRANSLATOR_LOCALIZATION_MODES, TRANSLATOR_NAME_POLICIES, TRANSLATOR_REGISTERS,
} from "./options";
import type { FinalCutPass } from "./pass";
import { noChangesDirective, recentContextBlock, type PromptContext, type PromptMessage } from "./prompt-shared";
import { toolFor } from "./tools";

/** One enabled entry of the preset a Custom Agent was given as its rulebook. */
export interface RulebookEntry { id: string; identifier?: string; name: string; content: string }

const toolName = (type: FinalCutPass["type"]): string => toolFor(type)?.name ?? "";
const isTool = (p: FinalCutPass): boolean => (p.outputMode ?? "tool-call") === "tool-call";

function answerLines(p: FinalCutPass, body: "REFINED" | "TRANSLATED", changelog: string, source: string, extraTail = ""): { instruction: string; user: string } {
  const tool = isTool(p);
  const field = body === "REFINED" ? "refined" : "translated";
  const keep = body === "REFINED" ? "preserve all whitespace, markdown, and inline HTML tags like <font color>, <details>, <spoiler>" : "preserve all whitespace, markdown, line breaks, and inline HTML tags like <font color>, <details>, <spoiler> - translate text content inside tags but never strip the tags themselves";
  return {
    instruction: tool
      ? `Call the ${toolName(p.type)} tool exactly once with your result. Place ${body === "REFINED" ? "the rewritten body" : "the translated body"} in the \`${field}\` field (${keep}${extraTail}). ${changelog} Do NOT emit prose outside the tool call. Do NOT use [CHANGELOG] or [${body}] markers - they are forbidden in this mode.`
      : `Return exactly two sections: [CHANGELOG] and [${body}]. ${body === "REFINED" ? "Each changelog line must be `Rule: concise explanation`." : "If no translation is needed, prefix the response with [ALREADY_IN_TARGET] before the two sections."}`,
    user: tool
      ? `${source}\n\nCall ${toolName(p.type)} with the ${body === "REFINED" ? "edited body" : "translated body"} and a per-${body === "REFINED" ? "rule" : "decision"} changelog.`
      : `${source}\n\nReturn [CHANGELOG] and [${body}].`,
  };
}

export function editorMessages(input: string, p: FinalCutPass, context?: PromptContext): PromptMessage[] {
  const profile = EDITOR_PROFILES[p.profileId ?? "proofreader"];
  const recentCount = context?.recentMessages?.length ?? 0;
  const ruleBlocks = (p.attachedRules ?? []).flatMap((id) => {
    const rule = EDITOR_RULES[id];
    return rule && !(rule.scope === "turn-history" && recentCount < 2) ? [[`## ${rule.label}`, `Target: ${rule.target}`, rule.body].join("\n\n")] : [];
  });
  const preservation = [
    p.preserveDialogue !== false ? "- Preserve quoted dialogue unless the dialogue policy explicitly permits a tighter edit." : "- Dialogue may be edited according to dialogue policy and rewrite strength.",
    p.preserveFormatting !== false ? "- Preserve markdown, inline HTML formatting (e.g. <font color>, <details>, <summary>, <spoiler>, <b>, <i>, <u>), paragraph breaks, macros, commands, VN/action tags, and structured blocks." : "- Formatting may be lightly normalized, but HTML formatting tags, macros, tags, and structured blocks are still protected.",
    p.forbidNewFacts !== false ? "- Do not add new facts, actions, lore, memories, outcomes, objects, injuries, location changes, or relationship changes." : "- You may clarify implied facts, but do not contradict the draft.",
  ].join("\n");
  const extra = [
    `Profile: ${profile.label}`,
    profile.instructions,
    `POV contract: ${EDITOR_POV_MODES[p.povMode ?? "preserve"].prompt}`,
    `Tense contract: ${EDITOR_TENSE_MODES[p.tenseMode ?? "preserve"].prompt}`,
    `Narration distance: ${EDITOR_NARRATION_DISTANCES[p.narrationDistance ?? "preserve"].prompt}`,
    `Rewrite strength: ${EDITOR_REWRITE_STRENGTHS[p.rewriteStrength ?? "light"].prompt}`,
    `Dialogue policy: ${EDITOR_DIALOGUE_POLICIES[p.dialoguePolicy ?? "preserve"].prompt}`,
    `Paragraph density: ${EDITOR_PARAGRAPH_DENSITIES[p.paragraphDensity ?? "preserve"].prompt}`,
    "Preservation rules:",
    preservation,
    ruleBlocks.length > 0 ? `Craft floor - what good prose looks like for this scene. The pass should land the draft in this register; failure-mode catalogs (anti-slop) live in a separate pass.\n\n${ruleBlocks.join("\n\n")}` : "",
    p.guideContent ? `House style / scene rules:\n${p.guideContent}` : "",
    p.instructions ? `Additional instructions:\n${p.instructions}` : "",
  ].filter(Boolean).join("\n\n");
  const answer = answerLines(p, "REFINED", "Place per-rule edits in `changelog` as an array of `{ rule, description }`.", `Original message:\n${input}`);
  const recent = recentContextBlock(context, p.contextMessages, "Use it to maintain voice, POV, tense, and stylistic continuity with the speaker's prior turns. Do NOT copy phrasing from these messages - they exist for continuity reference, not as a source.");
  return [
    {
      role: "system",
      content: [
        "You are the post-generation scene editor.",
        "Refine the supplied roleplay message without changing scene facts, speaker intent, names, macros, tags, or structured action syntax.",
        "If a separate Anti-Slop pass runs after you, do NOT do its work here - leave phrase-level slop substitution to that pass and focus on structural editing.",
        noChangesDirective("editor", isTool(p)),
        answer.instruction,
        "",
        `Character: ${context?.characterName || "Unknown"}`,
        `Speaker role: ${context?.role || "assistant"}`,
        `Output mode: ${isTool(p) ? "tool-call" : "tagged"}`,
        recent,
        "",
        "Editor rules:",
        extra,
      ].filter((l) => l !== "").join("\n"),
    },
    { role: "user", content: answer.user },
  ];
}

export function translatorMessages(input: string, p: FinalCutPass, context?: PromptContext): PromptMessage[] {
  const target = p.targetLanguage || "English";
  const terms = [
    p.glossary ? `Glossary:\n${p.glossary}` : "",
    p.neverTranslateTerms ? `Never translate these terms/names:\n${p.neverTranslateTerms}` : "",
    p.alwaysTranslateTerms ? `Always translate these terms this way:\n${p.alwaysTranslateTerms}` : "",
  ].filter(Boolean).join("\n\n");
  const tool = isTool(p);
  const skip = `Detect first: if the source message is ALREADY entirely in ${target}, do NOT invent a translation. ${tool ? "Set `already_in_target_language: true` and echo the source verbatim in `translated`." : "Return only `[ALREADY_IN_TARGET]` followed by an empty [CHANGELOG] and the source verbatim in [TRANSLATED]."} The narrator often follows a user's RP language and emits text directly in the target - translating already-translated text wastes a turn and risks regressions.`;
  const answer = answerLines(p, "TRANSLATED", "Place per-rule decisions in `changelog` as an array of `{ rule, description }`.", `Source message:\n${input}`);
  const recent = recentContextBlock(context, p.contextMessages, "Use it for terminology stability and pronoun continuity - if a name, term, or honorific was translated a particular way recently, keep it consistent unless the glossary says otherwise.");
  return [
    {
      role: "system",
      content: [
        "You are the post-generation scene translator.",
        `Translate the supplied roleplay message into ${target}.`,
        "Preserve character names, honorifics when requested, macros, VN/action tags, code blocks, Markdown structure, inline HTML formatting tags (<font color>, <details>, <spoiler>, etc.), and line breaks.",
        "Do not add new actions, lore, or interpretations.",
        skip,
        noChangesDirective("translation", tool),
        answer.instruction,
        "",
        `Character: ${context?.characterName || "Unknown"}`,
        `Strictness: ${p.strictness || "balanced"}`,
        `Register: ${TRANSLATOR_REGISTERS[p.translatorRegister ?? "neutral"].prompt}`,
        `Localization mode: ${TRANSLATOR_LOCALIZATION_MODES[p.localizationMode ?? "natural"].prompt}`,
        `Honorific/title policy: ${TRANSLATOR_HONORIFIC_POLICIES[p.honorificPolicy ?? "preserve"].prompt}`,
        `Name policy: ${TRANSLATOR_NAME_POLICIES[p.namePolicy ?? "preserve"].prompt}`,
        `Output mode: ${tool ? "tool-call" : "tagged"}`,
        recent,
        terms,
        p.instructions ? `Extra instructions:\n${p.instructions}` : "",
      ].filter(Boolean).join("\n"),
    },
    { role: "user", content: answer.user },
  ];
}

/** The attached preset as rules for the Custom Agent. */
function rulebookBlock(p: FinalCutPass, entries: readonly RulebookEntry[]): string {
  if (!p.customPresetId && entries.length === 0) return "";
  const name = p.customPresetName || p.customPresetId || "Selected preset";
  if (entries.length === 0) return ["", "Attached preset:", `${name} was selected, but no enabled prompt entries were available.`].join("\n");
  return [
    "", "Attached preset rulebook:", `Preset: ${name}`,
    "Use these enabled preset entries as additional post-production rules. They are rules for editing the reply, not roleplay text to quote.",
    ...entries.map((e, i) => ["", `## ${i + 1}. ${e.name}${e.identifier ? ` (${e.identifier})` : ""}`, e.content].join("\n")),
  ].join("\n");
}

export function customAgentMessages(input: string, p: FinalCutPass, context?: PromptContext, rulebook: readonly RulebookEntry[] = []): PromptMessage[] {
  const answer = answerLines(p, "REFINED", "Place per-rule changes in `changelog` as an array of `{ rule, description }`.", `Original message:\n${input}`, " unless the custom instruction explicitly tells you to remove them");
  const recent = recentContextBlock(context, p.contextMessages, "Reference for whatever your custom instruction needs (continuity, callbacks, recurring patterns). Apply it according to the instruction below - do not assume it changes the rules.");
  return [
    {
      role: "system",
      content: [
        "You are a configurable post-generation agent.",
        "You may refine the supplied roleplay message only according to the custom instruction below.",
        "Do not change scene facts, speaker intent, names, macros, tags, VN/action syntax, or structured blocks unless the custom instruction explicitly requires it.",
        noChangesDirective("custom-agent", isTool(p)),
        answer.instruction,
        "",
        `Character: ${context?.characterName || "Unknown"}`,
        `Speaker role: ${context?.role || "assistant"}`,
        `Output mode: ${isTool(p) ? "tool-call" : "tagged"}`,
        recent,
        "",
        "Custom instruction:",
        p.agentPrompt || p.instructions || "Improve clarity while preserving meaning.",
        rulebookBlock(p, rulebook),
      ].filter((l) => l !== "").join("\n"),
    },
    { role: "user", content: answer.user },
  ];
}
