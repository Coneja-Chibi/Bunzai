/**
 * The one tool each pass is forced to call in tool-call mode (RoleCall lib/post-gen-actions/prompts.ts:205-419): a body field, a changelog,
 * a no-op flag and a per-rule review, all required so a strict schema holds the model to them. Each pass has its own tool name, so a
 * model that supports parallel calls cannot confuse one pass's tool with another's.
 */
import type { ProviderToolDefinition } from "../../stage/contracts/provider";
import type { PassType } from "./pass";

export interface ToolSpec {
  tool: ProviderToolDefinition;
  name: string;
  bodyField: "refined" | "translated";
  changelogShape: "rule-description" | "bank-change";
}

const NAMES: Readonly<Record<Exclude<PassType, "validator">, string>> = {
  "anti-slop": "submit_refined_message",
  editor: "submit_edited_message",
  translator: "submit_translated_message",
  "custom-agent": "submit_custom_agent_result",
};

function build(name: string, description: string, bodyField: ToolSpec["bodyField"], bodyDescription: string, changelogShape: ToolSpec["changelogShape"], changelogDescription: string, extra: Record<string, unknown> = {}): ToolSpec {
  const bank = changelogShape === "bank-change";
  const required = ["bank", "change"];
  const itemProperties = bank
    ? { bank: { type: "string", description: "The bank label (e.g. 'AI tells', 'Verbs', 'Apophasis')." }, change: { type: "string", description: "Short description of what was changed." } }
    : { rule: { type: "string", description: "Short rule label (e.g. 'POV leak', 'Tense slip', 'Glossary term')." }, description: { type: "string", description: "Brief explanation of the change made." } };
  return {
    name, bodyField, changelogShape,
    tool: {
      type: "function",
      function: {
        name, description, strict: true,
        parameters: {
          type: "object",
          required: [bodyField, "changelog", "no_changes_needed", "rule_review", ...Object.keys(extra)],
          additionalProperties: false,
          properties: {
            [bodyField]: { type: "string", description: bodyDescription },
            changelog: { type: "array", description: changelogDescription, items: { type: "object", required: bank ? required : ["rule", "description"], additionalProperties: false, properties: itemProperties } },
            no_changes_needed: { type: "boolean", description: "Set to true if the input genuinely needs no changes from this pass (text already meets all the criteria you were asked to enforce). Echo the input verbatim in the body field when true. Set to false on every call where you actually applied edits. Do NOT set this just to skip work - only when honest review found nothing to fix." },
            rule_review: {
              type: ["array", "null"],
              description: "REQUIRED on every call. Walk every rule/bank loaded into this pass and emit one entry per rule. State the verdict (clean / minor / ignored / applied) and a one-sentence reasoning. When you applied an edit triggered by a rule, the reasoning explains which criterion fired. When you decided not to act on a rule, the reasoning explains what you considered. Never skip a rule. Empty array is invalid.",
              items: {
                type: "object", additionalProperties: false, required: ["rule", "verdict", "reasoning"],
                properties: {
                  rule: { type: "string", description: "The rule/bank name as it appeared in your prompt." },
                  verdict: { type: "string", enum: ["clean", "minor", "ignored", "applied"], description: "clean = nothing matched. minor = matched but kept (intentional, fits voice). ignored = rule not applicable to this input. applied = you edited the body to address this rule." },
                  reasoning: { type: "string", description: "1-2 sentences: what you considered + why it stays as-is." },
                },
              },
            },
            ...extra,
          },
        },
      },
    },
  };
}

/** The tool of a pass type; the Output Safety Check has none because it calls no model. */
export function toolFor(type: PassType): ToolSpec | null {
  if (type === "validator") return null;
  const name = NAMES[type];
  switch (type) {
    case "anti-slop":
      return build(name, "Submit the rewritten message after applying anti-slop substitutions. Required: full refined body and a structured changelog of per-bank changes.", "refined",
        "The complete rewritten message with banked phrases substituted. Preserve dialogue, macros ({{char}}, {{user}}, etc.), VN/action tags, markdown formatting, inline HTML formatting tags (<font color>, <details>, <spoiler>, etc.), and scene facts. This becomes the new message body verbatim.",
        "bank-change", "Per-bank change log. One entry per bank that fired. Omit banks that did not produce a change. May be empty if no substitutions were made.");
    case "editor":
      return build(name, "Submit the edited message. Required: full refined body and a structured changelog of edits made (POV/tense/dialogue/style).", "refined",
        "The complete rewritten message after editing. Preserve dialogue, macros ({{char}}, {{user}}), VN/action tags, markdown, inline HTML formatting tags (<font color>, <details>, <spoiler>, etc.), scene facts, and speaker intent. This becomes the new message body verbatim.",
        "rule-description", "Per-rule change log. One entry per editing rule that fired. Empty array if no edits were needed.");
    case "translator":
      return build(name, "Submit the translated message. Required: full translated body and a structured changelog of translation choices. If the input is already entirely in the target language, set already_in_target_language=true and echo the input verbatim in the translated field.", "translated",
        "The complete translated message in the target language. Preserve names per the name policy, honorifics per the honorific policy, macros, VN/action tags, markdown structure, inline HTML formatting tags (<font color>, <details>, <spoiler>, etc.), and line breaks. This becomes the new message body verbatim. If already_in_target_language is true, echo the input here unchanged.",
        "rule-description", "Per-decision change log. One entry per translation rule applied (glossary lookup, register adjustment, idiom adaptation, etc.). When already_in_target_language is true this should be empty or contain a single entry explaining the detection.",
        { already_in_target_language: { type: "boolean", description: "Set to true if the input message is already entirely in the target language and no translation work is needed. Echo the input verbatim in `translated` when this is true. Set to false on every call where you actually translated." } });
    case "custom-agent":
      return build(name, "Submit the post-processed message after applying the custom agent instruction. Required: refined body and a structured changelog.", "refined",
        "The complete rewritten message after applying the custom agent's instruction. Preserve dialogue, macros, VN/action tags, markdown, inline HTML formatting tags (<font color>, <details>, <spoiler>, etc.), and scene facts unless the custom instruction explicitly requires otherwise.",
        "rule-description", "Per-decision change log. One entry per rule (custom or preset-derived) that was applied.");
  }
}
