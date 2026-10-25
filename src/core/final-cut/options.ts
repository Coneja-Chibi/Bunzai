/**
 * Final Cut's option tables: every choice an editor or translator pass offers, with its label (what the panel shows) and the sentence
 * the prompt carries. These are RoleCall's words (rc lib/post-gen-actions/profiles.ts:19-264), one table per knob, keyed by the stored id,
 * so the panel's selects, the stored values and the prompt builders all read the same list.
 */

type Table<K extends string> = Readonly<Record<K, { label: string; prompt: string }>>;

export type EditorProfileId = "proofreader" | "voicekeeper" | "strict-pov" | "cinematic";
export type EditorPovMode = "preserve" | "first-person" | "second-person" | "third-limited" | "third-objective" | "omniscient-ok";
export type EditorRewriteStrength = "surgical" | "light" | "balanced" | "bold";
export type EditorTenseMode = "preserve" | "past" | "present";
export type EditorDialoguePolicy = "preserve" | "typos-only" | "smooth" | "voice-pass";
export type EditorNarrationDistance = "preserve" | "tight" | "balanced" | "distant";
export type EditorParagraphDensity = "preserve" | "compact" | "balanced" | "expanded";
export type TranslatorRegister = "casual" | "neutral" | "literary" | "formal";
export type TranslatorLocalizationMode = "literal" | "natural" | "adapted";
export type TranslatorHonorificPolicy = "preserve" | "adapt" | "drop";
export type TranslatorNamePolicy = "preserve" | "romanize" | "localize";

export const EDITOR_PROFILES: Readonly<Record<EditorProfileId, { label: string; description: string; instructions: string }>> = {
  proofreader: {
    label: "Proofreader",
    description: "Minimum viable cleanup. Best when you only want spelling, grammar, punctuation, and obvious awkwardness fixed.",
    instructions: "Fix spelling, punctuation, grammar, and awkward phrasing. Make the minimum changes needed.",
  },
  voicekeeper: {
    label: "Voicekeeper",
    description: "Protects the speaker's cadence. Best for characters with specific diction, rough speech, tics, or uneven grammar.",
    instructions: "Preserve the speaker's cadence and personality while tightening unclear prose.",
  },
  "strict-pov": {
    label: "Strict POV",
    description: "Stops accidental mind-reading. Best for first-person, second-person, or close third-person roleplay.",
    instructions: "Remove accidental omniscience, POV leaks, and narration that reveals thoughts the speaker could not know.",
  },
  cinematic: {
    label: "Cinematic Polish",
    description: "Improves flow and staging. Best when the scene is correct but flat, choppy, or under-described.",
    instructions: "Improve sensory flow, pacing, and imagery without changing facts, actions, or outcomes.",
  },
};

export const EDITOR_POV_MODES: Table<EditorPovMode> = {
  preserve: { label: "Preserve current POV", prompt: "Preserve the message's existing point of view. Only fix accidental POV slips." },
  "first-person": { label: "First-person locked", prompt: "Maintain first-person narration. Do not reveal information the speaking 'I' cannot perceive, infer, or know." },
  "second-person": { label: "Second-person locked", prompt: "Maintain second-person narration. Keep the user's embodied perspective stable and do not drift into third-person summary." },
  "third-limited": { label: "Close third limited", prompt: "Maintain close third-person limited narration. Stay inside the current viewpoint character's perceptions and inferences." },
  "third-objective": { label: "Camera objective", prompt: "Use objective camera narration. Only describe observable actions, dialogue, and sensory details; do not state private thoughts." },
  "omniscient-ok": { label: "Omniscient allowed", prompt: "Omniscient narration is allowed, but do not contradict established scene facts or reveal secrets unless already present in the draft." },
};

export const EDITOR_REWRITE_STRENGTHS: Table<EditorRewriteStrength> = {
  surgical: { label: "Surgical", prompt: "Make the smallest possible edits. Prefer preserving wording over improving style." },
  light: { label: "Light polish", prompt: "Make light sentence-level improvements while preserving nearly all wording and structure." },
  balanced: { label: "Balanced", prompt: "Rewrite weak sentences when useful, but preserve scene facts, speaker intent, and key phrasing." },
  bold: { label: "Bold pass", prompt: "You may substantially improve flow, pacing, and emphasis, but must not change facts, outcomes, speaker intent, or continuity." },
};

