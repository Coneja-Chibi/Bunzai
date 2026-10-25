/**
 * The Final Cut tab's pure half (RoleCall's PostProductionPanel.tsx): the words of each pass card, the stats strip, how a pass is
 * switched and changed, and the Pipeline Prompt Contract, which is the REAL system prompt each pass would send (RoleCall re-writes the
 * prompt by hand for its preview, without the dedupe, pins or history rules the request has, so the preview can say what the request does not).
 */
import { BANKS, getSet } from "../../../../core/final-cut/banks";
import { activePasses, createPass, passOf, type FinalCutPass, type PassType } from "../../../../core/final-cut/pass";
import { antiSlopMessages } from "../../../../core/final-cut/prompt-antislop";
import { customAgentMessages, editorMessages, translatorMessages, type RulebookEntry } from "../../../../core/final-cut/prompts";
import { countText } from "../../../../core/tokens";

export type CreativeType = Exclude<PassType, "validator">;

/** RoleCall's CREATIVE_PASSES (PostProductionPanel.tsx:77-105): the cards' kicker, title and line, with the token that colours each. */
export const CREATIVE_PASSES: ReadonlyArray<{ type: CreativeType; kicker: string; title: string; tone: string; text: string }> = [
  { type: "editor", kicker: "Pass I", title: "Scene Editor", tone: "var(--stage-warn)", text: "An LLM rewrite pass. It can proofread, preserve voice, enforce POV, add cinematic polish, or raise intensity while preserving scene facts." },
  { type: "translator", kicker: "Pass II", title: "Translator", tone: "var(--stage-var)", text: "An LLM localization pass. It translates the final reply while preserving names, macros, VN tags, markdown, and scene intent." },
  { type: "custom-agent", kicker: "Custom", title: "Your Department", tone: "var(--stage-macro)", text: "A focused post-production agent with your own instruction and optional preset rulebook pulled from your library." },
];

/** The tone each pass type draws in, by the theme's tokens. */
export const PASS_TONE: Readonly<Record<PassType, string>> = { editor: "var(--stage-warn)", "anti-slop": "var(--stage-danger-text)", translator: "var(--stage-var)", "custom-agent": "var(--stage-macro)", validator: "var(--stage-ok)" };

/** The editor profiles' controls (PostProductionPanel.tsx:129-169): what each profile shows, says first, and starts from. */
export const PROFILE_CONTROLS: Readonly<Record<string, { primary: string; visible: readonly string[]; defaults: Partial<FinalCutPass> }>> = {
  proofreader: { primary: "Shows grammar, formatting, preservation, and light cleanup. Hides the heavier creative controls until you need them.", visible: ["tense", "density", "preserve", "style"], defaults: { rewriteStrength: "surgical", dialoguePolicy: "typos-only" } },
  voicekeeper: { primary: "Shows dialogue and voice-preservation controls first. Best when character cadence matters more than polish.", visible: ["dialogue", "pov", "distance", "preserve", "style"], defaults: { rewriteStrength: "light", dialoguePolicy: "voice-pass", narrationDistance: "preserve" } },
  "strict-pov": { primary: "Shows POV, tense, and narration distance first. Best when the model keeps leaking knowledge or changing viewpoint.", visible: ["pov", "tense", "distance", "dialogue", "preserve"], defaults: { povMode: "third-limited", narrationDistance: "tight", rewriteStrength: "light" } },
  cinematic: { primary: "Shows pacing, paragraph density, narration distance, and sensory polish. Best when the scene is correct but flat.", visible: ["distance", "density", "dialogue", "style", "preserve"], defaults: { rewriteStrength: "balanced", narrationDistance: "balanced", paragraphDensity: "balanced" } },
};

/** The pass switched on, or undefined (a pass switched Off keeps its settings, and is not "on"). */
export const onPass = (passes: readonly FinalCutPass[] | undefined, type: PassType): FinalCutPass | undefined => {
  const p = passOf(passes, type);
  return p && p.enabled !== false ? p : undefined;
};

/** The stats strip (PostProductionPanel.tsx:369-375). */
export function stats(passes: readonly FinalCutPass[] | undefined): Array<{ label: string; value: string }> {
  const anti = onPass(passes, "anti-slop");
  const editor = onPass(passes, "editor");
  const safety = onPass(passes, "validator");
  return [
    { label: "Creative Passes", value: String(activePasses(passes).filter((p) => p.type !== "validator").length) },
    { label: "Anti-Slop", value: anti ? `${(anti.enabledBanks ?? []).length} banks` : "Off" },
    { label: "Editor Rules", value: editor ? `${(editor.attachedRules ?? []).length} attached` : "Off" },
    { label: "Output Safety", value: safety ? "On" : "Off" },
    { label: "User Message Check", value: safety?.applyToUserMessages ? "On" : "Off" },
  ];
}

/** Switches a pass: off keeps everything it was set to, on brings it back, and a type never run before starts from its defaults. */
export function togglePass(passes: readonly FinalCutPass[] | undefined, type: PassType): FinalCutPass[] {
  const list = [...(passes ?? [])];
  const at = list.findIndex((p) => p.type === type);
  if (at < 0) return [...list, createPass(type, list.length + 1)];
  list[at] = { ...list[at]!, enabled: list[at]!.enabled === false };
  return list;
}

