/**
 * The AI wing's Generation tab (RoleCall's right-wing AI > Generation, RightWingPanelContent.tsx:418 and
 * SamplerPanel.tsx): the hero, "N parameter enabled" with Reset, the parameter search, then the groups in
 * RoleCall's order: Core, the two-kinds callout, Reasoning, Thinking in Replies, and the catalogue
 * (catalogue.ts). While a search is typed only the groups' matching cards show, flat, as in RoleCall
 * (which hides the callout and Thinking in Replies then). One scene preset writer (`own`) is shared by
 * every group and with the Prompting wing and the Control Booth: RoleCall keeps a second sampler store
 * for this panel (flaw F1, 02-control-booth.md); Bunraku does not. Reset clears the scene's Core
 * overrides, Reasoning Effort and each catalogue group; it never touches library preset text.
 */
import { useMemo, useRef, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { Chat } from "../../../../stage/contracts/chat-store";
import { PARAMS, paramsIn, type ParamDef } from "../../../../stage/params";
import { Ic } from "../../../_shared/ic";
import { useBoothPreset } from "../use-booth-preset";
import { useScenePresetOwn } from "../use-scene-preset-own";
import { CATALOGUE } from "./catalogue";
import { CoreGroup } from "./core-group";
import { GenerationReport, type GenerationEnv } from "./generation-env";
import { matchParams, resetCore } from "./generation-core";
import { ReasoningGroup } from "./reasoning-group";
import { usePromptingView } from "./use-prompting-view";
import { ThinkingCallout } from "./thinking-callout";
import { ThinkingGroup } from "./thinking-group";

export function GenerationTab({ ctx, chat, onChat }: { ctx: AppContext; chat: Chat; onChat(chat: Chat): void }): JSX.Element {
  const [note, setNote] = useState<string | null>(null);
  const preset = useBoothPreset(ctx, chat.preset?.id ?? null);
  const own = useScenePresetOwn(ctx, chat, onChat, setNote);
  const prompting = usePromptingView(ctx, chat, onChat);
  const level = prompting.view.reasoningEffort;
  const env: GenerationEnv = { ctx, chat, onChat, own, preset, thinking: level !== undefined && level !== "none" };
  const [query, setQuery] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const resets = useRef(new Map<string, () => void>());
  const reporter = useMemo(() => ({
    report(id: string, count: number, reset?: () => void) {
      if (reset) resets.current.set(id, reset);
      setCounts((c) => (c[id] === count ? c : { ...c, [id]: count }));
    },
  }), []);
  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  const searching = query.trim() !== "";
  const hit = (group: ParamDef["group"]): readonly ParamDef[] => matchParams(paramsIn(group), query);
  const none = searching && matchParams(PARAMS.filter((p) => p.group !== "thinking"), query).length === 0;
  return (
    <GenerationReport.Provider value={reporter}>
      <div className="wbody gn" data-part="scene.generation">
        <div className="pp-top">
          <header className="hero">
            <span className="hi"><Ic name="mdi:tune-vertical" size={20} /></span>
            <div><div className="eb">Narrator output controls</div><h2>Generation</h2>
              <p>How long, how adventurous and how carefully the AI writes. Core values come from your preset; turn on any other parameter your model supports, and anything left off uses the provider default.</p></div>
          </header>
        </div>
        <div className="gn-body">
        <div className="gn-bar"><span>{total} parameter{total === 1 ? "" : "s"} enabled</span>
          <button type="button" className="gn-reset" onClick={() => { own.edit(resetCore); resets.current.forEach((reset) => reset()); }}><Ic name="mdi:refresh" size={14} /> Reset</button></div>
        <div role="search" aria-label="Search sampler parameters" className="gn-search"><Ic name="mdi:magnify" size={16} />
          <input type="text" value={query} placeholder="Search parameters by name, description, or alias..." aria-label="Search parameters by name, description, or alias" onChange={(e) => setQuery(e.target.value)} />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><Ic name="mdi:close" size={16} /></button>}</div>
        <div className="sr-only" aria-live="polite">{searching && (none ? `No parameters found matching "${query}"` : "")}</div>
        {none && <p className="gn-none" role="status">No parameters match &quot;{query}&quot;.</p>}
        <CoreGroup env={env} params={hit("core")} searching={searching} />
        {!searching && <ThinkingCallout />}
        <ReasoningGroup env={env} prompting={prompting} params={hit("reasoning")} searching={searching} />
        {!searching && <ThinkingGroup env={env} prompting={prompting} />}
        {CATALOGUE.map((s) => <s.Panel key={s.id} env={env} query={query} />)}
        {note && <p className="gn-warn" role="alert">{note}</p>}
        </div>
      </div>
    </GenerationReport.Provider>
  );
}
