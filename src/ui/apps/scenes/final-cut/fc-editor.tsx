/**
 * The Scene Editor's controls (RoleCall's EditorControls and CraftFloorRules, PostProductionPanel.tsx:1805-2109): a profile that chooses
 * which of the knobs show first and what they start at, the POV, tense, strength, distance, density and dialogue contracts, the three
 * preserve switches, the craft-floor rules the editor is held to, and house style. Copy is RoleCall's.
 */
import type { JSX } from "react";
import { EDITOR_RULES } from "../../../../core/final-cut/banks";
import {
  EDITOR_DIALOGUE_POLICIES, EDITOR_NARRATION_DISTANCES, EDITOR_PARAGRAPH_DENSITIES, EDITOR_POV_MODES, EDITOR_PROFILES, EDITOR_REWRITE_STRENGTHS, EDITOR_TENSE_MODES,
  type EditorProfileId,
} from "../../../../core/final-cut/options";
import type { FinalCutPass } from "../../../../core/final-cut/pass";
import { Ic } from "../../../_shared/ic";
import { Area, Check, Sel } from "./fc-controls";
import { PROFILE_CONTROLS } from "./fc-core";
import { FailureModeSelect, OutputModeToggle, type Change } from "./fc-pass-chrome";

const RULES = Object.values(EDITOR_RULES).sort((a, b) => a.label.localeCompare(b.label));

function CraftFloor({ pass, onChange }: { pass: FinalCutPass; onChange(next: string[]): void }): JSX.Element | null {
  const attached = new Set(pass.attachedRules ?? []);
  if (RULES.length === 0) return null;
  const toggle = (id: string): void => onChange(attached.has(id) ? [...attached].filter((x) => x !== id) : [...attached, id]);
  return (
    <div className="fc-floor" data-part="scene.finalcut.floor">
      <div className="fc-label">Craft floor rules
        <small>{attached.size === 0 ? "None attached. The editor pass gets no craft-floor guidance" : `${attached.size} attached · ships as the editor's "what good looks like" reference`}</small>
      </div>
      <div className="fc-rules">
        {RULES.map((rule) => (
          <button type="button" key={rule.id} className={`fc-bank${attached.has(rule.id) ? " on" : ""}`} aria-pressed={attached.has(rule.id)} onClick={() => toggle(rule.id)}>
            <span className="fc-tick" aria-hidden="true">{attached.has(rule.id) && <Ic name="lucide:check" size={12} />}</span>
            <span className="fc-bank-body"><span className="row"><b>{rule.label}</b><small>{rule.scope}</small></span><span className="why">{rule.target}</span></span>
          </button>
        ))}
      </div>
      {RULES.some((r) => attached.has(r.id) && r.scope === "turn-history") && (
        <p className="fc-hint">Note: rules with <b>turn-history</b> scope only fire when the editor pass has 2 or more prior messages of context. Single-message edits skip them.</p>
      )}
    </div>
  );
}

export function EditorControls({ pass, onChange }: { pass: FinalCutPass; onChange: Change }): JSX.Element {
  const profileId: EditorProfileId = pass.profileId ?? "voicekeeper";
  const profile = EDITOR_PROFILES[profileId];
  const controls = PROFILE_CONTROLS[profileId]!;
  const show = (section: string): boolean => controls.visible.includes(section);
  return (
    <div className="fc-controls">
      <div className="fc-grid">
        <Sel label="Editor profile" value={profileId} options={EDITOR_PROFILES} onChange={(id) => onChange({ ...PROFILE_CONTROLS[id]!.defaults, profileId: id as EditorProfileId })} />
        <FailureModeSelect value={pass.failureMode} onChange={(failureMode) => onChange({ failureMode })} />
      </div>
      <OutputModeToggle value={pass.outputMode} onChange={(outputMode) => onChange({ outputMode })} />
      <div className="fc-explain">
        <b>{profile.label}</b>
        <p>{profile.description}</p>
        <p>{controls.primary}</p>
        <code>{profile.instructions}</code>
      </div>
      {(show("pov") || show("tense")) && (
        <div className="fc-grid">
          {show("pov") && <Sel label="POV contract" value={pass.povMode ?? "preserve"} options={EDITOR_POV_MODES} onChange={(povMode) => onChange({ povMode: povMode as FinalCutPass["povMode"] })} />}
          {show("tense") && <Sel label="Tense" value={pass.tenseMode ?? "preserve"} options={EDITOR_TENSE_MODES} onChange={(tenseMode) => onChange({ tenseMode: tenseMode as FinalCutPass["tenseMode"] })} />}
        </div>
      )}
      <div className="fc-grid"><Sel label="Rewrite strength" value={pass.rewriteStrength ?? "light"} options={EDITOR_REWRITE_STRENGTHS} onChange={(rewriteStrength) => onChange({ rewriteStrength: rewriteStrength as FinalCutPass["rewriteStrength"] })} /></div>
      {(show("distance") || show("density")) && (
        <div className="fc-grid">
          {show("distance") && <Sel label="Narration distance" value={pass.narrationDistance ?? "preserve"} options={EDITOR_NARRATION_DISTANCES} onChange={(narrationDistance) => onChange({ narrationDistance: narrationDistance as FinalCutPass["narrationDistance"] })} />}
          {show("density") && <Sel label="Paragraph density" value={pass.paragraphDensity ?? "preserve"} options={EDITOR_PARAGRAPH_DENSITIES} onChange={(paragraphDensity) => onChange({ paragraphDensity: paragraphDensity as FinalCutPass["paragraphDensity"] })} />}
        </div>
      )}
      {show("dialogue") && <div className="fc-grid"><Sel label="Dialogue policy" value={pass.dialoguePolicy ?? "preserve"} options={EDITOR_DIALOGUE_POLICIES} onChange={(dialoguePolicy) => onChange({ dialoguePolicy: dialoguePolicy as FinalCutPass["dialoguePolicy"] })} /></div>}
      {show("preserve") && (
        <div className="fc-switches">
          <Check label="Preserve quoted dialogue" checked={pass.preserveDialogue !== false} onChange={(preserveDialogue) => onChange({ preserveDialogue })} />
          <Check label="Preserve formatting / VN tags" checked={pass.preserveFormatting !== false} onChange={(preserveFormatting) => onChange({ preserveFormatting })} />
          <Check label="Forbid new scene facts" checked={pass.forbidNewFacts !== false} onChange={(forbidNewFacts) => onChange({ forbidNewFacts })} />
        </div>
      )}
      <CraftFloor pass={pass} onChange={(attachedRules) => onChange({ attachedRules })} />
      {show("style") && <Area label="House style / scene rules" value={pass.guideContent ?? ""} placeholder="Preserve clipped dialogue. Fix POV leaks. Do not soften threats. Remove repeated gestures." onChange={(guideContent) => onChange({ guideContent })} />}
    </div>
  );
}
