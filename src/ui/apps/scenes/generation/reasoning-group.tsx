/**
 * Reasoning (RoleCall's Reasoning card, SamplerPanel.tsx:889-985): the one Reasoning Effort level, how hard the
 * model thinks before writing. The scene's own setting (ChatStore rule 37 `reasoningEffort`), sent by the request
 * builders of the connections that take it (stage/provider/reasoning-wire.ts); Auto sends nothing. RoleCall's
 * "Reasoning continuity" is left out: nothing in a scene sends earlier native reasoning back, so a switch would
 * do nothing. Own count: the level is "enabled" when it is not Auto.
 */
import { useEffect, useState, type JSX } from "react";
import type { ChatReasoningEffort } from "../../../../stage/contracts/chat-store";
import type { ParamDef } from "../../../../stage/params";
import { EFFORT_KINDS, REASONING_EFFORT_OPTIONS } from "../../../../stage/params/reasoning";
import { paramById } from "../../../../stage/params";
import { Ic } from "../../../_shared/ic";
import { useGenerationSection, type GenerationEnv } from "./generation-env";
import { SettingCard } from "./setting-card";
import type { PromptingView } from "./use-prompting-view";

export function ReasoningGroup({ env, prompting, params, searching }: { env: GenerationEnv; prompting: PromptingView; params: readonly ParamDef[]; searching: boolean }): JSX.Element | null {
  const { ctx, chat } = env;
  const effort = prompting.view.reasoningEffort;
  const [kind, setKind] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void ctx.api.sceneConnections().then((all) => { if (live) setKind(all.find((c) => c.id === chat.connection?.id)?.kind ?? null); }, () => undefined);
    return () => { live = false; };
    // the api object is rebuilt on every status change; only the scene's connection decides a re-read
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.connection?.id]);
  useGenerationSection("reasoning", effort ? 1 : 0, () => prompting.write({ reasoningEffort: null }, "Reasoning Effort"));
  const def = params[0];
  if (!def) return null;
  const silent = effort !== undefined && kind !== null && !EFFORT_KINDS.includes(kind);
  return (
    <section className="gn-box" data-part="scene.generation.reasoning">
      <div className="gn-bh"><Ic name="mdi:head-cog-outline" size={16} /><b>Reasoning</b><small>Provider-native reasoning</small></div>
      <div className="gn-bb">
        {silent && <p className="gn-lead" role="status">This scene&apos;s connection takes no reasoning level, so the choice is kept but nothing is sent.</p>}
        <SettingCard def={def} enabled toggle={false} value={effort ?? "auto"} options={REASONING_EFFORT_OPTIONS}
          onChange={(v) => { const next = v === "auto" ? null : (v as ChatReasoningEffort); prompting.write({ reasoningEffort: next }, "Reasoning Effort"); }} />
        {!searching && <details className="gn-det" data-part="scene.generation.continuity">
          <summary><Ic name="mdi:chevron-right" size={14} />Reasoning continuity <small>(advanced)</small></summary>
          <SettingCard def={paramById("roundtrip_native_reasoning")!} enabled={prompting.view.continuity === true} value={prompting.view.continuity === true} onToggle={(on) => prompting.write({ continuity: on ? true : null }, "Reasoning continuity")} onChange={(v) => prompting.write({ continuity: v === true ? true : null }, "Reasoning continuity")} />
        </details>}
      </div>
    </section>
  );
}
