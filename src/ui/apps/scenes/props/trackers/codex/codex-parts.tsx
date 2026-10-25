/**
 * The sections a species and a creature share in the Creature Codex (RoleCall CreatureCodexWingPanel.tsx:855-1370 for a species, 1695-2050 for a creature):
 * Abilities, Passives, Needs, Stats, Combat Profile, Ecology, Taming, Arcane Properties and Research. A section is drawn only when the entry holds it.
 */
import type { CSSProperties, JSX, ReactNode } from "react";
import type { Creature, Species } from "../../../../../../core/trackers/codex";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { Chips } from "../items/item-parts";

export const ABILITY_TONE = {
  attack: "var(--stage-danger-text)", spell: "var(--stage-link)", heal: "var(--stage-ok)", buff: "var(--stage-warn)", debuff: "var(--stage-macro)", passive: "var(--stage-mute)",
  utility: "color-mix(in srgb,var(--stage-ok) 50%,var(--stage-link))", ultimate: "color-mix(in srgb,var(--stage-warn) 70%,var(--stage-card))",
} as const;

export function Section({ icon, tone, title, aside, children }: { icon: IconName; tone: string; title: string; aside?: ReactNode; children: ReactNode }): JSX.Element {
  return <div className="cx-sec" style={{ "--c": tone } as CSSProperties}><div className="cx-sechead"><Ic name={icon} size={14} /><b>{title}</b>{aside}</div>{children}</div>;
}

const Bar = ({ value, max, tone }: { value: number; max: number; tone: string }): JSX.Element => <div className="bd-bar thin"><div style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: tone }} /></div>;

type Shared = Pick<Species, "abilities" | "passives" | "combatProfile" | "taming" | "arcana" | "research"> & { ecology?: Species["ecology"]; baseNeeds?: Species["baseNeeds"]; needs?: Creature["needs"] };

