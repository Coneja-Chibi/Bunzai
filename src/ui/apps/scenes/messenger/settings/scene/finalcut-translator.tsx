/**
 * The Translator pass's page (Full Chat's TranslatorControls, fc-translator.tsx, in its order): output mode, target language and strictness, register and localization, honorifics and names, the glossary,
 * the terms never or always translated a given way, and localization notes. Each row writes `useFinalCut.patch`.
 */
import type { JSX } from "react";
import { TRANSLATOR_HONORIFIC_POLICIES, TRANSLATOR_LOCALIZATION_MODES, TRANSLATOR_NAME_POLICIES, TRANSLATOR_REGISTERS } from "../../../../../../core/final-cut/options";
import type { FinalCutPass } from "../../../../../../core/final-cut/pass";
import { STRICTNESS } from "../../../final-cut/fc-translator";
import { PairRow, TextAreaRow } from "../../frames/settings-rows";
import type { SceneEnv } from "./env";
import { choicesOf, FAILURE_CHOICES, OutputModeRow, PassBody, PassChromeRows, type PassPage } from "./finalcut-kit";

function TranslatorRows({ page }: { page: PassPage }): JSX.Element {
  const { pass, change } = page;
  return (
    <>
      <PassChromeRows page={page} type="translator" />
      <PairRow a={{ label: "Strictness", value: pass.strictness ?? "balanced", options: choicesOf(STRICTNESS), onChange: (strictness) => change({ strictness: strictness as FinalCutPass["strictness"] }) }}
        b={{ label: "If this pass fails", value: pass.failureMode, options: FAILURE_CHOICES, onChange: (failureMode) => change({ failureMode }) }} />
      <OutputModeRow value={pass.outputMode} onChange={(outputMode) => change({ outputMode })} />
      <TextAreaRow label="Target language" value={pass.targetLanguage ?? "English"} rows={1} onChange={(targetLanguage) => change({ targetLanguage })} />
      <PairRow a={{ label: "Register", value: pass.translatorRegister ?? "neutral", options: choicesOf(TRANSLATOR_REGISTERS), onChange: (translatorRegister) => change({ translatorRegister: translatorRegister as FinalCutPass["translatorRegister"] }) }}
        b={{ label: "Localization", value: pass.localizationMode ?? "natural", options: choicesOf(TRANSLATOR_LOCALIZATION_MODES), onChange: (localizationMode) => change({ localizationMode: localizationMode as FinalCutPass["localizationMode"] }) }} />
      <PairRow a={{ label: "Honorifics and titles", value: pass.honorificPolicy ?? "preserve", options: choicesOf(TRANSLATOR_HONORIFIC_POLICIES), onChange: (honorificPolicy) => change({ honorificPolicy: honorificPolicy as FinalCutPass["honorificPolicy"] }) }}
        b={{ label: "Name handling", value: pass.namePolicy ?? "preserve", options: choicesOf(TRANSLATOR_NAME_POLICIES), onChange: (namePolicy) => change({ namePolicy: namePolicy as FinalCutPass["namePolicy"] }) }} />
      <TextAreaRow label="Glossary" description="One pair per line, such as: honored guest = honored guest, not customer." value={pass.glossary ?? ""} rows={4} onChange={(glossary) => change({ glossary })} />
      <TextAreaRow label="Never translate" description="Names, spells, factions, places." value={pass.neverTranslateTerms ?? ""} rows={3} onChange={(neverTranslateTerms) => change({ neverTranslateTerms })} />
      <TextAreaRow label="Always translate as" description="One pair per line, such as: kami = spirit." value={pass.alwaysTranslateTerms ?? ""} rows={3} onChange={(alwaysTranslateTerms) => change({ alwaysTranslateTerms })} />
      <TextAreaRow label="Localization notes" description="Keep spell names untranslated. Make dialogue natural, not literal." value={pass.instructions ?? ""} rows={3} onChange={(instructions) => change({ instructions })} />
    </>
  );
}

export function TranslatorPage({ env }: { env: SceneEnv }): JSX.Element {
  return <PassBody env={env} type="translator" part="translator" label="Translator" description="Translates the final reply and keeps names, macros and markup.">{(page) => <TranslatorRows page={page} />}</PassBody>;
}
