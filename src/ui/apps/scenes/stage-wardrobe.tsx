/**
 * The Stage wing's Wardrobe tab (RoleCall's WardrobeWingPanel, an Understudies beta there; Bunraku has no tiers). Every theme-shaped display
 * rule the scene's regex sets carry (core/regex/wardrobe.ts) hung on a rack. An outfit paired with a roster option of the preset's choice
 * group goes in or out of rotation by writing that choice answer (the preset's own engine picks who takes the stage); a single-rule
 * standalone dress is worn or hung by switching its set on or off for the scene; components are counted, never controlled. Nothing here
 * runs a rule: the look itself is the scene's display regex in the sandbox worker, so a worn dress dresses messages through the same path
 * as any set. The tab body carries no title; the strip owns it.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import type { PresetBody } from "../../../entities/preset/schema";
import { bodyOf } from "../../../core/guards";
import { classifyThemeRule, pairWithRoster, type RosterPairing, type WardrobeEntry } from "../../../core/regex/wardrobe";
import { strArray } from "../../../core/guards";
import type { ChoiceGroup } from "../../../core/macros/choice-groups";
import type { StageTab, StageTabProps } from "./stage-tabs";
import { useSceneChoices } from "./use-scene-choices";
import { useSceneRegexSets } from "./use-scene-regex";
import { useSceneRegexPicks } from "./use-scene-regex-picks";

interface Dress { entry: WardrobeEntry; setId: string; setName: string }

const swatch = (color: string): CSSProperties => ({ background: color });
function Swatch({ colors }: { colors: string[] }): JSX.Element | null {
  return colors.length === 0 ? null : <span className="wd-sw">{colors.map((c) => <i key={c} style={swatch(c)} />)}</span>;
}

/** The scene's preset body, read once per preset; "unreadable" is a state the rack says, never a silent empty roster. */
function usePresetBody(ctx: StageTabProps["ctx"], presetId: string | null): { body: PresetBody | null; unreadable: boolean } {
  const [state, setState] = useState<{ body: PresetBody | null; unreadable: boolean }>({ body: null, unreadable: false });
  const api = useRef(ctx.api);
  api.current = ctx.api;
  useEffect(() => {
    let live = true;
    setState({ body: null, unreadable: false });
    if (!presetId) return;
    api.current.getEntity(`kind=preset&id=${encodeURIComponent(presetId)}`).then(
      (e) => { const body = bodyOf(e); if (live) setState(Array.isArray(body["prompts"]) ? { body: body as unknown as PresetBody, unreadable: false } : { body: null, unreadable: true }); },
      () => { if (live) setState({ body: null, unreadable: true }); },
    );
    return () => { live = false; };
  }, [presetId]);
  return state;
}