export function CodexSections({ e, stats }: { e: Shared; stats?: { label: string; s: Partial<Record<"hp" | "maxHp" | "mp" | "maxMp" | "attack" | "defense" | "speed" | "level" | "xp" | "xpToNextLevel", number | undefined>> } }): JSX.Element {
  const needs = e.baseNeeds ?? e.needs;
  return (
    <>
      {e.abilities && e.abilities.length > 0 && (
        <Section icon="lucide:zap" tone="var(--stage-warn)" title="Abilities">
          {e.abilities.map((a, i) => (
            <div key={`${a.name}${i}`} className="cx-item">
              <div><b>{a.name}</b><span className="it-tag" style={{ "--c": ABILITY_TONE[a.type] } as CSSProperties}>{a.type}</span></div>
              {a.description && <p>{a.description}</p>}
              {a.effects.length > 0 && <Chips items={a.effects} />}
              {a.usageNotes && <small><em>{a.usageNotes}</em></small>}
              {(a.damage || a.cost || a.cooldown || a.range || a.duration || a.element) && <small>{[a.damage && `Damage: ${a.damage}`, a.cost && `Cost: ${a.cost}`, a.cooldown && `CD: ${a.cooldown}`, a.range && `Range: ${a.range}`, a.duration && `Duration: ${a.duration}`, a.element && `Element: ${a.element}`].filter(Boolean).join(" | ")}</small>}
            </div>
          ))}
        </Section>
      )}
      {e.passives && e.passives.length > 0 && (
        <Section icon="lucide:shield" tone="var(--stage-link)" title="Passives">
          {e.passives.map((p, i) => <div key={`${p.name}${i}`} className="cx-item"><div><b>{p.name}</b></div>{p.description && <p>{p.description}</p>}{p.effect && <small>{p.effect}</small>}</div>)}
        </Section>
      )}
      {needs && Object.keys(needs).length > 0 && (
        <Section icon="lucide:activity" tone="var(--stage-ok)" title="Needs">
          {Object.entries(needs).map(([k, n]) => <div key={k} className="cx-need"><span>{n.label || k}</span><Bar value={n.value} max={n.maxValue} tone={n.maxValue > 0 && n.value / n.maxValue <= 0.2 ? "var(--stage-danger-text)" : n.maxValue > 0 && n.value / n.maxValue <= 0.4 ? "var(--stage-warn)" : "var(--stage-ok)"} /><small>{n.value}/{n.maxValue}</small></div>)}
        </Section>
      )}
      {stats && (stats.s.hp !== undefined || stats.s.attack !== undefined) && (
        <Section icon="lucide:bar-chart-3" tone="var(--stage-link)" title={stats.label}>
          <div className="cx-stats">
            {([["HP", stats.s.hp, stats.s.maxHp], ["MP", stats.s.mp, stats.s.maxMp], ["ATK", stats.s.attack], ["DEF", stats.s.defense], ["SPD", stats.s.speed], ["LVL", stats.s.level]] as const).filter((r) => r[1] !== undefined).map((r) => <div key={r[0]}><small>{r[0]}</small><b>{r[1]}{r[2] !== undefined ? `/${r[2]}` : ""}</b></div>)}
          </div>
          {stats.s.xp !== undefined && <small>XP {stats.s.xp}{stats.s.xpToNextLevel !== undefined ? ` / ${stats.s.xpToNextLevel}` : ""}</small>}
        </Section>
      )}
      {e.combatProfile && (
        <Section icon="lucide:swords" tone="var(--stage-danger-text)" title="Combat Profile" aside={<small>Threat Level: {e.combatProfile.threatLevel}/10</small>}>
          {e.combatProfile.abilities.length > 0 && <div><small>Abilities:</small><Chips items={e.combatProfile.abilities} /></div>}
          {e.combatProfile.weaknesses.length > 0 && <div><small>Weaknesses:</small><Chips items={e.combatProfile.weaknesses} bad /></div>}
          {e.combatProfile.resistances && e.combatProfile.resistances.length > 0 && <div><small>Resistances:</small><Chips items={e.combatProfile.resistances} /></div>}
          {e.combatProfile.lootDrops && e.combatProfile.lootDrops.length > 0 && <div><small>Loot:</small><Chips items={e.combatProfile.lootDrops} /></div>}
          {e.combatProfile.dangerNotes && <small><em>{e.combatProfile.dangerNotes}</em></small>}
        </Section>
      )}
      {e.ecology && (
        <Section icon="lucide:leaf" tone="var(--stage-ok)" title="Ecology">
          <small><b>Role:</b> {e.ecology.ecosystemRole}</small>
          {e.ecology.populationStatus && <small><b>Population:</b> {e.ecology.populationStatus}</small>}
          {e.ecology.migrationPattern && <small><b>Migration:</b> {e.ecology.migrationPattern}</small>}
          {e.ecology.seasonalBehavior && <small><b>Seasonal:</b> {e.ecology.seasonalBehavior}</small>}
          {e.ecology.symbioticRelations && e.ecology.symbioticRelations.length > 0 && <Chips items={e.ecology.symbioticRelations} />}
        </Section>
      )}
      {e.taming && (
        <Section icon="lucide:heart-handshake" tone="color-mix(in srgb,var(--stage-danger-text) 40%,var(--stage-macro))" title="Taming" aside={<small className="cx-aside" style={{ color: e.taming.tameable ? "var(--stage-ok)" : "var(--stage-danger-text)" }}>{e.taming.tameable ? "Tameable" : "Untameable"}</small>}>
          {e.taming.method && <small><b>Method:</b> {e.taming.method}</small>}
          {e.taming.requirements && e.taming.requirements.length > 0 && <div><small>Requirements:</small><Chips items={e.taming.requirements} /></div>}
          {e.taming.loyaltyBase !== undefined && <small><b>Base loyalty:</b> {e.taming.loyaltyBase}</small>}
          {e.taming.mountable && <small>Mountable</small>}
          {e.taming.specialAbilityWhenTamed && <small><b>When tamed:</b> {e.taming.specialAbilityWhenTamed}</small>}
        </Section>
      )}
      {e.arcana && (
        <Section icon="lucide:wand-sparkles" tone="var(--stage-macro)" title="Arcane Properties">
          {e.arcana.magicAffinity && <small><b>Affinity:</b> {e.arcana.magicAffinity}</small>}
          {e.arcana.reagentsYielded && e.arcana.reagentsYielded.length > 0 && <div><small>Reagents:</small><Chips items={e.arcana.reagentsYielded} /></div>}
          {e.arcana.ritualUses && e.arcana.ritualUses.length > 0 && <div><small>Ritual uses:</small><Chips items={e.arcana.ritualUses} /></div>}
          {e.arcana.leyLineInfluence && <small><b>Ley lines:</b> {e.arcana.leyLineInfluence}</small>}
          {e.arcana.cursedVariant && <small style={{ color: "var(--stage-danger-text)" }}><em>Cursed variant detected</em></small>}
        </Section>
      )}
      {e.research && (
        <Section icon="lucide:microscope" tone="var(--stage-link)" title="Research" aside={<small className="cx-aside">{e.research.knowledgeLevel}</small>}>
          {e.research.fieldNotes.length > 0 && <div><small>Field Notes:</small><ul className="cy-list">{e.research.fieldNotes.map((n, i) => <li key={`${n}${i}`}>{n}</li>)}</ul></div>}
          {e.research.specimensCollected !== undefined && <small><b>Specimens:</b> {e.research.specimensCollected}</small>}
          {e.research.dissectionNotes && <small><b>Dissection:</b> {e.research.dissectionNotes}</small>}
          {e.research.pendingHypotheses && e.research.pendingHypotheses.length > 0 && <div><small>Hypotheses:</small><Chips items={e.research.pendingHypotheses} /></div>}
        </Section>
      )}
    </>
  );
}
