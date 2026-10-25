/**
 * The Bonds panel (RoleCall BondsWingPanel.tsx:321-752): the total bond strength and the strongest bond, the Active and Broken tabs with their counts, expandable
 * bond cards with an intensity stripe and bar, Refresh by the model and Break under each active bond, and "Add Bond" (partner, guide, Generate). The rules are
 * core/trackers/bonds.ts; this draws them and writes each change as one whole state (ChatStore rule 43). Generate and Refresh propose a bond kept only on Accept;
 * Break leaves an Undo. Strengthening and weakening a bond are the Story Director's.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { activeBonds, applyBonds, bondsLines, brokenBonds, intensityOf, readBonds, strongest, totalStrength, type Bond, type BondType, type Intensity } from "../../../../../../core/trackers/bonds";
import { tokensOf } from "../../../../../../core/trackers/list";
import { Ic, type IconName } from "../../../../../_shared/ic";
import { protect } from "../../../../../_shared/protected-control";
import type { PopoutContext } from "../../../popout/popout-kind";
import { AddByModel, RefreshByModel } from "../items/generate-kit";
import { Block, Empty, ItemCard, Tabs, inner } from "../items/item-parts";
import { TrackerFrame } from "../tracker-frame";
import { useTracker } from "../use-tracker";

const TONE: Readonly<Record<Intensity, string>> = {
  faint: "var(--stage-mute)", weak: "color-mix(in srgb,var(--stage-ok) 50%,var(--stage-warn))", moderate: "var(--stage-link)", strong: "var(--stage-macro)",
  overwhelming: "color-mix(in srgb,var(--stage-danger-text) 60%,var(--stage-macro))", absolute: "var(--stage-danger-text)",
};
const TYPE_ICON: Readonly<Record<BondType, IconName>> = { sire_childe: "lucide:droplet", blood_bound: "lucide:heart-pulse", pack_member: "lucide:paw-print", coven_bond: "lucide:moon", soul_link: "lucide:infinity", familiar: "lucide:bird", oath_bound: "lucide:shield-check", curse_linked: "lucide:skull", dream_walker: "lucide:cloud-moon", telepathic: "lucide:brain", life_debt: "lucide:scale", custom: "lucide:link" };
const TYPE_NAME: Readonly<Record<BondType, string>> = { sire_childe: "Sire/Childe", blood_bound: "Blood Bound", pack_member: "Pack Bond", coven_bond: "Coven Bond", soul_link: "Soul Link", familiar: "Familiar", oath_bound: "Oath Bound", curse_linked: "Curse Linked", dream_walker: "Dream Walker", telepathic: "Telepathic", life_debt: "Life Debt", custom: "Custom" };
const WORDS: Readonly<Record<Intensity, string>> = { faint: "Barely perceptible connection", weak: "A tenuous thread binding you", moderate: "A steady presence in your mind", strong: "A powerful pull you cannot ignore", overwhelming: "Dominating your thoughts and actions", absolute: "Complete and total connection" };
const ASK = { module: "bonds" } as const;
type Tab = "active" | "broken";

function Preview({ b }: { b: Bond }): JSX.Element {
  return (
    <>
      <p><b>{b.partnerName}</b> ({b.customTypeName || TYPE_NAME[b.bondType]}, {intensityOf(b.intensityValue)} {b.intensityValue}/100)</p>
      {b.description && <p>{b.description}</p>}
      {b.activeEffects.length > 0 && <p className="it-note">Effects: {b.activeEffects.join("; ")}</p>}
      {b.drawbacks && b.drawbacks.length > 0 && <p className="it-note">Drawbacks: {b.drawbacks.join("; ")}</p>}
    </>
  );
}

export function BondsPanel({ ctx, chat, onChat, popOut }: PopoutContext): JSX.Element {
  const view = useTracker({ ctx, chat, ...(onChat ? { onChat } : {}) }, "bonds", readBonds);
  const [tab, setTab] = useState<Tab>("active");
  const [open, setOpen] = useState<string | null>(null);
  const bonds = view.data;
  const active = activeBonds(bonds), broken = brokenBonds(bonds);
  const top = strongest(bonds);
  const shown = tab === "active" ? active : broken;
  const act = (action: Parameters<typeof applyBonds>[1], undoLabel?: string): void => view.apply((d) => applyBonds(d, action), undoLabel);
  const tabs = [{ id: "active", icon: "lucide:link", label: "Active", ...(active.length > 0 ? { count: active.length } : {}) }, { id: "broken", icon: "lucide:link-2-off", label: "Broken", ...(broken.length > 0 ? { count: broken.length } : {}) }] as const;
  return (
    <TrackerFrame label="Bonds" title="Supernatural Bonds" icon="lucide:link" tone="var(--stage-danger-text)" tokens={tokensOf(bondsLines(bonds))} view={view} {...(popOut ? { popOut } : {})}
      description="Tracks supernatural or deep connections between characters. The AI uses bond strength to influence interactions."
      onClear={() => view.apply(() => readBonds(undefined), "Cleared")}
      badge={active.length > 0 ? <span className="it-pill">{active.length} {active.length === 1 ? "BOND" : "BONDS"}</span> : null}>
      <div className="it-sum">
        <div><div><small>Total Bond Strength</small><b>{totalStrength(bonds)}</b></div></div>
        {top && <div className="r"><small>Strongest Bond</small><span className="it-line" style={{ color: TONE[intensityOf(top.intensityValue)] }}><Ic name={TYPE_ICON[top.bondType]} size={14} /><b style={{ color: TONE[intensityOf(top.intensityValue)], fontSize: "var(--text-control)" }}>{top.partnerName}</b></span></div>}
      </div>
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} />
      <div className="st-body">
        {shown.length > 0 ? (
          <div className="it-list">
            {shown.map((b) => {
              const word = intensityOf(b.intensityValue);
              const color = TONE[word];
              return (
                <ItemCard key={b.id} color={color} icon={<Ic name={TYPE_ICON[b.bondType]} size={16} />} title={b.partnerName}
                  meta={<>{!b.isActive && <span className="it-tag" style={{ "--c": "var(--stage-mute)" } as CSSProperties}>BROKEN</span>}<span>{b.customTypeName || TYPE_NAME[b.bondType]}{b.playerRole ? ` • ${b.playerRole}` : ""}</span></>}
                  right={<span className="it-tag" style={{ "--c": color } as CSSProperties}>{word}</span>}
                  under={<div className="bd-bar"><div style={{ width: `${b.intensityValue}%`, background: color }} /></div>}
                  open={open === b.id} onToggle={() => setOpen(open === b.id ? null : b.id)}
                  foot={b.isActive ? (
                    <RefreshByModel<Bond> ctx={ctx} chatId={chat.id} ask={ASK} noun="bond" existing={b} preview={(x) => <Preview b={x} />} accept={(x) => act({ kind: "refresh", id: b.id, bond: x })}
                      extra={b.canBeBroken
                        ? <button type="button" {...protect("tracker-delete", "it-act bad")} title="Break bond" aria-label={`Break the bond with ${b.partnerName}`} onClick={inner(() => act({ kind: "break", id: b.id }, `Broke the bond with ${b.partnerName}`))}><Ic name="lucide:trash-2" size={14} /><span>Break</span></button>
                        : <span className="it-note" title="This bond cannot be broken">Unbreakable</span>} />
                  ) : undefined}>
                  {b.description && <Block title="Description"><p>{b.description}</p></Block>}
                  <Block title={`Intensity: ${word} (${b.intensityValue}/100)`}><p className="it-quiet">{b.intensityDescription || WORDS[word]}</p></Block>
                  {(b.partnerRole || b.playerRole) && (
                    <div className="bd-roles">
                      {b.partnerRole && <div><small>{b.partnerName}</small><b>{b.partnerRole}</b></div>}
                      {b.playerRole && <div><small>You</small><b>{b.playerRole}</b></div>}
                    </div>
                  )}
                  {b.activeEffects.length > 0 && <Block title="Active Effects">{b.activeEffects.map((e, i) => <div key={`${e}${i}`} className="bd-eff good"><Ic name="lucide:circle-plus" size={14} /><span>{e}</span></div>)}</Block>}
                  {b.drawbacks && b.drawbacks.length > 0 && <Block title="Drawbacks">{b.drawbacks.map((e, i) => <div key={`${e}${i}`} className="bd-eff bad"><Ic name="lucide:circle-minus" size={14} /><span>{e}</span></div>)}</Block>}
                  <div className="it-chips"><span className={`it-chip${b.canBeBroken ? "" : " bad"}`}>{b.canBeBroken ? "Can be broken" : "Unbreakable"}</span></div>
                  <div className="it-fine">
                    <div>Formed: {new Date(b.formedAt).toLocaleString()}</div>
                    {b.lastStrengthened && <div>Last strengthened: {new Date(b.lastStrengthened).toLocaleString()}</div>}
                    {b.lastWeakened && <div>Last weakened: {new Date(b.lastWeakened).toLocaleString()}</div>}
                  </div>
                </ItemCard>
              );
            })}
          </div>
        ) : <Empty icon={tab === "active" ? "lucide:link" : "lucide:link-2-off"} title={tab === "active" ? "No active bonds" : "No broken bonds"} hint={tab === "active" ? "You walk this path alone... for now" : "No bonds have been severed"} />}
        {tab === "active" && (
          <AddByModel<Bond> ctx={ctx} chatId={chat.id} ask={ASK} label="Add Bond" noun="bond" namePlaceholder="Partner Name" guidePlaceholder="Guide the AI... (e.g., 'a blood bond with my sire')"
            preview={(x) => <Preview b={x} />} accept={(x) => act({ kind: "form", bond: x, id: `bond-${crypto.randomUUID()}`, at: Date.now() })} />
        )}
      </div>
    </TrackerFrame>
  );
}