function Wardrobe({ ctx, chat, onChat }: StageTabProps): JSX.Element {
  const presetId = chat.preset?.id ?? null;
  const { body, unreadable } = usePresetBody(ctx, presetId);
  const picks = useSceneRegexPicks(ctx, chat, onChat);
  // The sets on and the sets hung on this scene's rack: both are read for the rack, only the ones on dress anything.
  const sets = useSceneRegexSets(ctx.api, [...new Set([...(chat.regex?.sets ?? []), ...picks.rack])]);
  const choices = useSceneChoices(ctx, chat, body, onChat);
  const [busy, setBusy] = useState<string | null>(null);

  const { outfits, standalone, components } = useMemo(() => {
    const outfits: Dress[] = [];
    const standalone: Dress[] = [];
    let components = 0;
    for (const set of sets ?? []) {
      const themed = set.rules.flatMap((r) => classifyThemeRule(r) ?? []);
      for (const entry of themed) {
        const dress = { entry, setId: set.id, setName: set.name ?? set.id };
        if (entry.kind === "outfit") outfits.push(dress);
        else if (set.rules.length === 1) standalone.push(dress);
        else components += 1;
      }
    }
    return { outfits, standalone, components };
  }, [sets]);
  const rack = standalone;

  const roster = useMemo(() => pairWithRoster(outfits.map((o) => o.entry), choices.groups), [outfits, choices.groups]);
  const byGroup = new Map<string, RosterPairing[]>();
  for (const p of roster.paired) byGroup.set(p.groupId, [...(byGroup.get(p.groupId) ?? []), p]);
  const isEmpty = byGroup.size === 0 && roster.unpaired.length === 0 && rack.length === 0;

  const guard = async (key: string, work: () => Promise<void>): Promise<void> => {
    setBusy(key);
    try { await work(); } catch { /* the failure is shown by the writer's own status */ } finally { setBusy(null); }
  };
  const toggleRoster = (group: ChoiceGroup, optionId: string): Promise<void> => guard(`${group.id}:${optionId}`, async () => {
    if (group.type === "select_one") { await choices.select(group.id, optionId); return; }
    const current = strArray(choices.selections[group.id]);
    await choices.select(group.id, current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]);
  });

  return (
    <div className="wbody wd" data-part="scene.stage.wardrobe">
      {unreadable && (
        <div className="pg-card"><div className="pg-label">This chat&apos;s preset could not be read</div>
          <p className="pg-help">It may have been deleted or replaced since this chat was set up, so no troupe can pair with its choices. Re-select the preset in the Prompting wing and the roster will assemble.</p></div>
      )}
      {isEmpty && (
        <div className="pg-card"><div className="pg-label">The wardrobe is bare</div>
          <p className="pg-help">No selected preset or script carries message themes in this chat. Import a themed preset, or add themed scripts from the Regex library in the Final Cut wing.</p></div>
      )}
      {[...byGroup].map(([groupId, pairings]) => {
        const group = choices.groups.find((g) => g.id === groupId);
        if (!group) return null;
        const value = choices.selections[groupId];
        const worn = (optionId: string): boolean => (group.type === "select_one" ? value === optionId : strArray(value).includes(optionId));
        return (
          <section key={groupId} className="pg-card">
            <div className="pg-label">{group.label || "The Troupe"}<small>{group.type === "select_many" ? "The show decides who takes the stage each beat" : "One on stage at a time"}</small></div>
            <div className="wd-list">
              {pairings.map(({ entry, optionId }) => {
                const on = worn(optionId);
                return (
                  <div key={entry.ruleId} className={`wd-row${on ? " on" : ""}`}>
                    <Swatch colors={entry.swatch} />
                    <b>{entry.displayName}</b>
                    <button type="button" className={`pg-chip${on ? " on" : ""}`} aria-pressed={on} disabled={busy === `${groupId}:${optionId}`} onClick={() => void toggleRoster(group, optionId)}>
                      {busy === `${groupId}:${optionId}` ? "..." : on ? "In rotation" : "Resting"}
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="pg-help">Roster changes take the stage on the next reply.</p>
          </section>
        );
      })}
      {rack.length > 0 && (
        <section className="pg-card">
          <div className="pg-label">Standalone dresses</div>
          <div className="wd-list">
            {rack.map(({ entry, setId, setName }) => {
              const on = picks.on.includes(setId);
              return (
                <div key={setId} className={`wd-row${on ? " on" : ""}`}>
                  <Swatch colors={entry.swatch} />
                  <span className="wd-name"><b>{entry.displayName}</b><small>{setName}</small></span>
                  <button type="button" className={`pg-chip${on ? " on" : ""}`} aria-pressed={on} disabled={busy === setId} onClick={() => void guard(setId, () => picks.wear(setId, !on))}>
                    {busy === setId ? "..." : on ? "Worn" : "Hang it"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {roster.unpaired.length > 0 && (
        <section className="pg-card">
          <div className="pg-label">Loose garments</div>
          <div className="wd-list">
            {roster.unpaired.map((entry) => (
              <div key={entry.ruleId} className="wd-row loose"><Swatch colors={entry.swatch} /><b>{entry.displayName}</b><small>No caster found</small></div>
            ))}
          </div>
          <p className="pg-help">These looks answer to a director this preset does not cast from its choices.</p>
        </section>
      )}
      {!isEmpty && (
        <div className="wd-foot">
          <p>+ Looks restyle how replies are dressed; the words are never touched.</p>
          <p>+ Wearing a look costs no tokens; a roster change is the preset&apos;s own choice and is sent like any other.</p>
          {components > 0 && <p>+ {components} companion props travel with these looks and manage themselves.</p>}
        </div>
      )}
    </div>
  );
}

export const WARDROBE_TAB: StageTab = { id: "wardrobe", label: "Wardrobe", visible: () => true, Panel: Wardrobe };
