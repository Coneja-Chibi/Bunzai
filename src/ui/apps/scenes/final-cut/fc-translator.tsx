/**
 * The Translator's controls (RoleCall's TranslatorControls, PostProductionPanel.tsx:2111-2245): target language, strictness, register,
 * localization, honorifics and names, a glossary, terms never or always translated a given way, and localization notes. Copy is RoleCall's.
 */
import type { JSX } from "react";
import { TRANSLATOR_HONORIFIC_POLICIES, TRANSLATOR_LOCALIZATION_MODES, TRANSLATOR_NAME_POLICIES, TRANSLATOR_REGISTERS } from "../../../../core/final-cut/options";
import type { FinalCutPass } from "../../../../core/final-cut/pass";
import { Area, Line, Sel } from "./fc-controls";
import { OutputModeToggle, type Change } from "./fc-pass-chrome";

export const STRICTNESS = { loose: { label: "Loose - natural phrasing wins" }, balanced: { label: "Balanced - natural but faithful" }, strict: { label: "Strict - preserve source structure" } } as const;

export function TranslatorControls({ pass, onChange }: { pass: FinalCutPass; onChange: Change }): JSX.Element {
  return (
    <div className="fc-controls">
      <OutputModeToggle value={pass.outputMode} onChange={(outputMode) => onChange({ outputMode })} />
      <div className="fc-grid">
        <Line label="Target language" value={pass.targetLanguage ?? "English"} onChange={(targetLanguage) => onChange({ targetLanguage })} />
        <Sel label="Strictness" value={pass.strictness ?? "balanced"} options={STRICTNESS} onChange={(strictness) => onChange({ strictness: strictness as FinalCutPass["strictness"] })} />
      </div>
      <div className="fc-grid">
        <Sel label="Register" value={pass.translatorRegister ?? "neutral"} options={TRANSLATOR_REGISTERS} onChange={(translatorRegister) => onChange({ translatorRegister: translatorRegister as FinalCutPass["translatorRegister"] })} />
        <Sel label="Localization" value={pass.localizationMode ?? "natural"} options={TRANSLATOR_LOCALIZATION_MODES} onChange={(localizationMode) => onChange({ localizationMode: localizationMode as FinalCutPass["localizationMode"] })} />
      </div>
      <div className="fc-grid">
        <Sel label="Honorifics / titles" value={pass.honorificPolicy ?? "preserve"} options={TRANSLATOR_HONORIFIC_POLICIES} onChange={(honorificPolicy) => onChange({ honorificPolicy: honorificPolicy as FinalCutPass["honorificPolicy"] })} />
        <Sel label="Name handling" value={pass.namePolicy ?? "preserve"} options={TRANSLATOR_NAME_POLICIES} onChange={(namePolicy) => onChange({ namePolicy: namePolicy as FinalCutPass["namePolicy"] })} />
      </div>
      <Area label="Glossary" value={pass.glossary ?? ""} placeholder={"Example:\nBankai = Bankai\nhonored guest = honored guest, not customer"} onChange={(glossary) => onChange({ glossary })} />
      <div className="fc-grid">
        <Area label="Never translate" value={pass.neverTranslateTerms ?? ""} placeholder="Names, spells, factions, places..." onChange={(neverTranslateTerms) => onChange({ neverTranslateTerms })} />
        <Area label="Always translate as" value={pass.alwaysTranslateTerms ?? ""} placeholder={"Example:\nkami = spirit\nsenpai = senior"} onChange={(alwaysTranslateTerms) => onChange({ alwaysTranslateTerms })} />
      </div>
      <Area label="Localization notes" value={pass.instructions ?? ""} placeholder="Keep spell names untranslated. Make dialogue natural, not literal." onChange={(instructions) => onChange({ instructions })} />
    </div>
  );
}
