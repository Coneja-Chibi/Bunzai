/**
 * Core (RoleCall's CoreSection, SamplerPanel.tsx:509-577): temperature, top P, top K and max reply length,
 * open by default. They are the scene's own sampler overrides (ChatStore rule 19), the same values the
 * Prompting wing's Preset tab and the Control Booth write, through the same writer, so a change here is
 * a change there. A card reads the scene's value, else the preset's, else nothing is set and the provider
 * decides. RoleCall's footer under each card: "From preset", or "Changed for this chat" with a reset.
 */
import { useState, type JSX } from "react";
import type { ChatPreset } from "../../../../stage/contracts/chat-store";
import { CORE_FIELD, CORE_PARAMS, type CoreId } from "../../../../stage/params/core";
import type { ParamDef } from "../../../../stage/params";
import { Ic } from "../../../_shared/ic";
import { coreChangedCount, coreValue } from "./generation-core";
import type { GenerationEnv } from "./generation-env";
import { SettingCard } from "./setting-card";

/** The Core cards that match the search (all of them when it is blank). */
export function CoreGroup({ env, params, searching }: { env: GenerationEnv; params: readonly ParamDef[]; searching: boolean }): JSX.Element | null {
  const [open, setOpen] = useState(true);
  const { own, preset } = env;
  const body = preset.state === "ready" ? preset.body : null;
  if (params.length === 0) return null;
  const changed = own.own ? coreChangedCount(own.own) : 0;
  const expanded = open || searching;
  return (
    <section className="gn-grp" data-part="scene.generation.core">
      <button type="button" className="gn-gh" aria-expanded={expanded} aria-label={`Core category ${expanded ? "expanded" : "collapsed"}`} onClick={() => setOpen(!open)}>
        <span className="gn-ico"><Ic name="mdi:star-four-points-outline" size={16} /></span>
        <b>Core</b>
        <small>{searching ? `${params.length} found` : changed === 0 ? "from preset" : `${changed}/${CORE_PARAMS.length} changed for this chat`}</small>
        <span className={`chev${expanded ? " up" : ""}`}><Ic name="mdi:chevron-down" size={16} /></span>
      </button>
      {expanded && (
        <div className="gn-gb">
          {!own.own || !body ? (
            <p className="gn-lead">{env.chat.preset ? "Core values load with the preset." : "Core values belong to the scene's preset. Choose one in Prompting."}</p>
          ) : (
            <>
              <p className="gn-lead">Same values as Prompting &gt; Preset and the Control Booth. Changing one here changes it there.</p>
              {params.map((def) => {
                const { value, from } = coreValue(def, own.own!, body.samplers);
                const field = CORE_FIELD[def.id as CoreId];
                const set = (next: number | undefined): void => own.setSamplerValue(body.samplers, field, next as ChatPreset["samplers"][typeof field]);
                return (
                  <div key={def.id} className="gn-one">
                    <SettingCard def={def} enabled toggle={false} value={value} onChange={(v) => { if (typeof v === "number" && Number.isFinite(v)) set(v); }} />
                    <div className="gn-foot">
                      {from === "scene" ? (
                        <><span>Changed for this chat</span><button type="button" aria-label={`Reset ${def.label} to preset`} onClick={() => set(body.samplers?.[field])}>Reset to preset</button></>
                      ) : <span>{from === "preset" ? "From preset" : "Not set: the provider decides"}</span>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </section>
  );
}