export const EDITOR_TENSE_MODES: Table<EditorTenseMode> = {
  preserve: { label: "Preserve tense", prompt: "Preserve the draft's current tense unless correcting an obvious tense slip." },
  past: { label: "Past tense", prompt: "Keep narration in past tense. Correct present-tense drift unless it is quoted dialogue." },
  present: { label: "Present tense", prompt: "Keep narration in present tense. Correct past-tense drift unless it is quoted dialogue or recalled memory." },
};

export const EDITOR_DIALOGUE_POLICIES: Table<EditorDialoguePolicy> = {
  preserve: { label: "Preserve dialogue", prompt: "Do not rewrite quoted dialogue except to fix obvious typos." },
  "typos-only": { label: "Typos only", prompt: "Inside quoted dialogue, fix spelling and punctuation only. Preserve wording and cadence." },
  smooth: { label: "Smooth dialogue", prompt: "Lightly smooth quoted dialogue when it is awkward, but preserve intent, subtext, and character voice." },
  "voice-pass": { label: "Voice pass", prompt: "Adjust quoted dialogue toward the character's established voice without changing meaning or information." },
};

export const EDITOR_NARRATION_DISTANCES: Table<EditorNarrationDistance> = {
  preserve: { label: "Preserve distance", prompt: "Preserve the draft's current narrative distance." },
  tight: { label: "Tight interior", prompt: "Keep narration close to the viewpoint character's body, perceptions, biases, and immediate emotional texture." },
  balanced: { label: "Balanced camera", prompt: "Balance interiority with clear staging. Do not over-explain internal states." },
  distant: { label: "Distant camera", prompt: "Favor observable staging, action, and dialogue over internal exposition." },
};

export const EDITOR_PARAGRAPH_DENSITIES: Table<EditorParagraphDensity> = {
  preserve: { label: "Preserve breaks", prompt: "Preserve the draft's paragraph breaks unless a break is clearly malformed." },
  compact: { label: "Compact", prompt: "Use tighter paragraphs and remove needless line breaks." },
  balanced: { label: "Balanced", prompt: "Use readable paragraphing with clean action/dialogue beats." },
  expanded: { label: "Expanded", prompt: "Allow slightly more paragraph separation for beats, turns, and readability." },
};

export const TRANSLATOR_REGISTERS: Table<TranslatorRegister> = {
  casual: { label: "Casual", prompt: "Use natural casual phrasing while preserving character intent." },
  neutral: { label: "Neutral", prompt: "Use clean neutral prose without leaning overly casual or formal." },
  literary: { label: "Literary", prompt: "Use polished literary prose while preserving readability and character voice." },
  formal: { label: "Formal", prompt: "Use formal phrasing and avoid slang unless it is required by quoted dialogue." },
};

export const TRANSLATOR_LOCALIZATION_MODES: Table<TranslatorLocalizationMode> = {
  literal: { label: "Literal", prompt: "Stay close to source structure and phrasing. Preserve idioms when understandable." },
  natural: { label: "Natural", prompt: "Favor natural target-language phrasing while preserving meaning, tone, and scene facts." },
  adapted: { label: "Adapted", prompt: "Adapt idioms and culturally loaded phrasing so the target reader understands the same intent." },
};

export const TRANSLATOR_HONORIFIC_POLICIES: Table<TranslatorHonorificPolicy> = {
  preserve: { label: "Preserve honorifics", prompt: "Preserve honorifics and titles exactly unless the glossary says otherwise." },
  adapt: { label: "Adapt honorifics", prompt: "Adapt honorifics/titles into natural target-language equivalents when appropriate." },
  drop: { label: "Drop honorifics", prompt: "Remove honorifics when they sound unnatural in the target language, while preserving relationship hierarchy in wording." },
};

export const TRANSLATOR_NAME_POLICIES: Table<TranslatorNamePolicy> = {
  preserve: { label: "Preserve names", prompt: "Preserve names exactly as written." },
  romanize: { label: "Romanize names", prompt: "Romanize names only when the source script requires it. Do not invent localized names." },
  localize: { label: "Localize if requested", prompt: "Localize names only when the glossary or localization notes explicitly require it." },
};

/** The ids of a table, in its declared order: the closed set the store accepts and the select lists. */
export const idsOf = (table: Readonly<Record<string, unknown>>): string[] => Object.keys(table);
