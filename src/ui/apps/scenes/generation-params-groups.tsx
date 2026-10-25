/**
 * The Generation tab's parameter groups (RoleCall's SamplerPanel.tsx:1292-1346 and :1438): Nucleus
 * Sampling, Repetition Penalties, Output Constraints and Advanced, each a collapsible with an "N/M
 * enabled" count and one plain line of purpose, then Custom Request Parameters and the closing note.
 * Everything writes through the scene's one preset writer (use-scene-preset-own.ts): a switch off means
 * the parameter is not sent. A scene with no preset has nowhere to keep them, so the groups say so.
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { Ic, type IconName } from "../../_shared/ic";
import type { PresetSamplers } from "../../../entities/preset/schema";
import { PARAMS, paramsIn, type ParamDef, type ParamGroup, type ParamValue } from "../../../stage/params";
import type { Chat, ChatPresetSamplers } from "../../../stage/contracts/chat-store";
import { matchParams } from "./generation/generation-core";
import { cardState, enabledCount, parentOn, setCard, withCustom } from "./generation-params-core";
import { ParamCard, type ProviderInfo } from "./generation-params-card";
import { CustomRequestParams } from "./generation-params-custom";
import type { ScenePresetOwn } from "./use-scene-preset-own";

const GROUPS: readonly { group: ParamGroup; title: string; icon: IconName; purpose: string; open?: boolean }[] = [
  { group: "nucleus", title: "Nucleus Sampling", icon: "mdi:target", purpose: "Fine-grained word choice filters: Min P, Typical P, TFS, Top A.", open: true },
  { group: "penalties", title: "Repetition Penalties", icon: "mdi:repeat-off", purpose: "Stop the AI repeating words and phrases." },
  { group: "constraints", title: "Output Constraints", icon: "mdi:shield-lock-outline", purpose: "Where replies stop and how their output is shaped." },
  { group: "advanced", title: "Advanced", icon: "mdi:flask-outline", purpose: "Beam search, behavioral, miscellaneous and experimental settings." },
];

/** The connection the scene sends through, as the "not sent to" marker needs it: its name and the parameters it takes. */
export function useGenerationProvider(ctx: AppContext, chat: Chat): ProviderInfo | null {
  const [info, setInfo] = useState<ProviderInfo | null>(null);
  const id = chat.connection?.id;
  useEffect(() => {
    let live = true;
    if (!id) { setInfo(null); return; }
    ctx.api.sceneConnections().then((list) => {
      const c = list.find((x) => x.id === id);
      if (live) setInfo(c?.params ? { label: c.label, accepts: new Set(c.params) } : null);
    }, () => { if (live) setInfo(null); });
    return () => { live = false; };
  }, [ctx, id]);
  return info;
}

interface GroupProps {
  id: ParamGroup;
  title: string;
  icon: IconName;
  purpose: string;
  defs: readonly ParamDef[];
  samplers: ChatPresetSamplers;
  typed: PresetSamplers;
  provider: ProviderInfo | null;
  open: boolean;
  query: string;
  model: string | undefined;
  onChange(def: ParamDef, change: { on?: boolean; value?: ParamValue }): void;
}

function Group({ id, title, icon, purpose, defs, samplers, typed, provider, open: initial, query, model, onChange }: GroupProps): JSX.Element | null {
  const [open, setOpen] = useState(initial);
  const n = enabledCount(defs, samplers.params, typed);
  // A search shows the matching cards flat and opens the group; a group with none is not drawn.
  const shown = matchParams(defs, query);
  if (query.trim() && shown.length === 0) return null;
  const expanded = open || query.trim() !== "";
  return (
    <section className="gp-group" data-part={`scene.generation.group.${id}`}>
      <button type="button" className="gp-ghead" aria-expanded={expanded} aria-label={`${title} category ${expanded ? "expanded" : "collapsed"}`} onClick={() => setOpen(!open)}>
        <Ic name={icon} size={16} />
        <span className="gp-gtext"><span className="gp-gline"><b>{title}</b><small>{query.trim() ? `${shown.length} found` : `${n}/${defs.length} enabled`}</small></span><span className="gp-purpose">{purpose}</span></span>
        <Ic name={expanded ? "mdi:chevron-up" : "mdi:chevron-down"} size={16} />
      </button>
      {expanded && (
        <div className="gp-cards">
          {shown.map((d) => <ParamCard key={d.id} def={d} state={cardState(d, samplers.params, typed)} provider={provider} greyed={!parentOn(d, samplers.params, typed, PARAMS)} model={model} onChange={(c) => onChange(d, c)} />)}
        </div>
      )}
    </section>
  );
}

export function GenerationParamGroups({ own, presetSamplers, provider, model, query = "", thinking }: { own: ScenePresetOwn; presetSamplers: PresetSamplers | undefined; provider: ProviderInfo | null; /** The scene's model id (`chat.connection?.model`). */ model?: string; /** The tab's search text: matching cards show flat. */ query?: string; /** Whether thinking is on for this scene (Reasoning Effort is a level): the Enable Thinking the Clear Thinking card hangs from. */ thinking?: boolean }): JSX.Element {
  if (!own.own) return <p className="gp-quiet">Generation settings belong to the scene&apos;s preset. Choose one in Prompting.</p>;
  const scene = own.own;
  const typed: PresetSamplers = { ...presetSamplers, ...scene.samplers };
  // The one writer's edit, on the latest values: a Reset or another group's change in the same tick is never lost.
  const change = (def: ParamDef, c: { on?: boolean; value?: ParamValue }): void =>
    own.edit((p) => ({ ...p, samplers: { ...p.samplers, params: setCard(def, p.samplers.params, typed, c) } }));
  const view = thinking === undefined ? scene.samplers : { ...scene.samplers, params: { ...scene.samplers.params, enable_thinking: { on: thinking } } };
  const searching = query.trim() !== "";
  return (
    <div className="gp" data-part="scene.generation.params">
      {GROUPS.map((g) => <Group key={g.group} id={g.group} title={g.title} icon={g.icon} purpose={g.purpose} defs={paramsIn(g.group)} samplers={view} typed={typed} provider={provider} open={g.open === true} query={query} model={model} onChange={change} />)}
      {!searching && <CustomRequestParams samplers={scene.samplers} onSave={(key, text) => own.edit((p) => ({ ...p, samplers: withCustom(p.samplers, key, text) }))} />}
      {!searching && <div className="gp-foot"><Ic name="mdi:information-outline" size={16} /><p>Enable parameters to send them to your AI provider. Unsupported parameters are ignored.</p></div>}
    </div>
  );
}
