/**
 * The Scene editor pass's page (Full Chat's EditorControls, fc-editor.tsx, in its order): profile and failure mode, output mode, the POV and tense contracts, rewrite strength, narration distance and paragraph density,
 * the dialogue policy, the three preserve switches, the craft-floor rules (a switch each) and house style. The profile decides which of them show first, as it does in Full Chat. Each row writes `useFinalCut.patch`.
 */
import type { JSX } from "react";
import { EDITOR_RULES } from "../../../../../../core/final-cut/banks";
import {
  EDITOR_DIALOGUE_POLICIES, EDITOR_NARRATION_DISTANCES, EDITOR_PARAGRAPH_DENSITIES, EDITOR_POV_MODES, EDITOR_PROFILES, EDITOR_REWRITE_STRENGTHS, EDITOR_TENSE_MODES, type EditorProfileId,
} from "../../../../../../core/final-cut/options";
import type { FinalCutPass } from "../../../../../../core/final-cut/pass";
import { PROFILE_CONTROLS } from "../../../final-cut/fc-core";
import { PairRow, SelectRow, TextAreaRow, ToggleRow } from "../../frames/settings-rows";
import type { SceneEnv } from "./env";
import { choicesOf, FAILURE_CHOICES, OutputModeRow, PassBody, PassChromeRows, type PassPage } from "./finalcut-kit";

const RULES = Object.values(EDITOR_RULES).sort((a, b) => a.label.localeCompare(b.label));

function EditorRows({ page }: { page: PassPage }): JSX.Element {
  const { pass, change } = page;
  const profileId: EditorProfileId = pass.profileId ?? "voicekeeper";
  const profile = EDITOR_PROFILES[profileId];
  const controls = PROFILE_CONTROLS[profileId]!;
  const show = (section: string): boolean => controls.visible.includes(section);
  const attached = new Set(pass.attachedRules ?? []);
  const toggleRule = (id: string): void => change({ attachedRules: attached.has(id) ? [...attached].filter((x) => x !== id) : [...attached, id] });
  return (
    <>
      <PassChromeRows page={page} type="editor" />
      <OutputModeRow value={pass.outputMode} onChange={(outputMode) => change({ outputMode })} />
      <PairRow a={{ label: "Editor profile", value: profileId, options: choicesOf(EDITOR_PROFILES), onChange: (id) => change({ ...PROFILE_CONTROLS[id]!.defaults, profileId: id as EditorProfileId }) }}
        b={{ label: "If this pass fails", value: pass.failureMode, options: FAILURE_CHOICES, onChange: (failureMode) => change({ failureMode: failureMode as FinalCutPass["failureMode"] }) }} />
      <p className="msn-st-secd">{profile.description} {controls.primary}</p>
      {(show("pov") || show("tense")) && (
        <PairRow a={{ label: "POV contract", value: pass.povMode ?? "preserve", options: choicesOf(EDITOR_POV_MODES), onChange: (povMode) => change({ povMode: povMode as FinalCutPass["povMode"] }) }}
          b={{ label: "Tense", value: pass.tenseMode ?? "preserve", options: choicesOf(EDITOR_TENSE_MODES), onChange: (tenseMode) => change({ tenseMode: tenseMode as FinalCutPass["tenseMode"] }) }} />
      )}
      <SelectRow label="Rewrite strength" value={pass.rewriteStrength ?? "light"} options={choicesOf(EDITOR_REWRITE_STRENGTHS)} onChange={(rewriteStrength) => change({ rewriteStrength: rewriteStrength as FinalCutPass["rewriteStrength"] })} />
      {(show("distance") || show("density")) && (
        <PairRow a={{ label: "Narration distance", value: pass.narrationDistance ?? "preserve", options: choicesOf(EDITOR_NARRATION_DISTANCES), onChange: (narrationDistance) => change({ narrationDistance: narrationDistance as FinalCutPass["narrationDistance"] }) }}
          b={{ label: "Paragraph density", value: pass.paragraphDensity ?? "preserve", options: choicesOf(EDITOR_PARAGRAPH_DENSITIES), onChange: (paragraphDensity) => change({ paragraphDensity: paragraphDensity as FinalCutPass["paragraphDensity"] }) }} />
      )}
      {show("dialogue") && <SelectRow label="Dialogue policy" value={pass.dialoguePolicy ?? "preserve"} options={choicesOf(EDITOR_DIALOGUE_POLICIES)} onChange={(dialoguePolicy) => change({ dialoguePolicy: dialoguePolicy as FinalCutPass["dialoguePolicy"] })} />}
      {show("preserve") && (
        <>
          <ToggleRow label="Preserve quoted dialogue" on={pass.preserveDialogue !== false} onChange={(preserveDialogue) => change({ preserveDialogue })} />
          <ToggleRow label="Preserve formatting and VN tags" on={pass.preserveFormatting !== false} onChange={(preserveFormatting) => change({ preserveFormatting })} />
          <ToggleRow label="Forbid new scene facts" on={pass.forbidNewFacts !== false} onChange={(forbidNewFacts) => change({ forbidNewFacts })} />
        </>
      )}
      {/* bounded-ok: the editor's craft-floor rules are a small fixed catalogue */}
      {RULES.map((rule) => <ToggleRow key={rule.id} label={`Craft floor: ${rule.label}`} description={`${rule.target} (${rule.scope}).`} on={attached.has(rule.id)} onChange={() => toggleRule(rule.id)} />)}
      {RULES.some((r) => attached.has(r.id) && r.scope === "turn-history") && <p className="msn-st-secd">Rules with turn-history scope only fire when the pass has 2 or more prior messages of context. Single-message edits skip them.</p>}
      {show("style") && <TextAreaRow label="House style and scene rules" description="Free-form rules the editor follows, such as keeping clipped dialogue or fixing POV leaks." value={pass.guideContent ?? ""} rows={4} onChange={(guideContent) => change({ guideContent })} />}
    </>
  );
}

export function EditorPage({ env }: { env: SceneEnv }): JSX.Element {
  return <PassBody env={env} type="editor" part="editor" label="Scene editor" description="Rewrites the reply: proofreading, voice, point of view, polish.">{(page) => <EditorRows page={page} />}</PassBody>;
}
