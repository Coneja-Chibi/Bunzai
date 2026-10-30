/** Skills and phases share the existing lore trigger editor and one matching rule. */
import type { JSX } from "react";
import type { SkillCondition } from "../../../../entities/skill/schema";
import { TriggerEditor } from "../lore/trigger-editor";
import { binderStyles } from "../lore/binder-styles";
import { Input, Select } from "../../../components/rc-controls";
import { Toggle } from "../../../components/button";
import s from "./piece.module.css";
export function SkillConditionEditor({ value, onChange }: { value: SkillCondition; onChange(next: SkillCondition): void }): JSX.Element {
  const patch = (over: Partial<SkillCondition>) => onChange({ ...value, ...over });
  return <div className={s.section} data-part="piece.skill.condition">
    <label>Match<Select aria-label="Keyword matching" value={value.primaryLogic ?? "any"} onChange={(e) => patch({ primaryLogic: e.target.value as "any" | "all" })}><option value="any">Any keyword</option><option value="all">All keywords</option></Select></label>
    <TriggerEditor triggers={value.triggers} onChange={(triggers) => patch({ triggers })} styles={binderStyles} advanced ariaLabel="Condition keywords" placeholder="Add a keyword or pattern" />
    <details><summary>More conditions</summary><TriggerEditor triggers={value.secondaryTriggers} onChange={(secondaryTriggers) => patch({ secondaryTriggers })} styles={binderStyles} advanced ariaLabel="Secondary condition keywords" placeholder="Add a secondary condition" /><Select aria-label="Secondary matching" value={value.selectiveLogic} onChange={(e) => patch({ selectiveLogic: e.target.value as SkillCondition["selectiveLogic"] })}><option value="and_any">And any secondary keyword</option><option value="and_all">And all secondary keywords</option><option value="not_any">And no secondary keyword</option><option value="not_all">Unless all secondary keywords</option></Select></details>
    <Toggle label="Match case" on={value.caseSensitive} onChange={(caseSensitive) => patch({ caseSensitive })} /><Toggle label="Whole words" on={value.matchWholeWords} onChange={(matchWholeWords) => patch({ matchWholeWords })} />
    <label>Scope<Select aria-label="Condition message scope" value={value.scanDepth === Number.MAX_SAFE_INTEGER ? "all" : "last"} onChange={(e) => patch({ scanDepth: e.target.value === "all" ? Number.MAX_SAFE_INTEGER : 4 })}><option value="last">Last N available messages</option><option value="all">All available messages</option></Select></label>
    {value.scanDepth !== Number.MAX_SAFE_INTEGER && <Input type="number" min={1} aria-label="Condition message count" value={value.scanDepth} onChange={(e) => patch({ scanDepth: e.target.valueAsNumber })} />}
  </div>;
}
