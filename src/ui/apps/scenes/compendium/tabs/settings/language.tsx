/**
 * "Output language" (RoleCall `CompendiumSettings.tsx`, `tv_output_language`): the language the filing pass writes its entries in.
 * Blank follows the narrator's. Drawn now because the filing pass reads it (`core/compendium/filing-prompt.ts`); recall does not.
 * Typing is saved once it rests, as every other text here.
 */
import { useEffect, useState, type JSX } from "react";
import { MAX_LANGUAGE } from "../../../../../../core/compendium/defaults";
import { useDebouncedSave } from "../../../../../_shared/use-debounced-value";
import { SettingsField, SettingsSection } from "./parts";
import type { SectionProps } from "./deps";

export function LanguageSection({ compendium, set }: SectionProps): JSX.Element {
  const value = compendium.resolved.language;
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const save = useDebouncedSave<string>((t) => set({ language: t.trim() === "" ? null : t.trim() }), 700, () => undefined);
  return (
    <SettingsSection id="language" title="Output language" blurb="The language Compendium writes the entries it files in." dot="var(--bk-role-info)">
      <SettingsField label="Output language" hint="Leave blank to follow the narrator's language.">
        <input className="cps-in" aria-label="Output language" placeholder="Automatic" maxLength={MAX_LANGUAGE} value={text}
          onChange={(e) => { setText(e.target.value); save.push(e.target.value); }} onBlur={() => save.flush()} />
      </SettingsField>
    </SettingsSection>
  );
}
