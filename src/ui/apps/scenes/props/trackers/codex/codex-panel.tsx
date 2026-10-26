/**
 * The Creature Codex panel (RoleCall CreatureCodexWingPanel.tsx:509-2242): the All, Species and Creatures tabs, species cards with their taxonomy, rarity and disposition,
 * creature cards with status, condition, mood, bond and trust, what opens under each (abilities, passives, needs, stats, combat, ecology, taming, arcana, research,
 * encounters), Refresh by the model and Delete, and "Add Species" and "Log Creature" (name, guide, Generate). The rules are core/trackers/codex.ts. A creature is made for a
 * species by name; if no species has that name, Accept says so and keeps nothing. Generate and Refresh propose an entry kept only on Accept; Delete leaves an Undo.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { applyCodex, codexLines, creaturesOf, liveCreatures, liveSpecies, readCodex, speciesByName, type Creature, type CreatureMade, type Species, type SpeciesMade } from "../../../../../../core/trackers/codex";
import { tokensOf } from "../../../../../../core/trackers/list";
import { Button } from "../../../../../components/button";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Block, Chips, Empty, ItemCard, ItemList, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";
import { CodexSections } from "./codex-parts";

const RARITY_TONE = { common: "var(--stage-mute)", uncommon: "var(--stage-ok)", rare: "var(--stage-link)", legendary: "var(--stage-warn)", mythical: "var(--stage-macro)", unique: "var(--stage-danger-text)" } as const;
const RARITY_ICON: Readonly<Record<Species["rarity"], IconName>> = { common: "lucide:circle", uncommon: "lucide:circle-dot", rare: "lucide:star", legendary: "lucide:crown", mythical: "lucide:sparkles", unique: "lucide:gem" };
const DISPOSITION_TONE = { docile: "var(--stage-ok)", cautious: "color-mix(in srgb,var(--stage-ok) 50%,var(--stage-warn))", neutral: "var(--stage-mute)", aggressive: "color-mix(in srgb,var(--stage-warn) 50%,var(--stage-danger-text))", territorial: "var(--stage-warn)", predatory: "var(--stage-danger-text)" } as const;
const STATUS_TONE = { alive: "var(--stage-ok)", tamed: "var(--stage-macro)", captured: "var(--stage-link)", fled: "var(--stage-mute)", unknown: "var(--stage-mute)", dormant: "var(--stage-link)", dead: "var(--stage-danger-text)" } as const;
const SPECIES_ASK = { module: "codex" } as const;
const CREATURE_ASK = { module: "codex", variant: "creature" } as const;
type Tab = "all" | "species" | "creatures";
const TABS = (s: number, c: number) => [{ id: "all", icon: "lucide:library", label: "All", count: s + c }, { id: "species", icon: "lucide:book-open", label: "Species", count: s }, { id: "creatures", icon: "lucide:paw-print", label: "Creatures", count: c }] as const;
const RARITY_ORDER = ["common", "uncommon", "rare", "legendary", "mythical", "unique"] as const;
const STATUS_ORDER = ["tamed", "alive", "captured", "dormant", "fled", "unknown", "dead"] as const;

const Tag = ({ tone, children }: { tone: string; children: string }): JSX.Element => <span className="it-tag" style={{ "--c": tone } as CSSProperties}>{children}</span>;
function SpeciesPreview({ s }: { s: SpeciesMade }): JSX.Element {
  return <><p><b>{s.name}</b> ({s.rarity}, {s.classification}, {s.disposition})</p><p>{s.description}</p><p className="it-note">Habitat: {s.habitat}</p></>;
}
function CreaturePreview({ c, known }: { c: CreatureMade; known: boolean }): JSX.Element {
  return <><p><b>{c.nickname || "Unnamed"}</b> ({c.speciesName}, {c.status}): {c.condition}, {c.mood}</p>{c.temperament && <p>{c.temperament}</p>}{!known && <p className="it-error" role="alert">No species is called {c.speciesName}. Add that species first.</p>}</>;
}

export function CodexPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "codex", readCodex);
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const cx = view.data;
  const species = liveSpecies(cx).sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
  const creatures = liveCreatures(cx).sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || (b.bond ?? 0) - (a.bond ?? 0));
  const act = (action: Parameters<typeof applyCodex>[1], undoLabel?: string): void => view.apply((d) => applyCodex(d, action), undoLabel);
  const speciesName = (c: Creature): string => cx.species.find((s) => s.id === c.speciesId)?.name ?? "Unknown species";
  const showSpecies = tab !== "creatures" ? species : [];
  const showCreatures = tab !== "species" ? creatures : [];
  const entries = [...showSpecies.map((sp) => ({ id: `s:${sp.id}`, sp })), ...showCreatures.map((c) => ({ id: `c:${c.id}`, c }))];
  return (
    <TrackerFrame label="Creature Codex" title="Creature Codex" icon="lucide:paw-print" tone="color-mix(in srgb,var(--stage-link) 50%,var(--stage-ok))" tokens={tokensOf(codexLines(cx))} view={view} {...(popOut ? { popOut } : {})}
      description="Bestiary entries, creature stats, ecology, and weaknesses."
      onClear={() => view.apply((d) => ({ ...readCodex(undefined), subs: d.subs }), "Cleared")}>
      <Tabs<Tab> tabs={TABS(species.length, creatures.length)} value={tab} onChange={setTab} />
      <div className="st-body">
        <ItemList items={entries} render={(row) => {
          if ("c" in row) {
            const c = row.c;
            return (
              <ItemCard color={STATUS_TONE[c.status]} icon={<Ic name="lucide:paw-print" size={16} />} title={c.nickname || `Unnamed ${speciesName(c)}`}
                meta={<><span>{speciesName(c)}</span><span className="it-line"><Ic name="lucide:map-pin" size={12} />{c.location}</span></>}
                preview={`${c.condition}. ${c.mood}.`}
                right={<div className="it-pillcol"><Tag tone={STATUS_TONE[c.status]}>{c.status}</Tag></div>}
                under={c.bond !== undefined || c.trust !== undefined ? <div className="cx-bt">{c.bond !== undefined && <div><small>Bond</small><div className="bd-bar thin"><div style={{ width: `${c.bond}%`, background: "var(--stage-danger-text)" }} /></div></div>}{c.trust !== undefined && <div><small>Trust</small><div className="bd-bar thin"><div style={{ width: `${c.trust}%`, background: "var(--stage-link)" }} /></div></div>}</div> : null}
                open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)}>
                <RefreshByModel<CreatureMade> ctx={ctx} chatId={chat.id} ask={CREATURE_ASK} noun="creature" existing={{ ...c, speciesName: speciesName(c) }} preview={(m) => <CreaturePreview c={m} known />} accept={(m) => act({ kind: "refreshCreature", id: c.id, creature: m })}
                  extra={<span {...protect("tracker-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" title="Delete creature" onClick={inner(() => { act({ kind: "removeCreature", id: c.id, at: Date.now() }, `Deleted ${c.nickname || "the creature"}`); setOpen(null); })}>Delete</Button></span>} />
                {c.temperament && <Block title="Temperament"><p>{c.temperament}</p></Block>}
                {c.appearance && <Block title="Appearance"><p>{c.appearance}</p></Block>}
                {c.traits && c.traits.length > 0 && <Block title="Traits"><Chips items={c.traits} /></Block>}
                {c.behaviors && c.behaviors.length > 0 && <Block title="Behaviors"><Chips items={c.behaviors} /></Block>}
                <CodexSections e={c} {...(c.currentStats ? { stats: { label: "Current Stats", s: c.currentStats } } : {})} />
                {c.notes && <Block title="Notes"><p>{c.notes}</p></Block>}
                {c.encounters.length > 0 && (
                  <Block title={`Encounters (${c.encounters.length})`}>
                    {c.encounters.map(/* bounded-ok: encounters are capped at MAX_ENCOUNTERS (30) */ (e, i) => <div key={`${e.date}${i}`} className="cx-item"><div><b>{e.date}</b><Tag tone="var(--stage-mute)">{e.outcome}</Tag></div><p>{e.description}</p>{e.notes && <small>{e.notes}</small>}</div>)}
                  </Block>
                )}
              </ItemCard>
            );
          }
          const sp = row.sp;
            const tone = RARITY_TONE[sp.rarity];
            return (
              <ItemCard color={tone} icon={<Ic name={RARITY_ICON[sp.rarity]} size={16} />} title={sp.name}
                meta={(
                  <div className="cx-tax">
                    {sp.taxonomy ? (
                      <>
                        <small>{sp.taxonomy.order}</small><b>{sp.taxonomy.family}</b>
                        {sp.taxonomy.kindRevealed !== false && sp.taxonomy.kind ? <span>{sp.taxonomy.kind}</span> : <em title={sp.taxonomy.kindHint}>Unknown{sp.taxonomy.kindHint ? `: ${sp.taxonomy.kindHint}` : ""}</em>}
                      </>
                    ) : <span className="it-chip">{sp.classification}</span>}
                    <span className="it-line"><Ic name="lucide:map-pin" size={12} />{sp.habitat}</span>
                  </div>
                )}
                preview={sp.description}
                right={<div className="it-pillcol"><Tag tone={tone}>{sp.rarity}</Tag><Tag tone={DISPOSITION_TONE[sp.disposition]}>{sp.disposition}</Tag></div>}
                open={open === sp.id} onToggle={() => setOpen(open === sp.id ? null : sp.id)}>
                <RefreshByModel<SpeciesMade> ctx={ctx} chatId={chat.id} ask={SPECIES_ASK} noun="species" existing={sp} preview={(m) => <SpeciesPreview s={m} />} accept={(m) => act({ kind: "refreshSpecies", id: sp.id, species: m })}
                  extra={<span {...protect("tracker-delete")}><Button variant="danger" size="sm" icon="lucide:trash-2" title="Delete species" onClick={inner(() => { act({ kind: "removeSpecies", id: sp.id, at: Date.now() }, `Deleted ${sp.name} and its creatures`); setOpen(null); })}>Delete</Button></span>} />
                {sp.description && <Block title="Description"><p>{sp.description}</p></Block>}
                {sp.appearance && <Block title="Appearance"><p>{sp.appearance}</p></Block>}
                {sp.baseTraits.length > 0 && <Block title="Traits"><Chips items={sp.baseTraits} /></Block>}
                {sp.baseBehaviors.length > 0 && <Block title="Behaviors"><Chips items={sp.baseBehaviors} /></Block>}
                {(sp.diet || sp.lifespan) && <div className="it-line">{sp.diet && <span>Diet: {sp.diet}</span>}{sp.lifespan && <span>Lifespan: {sp.lifespan}</span>}</div>}
                <CodexSections e={sp} {...(sp.baseStats ? { stats: { label: "Stats", s: sp.baseStats } } : {})} />
                {creaturesOf(cx, sp.id).length > 0 && (
                  <Block title={`Known Creatures (${creaturesOf(cx, sp.id).length})`}>
                    {creaturesOf(cx, sp.id).map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (c) => <div key={c.id} className="cx-item"><div><b>{c.nickname || "Unnamed"}</b><Tag tone={STATUS_TONE[c.status]}>{c.status}</Tag></div><small>{c.condition}, {c.mood}</small>{c.bond !== undefined && <small>Bond {c.bond}{c.trust !== undefined ? ` | Trust ${c.trust}` : ""}</small>}</div>)}
                  </Block>
                )}
              </ItemCard>
            );
        }} />
        {showSpecies.length === 0 && showCreatures.length === 0 && <Empty icon="lucide:paw-print" title="No creatures recorded" hint="Creatures will be logged as the story progresses" />}
        {note && <p className="it-error" role="alert">{note}</p>}
        {tab !== "creatures" && (
          <AddByModel<SpeciesMade> ctx={ctx} chatId={chat.id} ask={SPECIES_ASK} label="Add Species" noun="species" namePlaceholder="Species name" guidePlaceholder="Guide the AI... (e.g., 'a dragon-like creature with crystals')"
            preview={(m) => <SpeciesPreview s={m} />} accept={(m) => { const action = { kind: "addSpecies", species: m, id: `species-${crypto.randomUUID()}` } as const; if (applyCodex(cx, action) === cx) { setNote("The Codex is full, so it was not added."); return; } setNote(null); act(action); }} />
        )}
        {tab !== "species" && (
          <AddByModel<CreatureMade> ctx={ctx} chatId={chat.id} ask={CREATURE_ASK} label="Log Creature" noun="creature" namePlaceholder="Creature nickname" guidePlaceholder="Guide the AI... (e.g., 'a friendly wolf pup')"
            preview={(m) => <CreaturePreview c={m} known={speciesByName(cx, m.speciesName) !== undefined} />}
            accept={(m) => { const action = { kind: "addCreature", creature: m, id: `creature-${crypto.randomUUID()}` } as const; if (applyCodex(cx, action) === cx) { setNote(speciesByName(cx, m.speciesName) ? "The Codex is full, so it was not added." : `No species is called ${m.speciesName}, so the creature was not added. Add that species first.`); return; } setNote(null); act(action); }} />
        )}
      </div>
    </TrackerFrame>
  );
}