/** Changes a pass and switches it on (a control exists only while its pass is on, so changing one is using it). */
export function patchPass(passes: readonly FinalCutPass[] | undefined, type: PassType, patch: Partial<FinalCutPass> | ((current: FinalCutPass) => Partial<FinalCutPass>)): FinalCutPass[] {
  const list = [...(passes ?? [])];
  const at = list.findIndex((p) => p.type === type);
  const current = at < 0 ? createPass(type, list.length + 1) : list[at]!;
  const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch), enabled: true } as FinalCutPass;
  if (at < 0) list.push(next);
  else list[at] = next;
  return list;
}

export interface ContractPass { type: PassType; label: string; xml: string; tokens: number }

const attr = (s: string): string => s.replace(/"/g, "&quot;");
const indent = (text: string): string => text.split("\n").map((l) => (l ? `  ${l}` : l)).join("\n");

/** What each pass would send, as the panel draws it: the pass's system prompt in a wrapper that names its settings. */
export function contractOf(passes: readonly FinalCutPass[], rulebook: readonly RulebookEntry[] = []): ContractPass[] {
  return activePasses(passes).map((p) => {
    if (p.type === "validator") {
      const xml = [`<safety_check deterministic="true" check_user_messages="${p.applyToUserMessages ? "true" : "false"}">`, "  Runs locally: no model call. Validates final text for empty output, leaked", "  protected syntax, unbalanced macros/markdown/action tags.", "</safety_check>"].join("\n");
      return { type: p.type, label: "Safety", xml, tokens: 0 };
    }
    const ctx = { characterName: "{{char}}", recentMessages: [] };
    const system = (p.type === "anti-slop" ? antiSlopMessages("{{previous_pass_output}}", p, ctx)
      : p.type === "translator" ? translatorMessages("{{previous_pass_output}}", p, ctx)
        : p.type === "custom-agent" ? customAgentMessages("{{previous_pass_output}}", p, ctx, rulebook)
          : editorMessages("{{narrator_output}}", p, ctx))[0]!.content;
    const open = p.type === "editor" ? `<editor_pass profile="${p.profileId ?? "voicekeeper"}" failure="${p.failureMode}">`
      : p.type === "anti-slop" ? `<antislop_pass model="${attr(p.connection?.model ?? "scene-default")}" sets="${(p.attachedSets ?? []).length}" banks_enabled="${(p.enabledBanks ?? []).length}" default_depth="${p.defaultDepth ?? "standard"}" failure="${p.failureMode}">`
        : p.type === "translator" ? `<translator_pass target="${attr(p.targetLanguage ?? "English")}" strictness="${p.strictness ?? "balanced"}" failure="${p.failureMode}">`
          : `<custom_pass label="${attr(p.label ?? "Custom Department")}" preset="${attr(p.customPresetName ?? "none")}" failure="${p.failureMode}">`;
    const close = p.type === "editor" ? "</editor_pass>" : p.type === "anti-slop" ? "</antislop_pass>" : p.type === "translator" ? "</translator_pass>" : "</custom_pass>";
    const xml = [open, indent(system), `  <input>${p.type === "editor" ? "{{narrator_output}}" : "{{previous_pass_output}}"}</input>`, close].join("\n");
    const label = p.type === "anti-slop" ? "Anti-Slop" : p.type === "custom-agent" ? "Custom Agent" : p.type === "translator" ? "Translator" : "Editor";
    return { type: p.type, label, xml, tokens: countText(xml) };
  });
}

/** The banks (catalog, with the person's own) of an attached set that a search matches, newest sense first: those with matching entries come first. */
export function searchBanks(attached: readonly string[], query: string, banks: Readonly<Record<string, { label: string; kind: string; pattern: string; why?: string; replace?: string; family?: string; examples: readonly string[] }>> = BANKS): Array<{ bankId: string; setId: string; setLabel: string; matching: string[] }> {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const strip = (s: string): string => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").replace(/_(.+?)_/g, "$1").replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const seen = new Set<string>();
  const out: Array<{ bankId: string; setId: string; setLabel: string; matching: string[] }> = [];
  for (const raw of attached) {
    const set = getSet(raw);
    if (!set) continue;
    for (const bankId of set.banks) {
      const bank = banks[bankId];
      if (!bank || seen.has(bankId)) continue;
      seen.add(bankId);
      const matching = bank.examples.filter((e) => tokens.every((t) => strip(e).includes(t)));
      const meta = [bankId, bank.label, bank.kind, bank.family ?? "", bank.pattern, bank.why ?? "", bank.replace ?? "", set.label].map(strip).join(" ");
      if (matching.length > 0 || tokens.every((t) => meta.includes(t))) out.push({ bankId, setId: set.id, setLabel: set.label, matching: [...matching] });
    }
  }
  return out.sort((a, b) => b.matching.length - a.matching.length || (banks[a.bankId]?.label ?? "").localeCompare(banks[b.bankId]?.label ?? ""));
}
