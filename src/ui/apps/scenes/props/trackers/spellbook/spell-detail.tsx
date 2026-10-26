/**
 * What opens under a spell (RoleCall SpellbookWingPanel.tsx:1180-1470): the template badge and the fields of its kind (damage and element, healing, buff and debuff
 * effects, the summon, the passive, the ritual's components), the general properties in two columns, and the Cast History. In narrative mode the mechanical numbers
 * (damage, healing, the dice) stay hidden while the spell has a dice formula, as RoleCall hides them. Presentational.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { type Template } from "../../../../../../core/trackers/spellbook";
import type { Spell } from "../../../../../../core/trackers/spellbook";
import { Button } from "../../../../../components/button";
import { Ic, type IconName } from "../../../../../_shared/ic";

export const TEMPLATE_ICON: Readonly<Record<Template, IconName>> = { attack: "lucide:sword", buff: "lucide:arrow-up", debuff: "lucide:arrow-down", heal: "lucide:heart", utility: "lucide:wrench", summon: "lucide:ghost", passive: "lucide:shield", ritual: "lucide:flame" };
export const TEMPLATE_TONE: Readonly<Record<Template, string>> = {
  attack: "var(--stage-danger-text)", buff: "var(--stage-ok)", debuff: "var(--stage-macro)", heal: "color-mix(in srgb,var(--stage-danger-text) 50%,var(--stage-macro))",
  utility: "var(--stage-link)", summon: "color-mix(in srgb,var(--stage-macro) 70%,var(--stage-link))", passive: "var(--stage-mute)", ritual: "var(--stage-warn)",
};
export const TEMPLATE_NAME: Readonly<Record<Template, string>> = { attack: "Attack", buff: "Buff", debuff: "Debuff", heal: "Heal", utility: "Utility", summon: "Summon", passive: "Passive", ritual: "Ritual" };
const ELEMENT_ICON: Readonly<Record<string, IconName>> = {
  fire: "lucide:flame", water: "lucide:droplet", earth: "lucide:mountain", air: "lucide:wind", wind: "lucide:wind", lightning: "lucide:zap", ice: "lucide:snowflake", light: "lucide:sun", dark: "lucide:moon", shadow: "lucide:moon", arcane: "lucide:sparkles", nature: "lucide:leaf", poison: "lucide:skull",
  holy: "lucide:star", unholy: "lucide:skull", death: "lucide:skull", life: "lucide:heart", chaos: "lucide:tornado", order: "lucide:compass", void: "lucide:circle", time: "lucide:clock", space: "lucide:maximize-2", psychic: "lucide:brain", force: "lucide:shield", sonic: "lucide:volume-2",
};
const ELEMENT_TONE: Readonly<Record<string, string>> = {
  fire: "var(--stage-danger-text)", water: "var(--stage-link)", earth: "color-mix(in srgb,var(--stage-warn) 50%,var(--stage-danger-text))", air: "color-mix(in srgb,var(--stage-link) 60%,var(--stage-card))", wind: "color-mix(in srgb,var(--stage-link) 60%,var(--stage-card))",
  lightning: "var(--stage-warn)", ice: "color-mix(in srgb,var(--stage-link) 70%,var(--stage-ok))", light: "color-mix(in srgb,var(--stage-warn) 50%,var(--stage-card))", dark: "var(--stage-mute)", shadow: "var(--stage-mute)", arcane: "var(--stage-macro)",
  nature: "var(--stage-ok)", poison: "color-mix(in srgb,var(--stage-ok) 60%,var(--stage-warn))", holy: "var(--stage-warn)", unholy: "color-mix(in srgb,var(--stage-danger-text) 60%,var(--stage-black))", death: "var(--stage-mute)",
  life: "color-mix(in srgb,var(--stage-danger-text) 50%,var(--stage-macro))", chaos: "var(--stage-danger-text)", order: "var(--stage-link)", void: "color-mix(in srgb,var(--stage-macro) 60%,var(--stage-black))", time: "color-mix(in srgb,var(--stage-link) 50%,var(--stage-ok))",
  space: "var(--stage-var)", psychic: "var(--stage-macro)", force: "var(--stage-mute)", sonic: "var(--stage-link)",
};
export const elementIcon = (e: string): IconName => ELEMENT_ICON[e.toLowerCase()] ?? "lucide:circle";
export const elementTone = (e: string): string => ELEMENT_TONE[e.toLowerCase()] ?? "var(--stage-mute)";
export const MASTERY_TONE = (level: number): string => (level >= 76 ? "var(--stage-warn)" : level >= 51 ? "var(--stage-macro)" : level >= 26 ? "var(--stage-link)" : "var(--stage-mute)");

const ago = (at: number, now = Date.now()): string => {
  const seconds = Math.floor((now - at) / 1000);
  return seconds < 60 ? "just now" : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : seconds < 86400 ? `${Math.floor(seconds / 3600)}h ago` : `${Math.floor(seconds / 86400)}d ago`;
};

function Row({ icon, tone, label, children }: { icon: IconName; tone: string; label: string; children: JSX.Element | string }): JSX.Element {
  return <div className="sp-row"><span style={{ color: tone }}><Ic name={icon} size={16} /></span><div><small>{label}</small>{typeof children === "string" ? <div>{children}</div> : children}</div></div>;
}
const List = ({ items }: { items: readonly string[] }): JSX.Element => <ul>{items.map((e, i) => <li key={`${e}${i}`}>{e}</li>)}</ul>;

export function SpellDetail({ spell, tactical }: { spell: Spell; tactical: boolean }): JSX.Element {
  const [history, setHistory] = useState(false);
  const tone = TEMPLATE_TONE[spell.template];
  const showNumbers = tactical || !spell.diceFormula;
  const cost = spell.castingCost;
  const costIcon: IconName = !cost ? "lucide:droplet" : cost.resource === "mp" ? "lucide:droplet" : cost.resource === "hp" ? "lucide:heart" : cost.resource === "ap" ? "lucide:zap" : "lucide:flame";
  const costTone = !cost ? "" : cost.resource === "mp" ? "var(--stage-link)" : cost.resource === "hp" ? "var(--stage-danger-text)" : cost.resource === "ap" ? "var(--stage-warn)" : "var(--stage-macro)";
  const entries = spell.castHistory ?? [];
  return (
    <>
      <div className="it-line"><span style={{ color: tone }}><Ic name={TEMPLATE_ICON[spell.template]} size={16} /></span><span className="it-tag" style={{ "--c": tone } as CSSProperties}>{TEMPLATE_NAME[spell.template]}</span></div>
      <div className="sp-fields">
        {spell.template === "attack" && (
          <>
            {spell.damage && showNumbers && <Row icon="lucide:sword" tone="var(--stage-danger-text)" label="Damage">{spell.damage}</Row>}
            {spell.element && <Row icon={elementIcon(spell.element)} tone={elementTone(spell.element)} label="Element"><b className="cap" style={{ color: elementTone(spell.element) }}>{spell.element}</b></Row>}
          </>
        )}
        {spell.template === "heal" && spell.healing && showNumbers && <Row icon="lucide:heart" tone="var(--stage-danger-text)" label="Healing">{spell.healing}</Row>}
        {spell.template === "buff" && spell.buffEffects && spell.buffEffects.length > 0 && <Row icon="lucide:arrow-up" tone="var(--stage-ok)" label="Buff Effects"><List items={spell.buffEffects} /></Row>}
        {spell.template === "debuff" && spell.debuffEffects && spell.debuffEffects.length > 0 && <Row icon="lucide:arrow-down" tone="var(--stage-macro)" label="Debuff Effects"><List items={spell.debuffEffects} /></Row>}
        {spell.template === "summon" && spell.summonDescription && <Row icon="lucide:ghost" tone="var(--stage-macro)" label="Summons">{spell.summonDescription}</Row>}
        {spell.template === "passive" && spell.passiveEffect && <Row icon="lucide:shield" tone="var(--stage-mute)" label="Passive Effect">{spell.passiveEffect}</Row>}
        {spell.template === "ritual" && spell.ritualComponents && spell.ritualComponents.length > 0 && <Row icon="lucide:flame" tone="var(--stage-warn)" label="Ritual Components"><List items={spell.ritualComponents} /></Row>}
      </div>
      <div className="sp-grid">
        {cost && <span className="it-line"><span style={{ color: costTone }}><Ic name={costIcon} size={14} /></span>Cost: {cost.amount} {cost.label || cost.resource.toUpperCase()}</span>}
        {spell.manaCost !== undefined && <span className="it-line"><span style={{ color: "var(--stage-link)" }}><Ic name="lucide:droplet" size={14} /></span>Mana: {spell.manaCost}</span>}
        {spell.narrativeCost && !cost && <span className="it-line wide"><span style={{ color: "var(--stage-macro)" }}><Ic name="lucide:feather" size={14} /></span><em>{spell.narrativeCost}</em></span>}
        {spell.castingRequirement && <span className="it-line wide"><span style={{ color: "var(--stage-warn)" }}><Ic name="lucide:circle-alert" size={14} /></span>{spell.castingRequirement}</span>}
        {spell.emotionalAffinity && <span className="it-line"><span style={{ color: "var(--stage-danger-text)" }}><Ic name="lucide:heart" size={14} /></span>Resonance: {spell.emotionalAffinity}</span>}
        {tactical && spell.diceFormula && <span className="it-line"><span style={{ color: "var(--stage-var)" }}><Ic name="lucide:dice-5" size={14} /></span>Roll: {spell.diceFormula}</span>}
        {spell.wildMagicSusceptibility ? <span className="it-line"><span style={{ color: "var(--stage-macro)" }}><Ic name="lucide:sparkles" size={14} /></span>Wild magic: {spell.wildMagicSusceptibility}%</span> : null}
        {spell.cooldown && <span className="it-line"><span style={{ color: "var(--stage-warn)" }}><Ic name="lucide:clock" size={14} /></span>CD: {spell.cooldown}</span>}
        {spell.castTime && <span className="it-line"><Ic name="lucide:clock" size={14} />Cast: {spell.castTime}</span>}
        {spell.range && <span className="it-line"><Ic name="lucide:target" size={14} />Range: {spell.range}</span>}
        {spell.area && <span className="it-line"><Ic name="lucide:circle-dot" size={14} />Area: {spell.area}</span>}
        {spell.duration && <span className="it-line"><Ic name="lucide:hourglass" size={14} />Duration: {spell.duration}</span>}
      </div>
      {entries.length > 0 && (
        <div>
          <Button variant="quiet" size="sm" aria-expanded={history} onClick={() => setHistory(!history)}><Ic name={history ? "lucide:chevron-down" : "lucide:chevron-right"} size={12} /><Ic name="lucide:history" size={12} /><span>Cast History ({entries.length})</span></Button>
          {history && (
            <div className="sp-hist">
              {entries.slice(-5).reverse().map((h, i) => <div key={`${h.castAt}${i}`}><span>{ago(h.castAt)}</span><span>{h.context}</span>{h.diceResult && <b>{h.diceResult}</b>}</div>)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

