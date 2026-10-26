/**
 * The Final Cut wing's Final Cut tab (RoleCall's PostProductionPanel.tsx, 2,614 lines, in the order it draws them): the hero, the stats
 * strip, the On-demand editing tools, the Output Safety Check, the Anti-Slop Engine with Custom Banks, the Scene Editor and Translator
 * side by side, Your Department full width, the Pipeline Prompt Contract and the footer. RoleCall hides the whole wing until the Props
 * row "Final Cut" is on; Bunraku keeps the wing on the rail (the Regex tab lives there), so the switch that decides whether new replies
 * run the passes is the card under the hero, off until it is turned on.
 */
import type { CSSProperties, JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { activePasses, type FinalCutPass } from "../../../../core/final-cut/pass";
import type { Chat } from "../../../../stage/contracts/chat-store";
import { Ic } from "../../../_shared/ic";
import { useSceneModels, type SceneModels } from "../use-scene-models";
import { AgentControls } from "./fc-agent";
import { AntiSlopCard, LiveSwitch, SafetyCard } from "./fc-anti-slop";
import { Contract } from "./fc-contract";
import { CREATIVE_PASSES, onPass, stats } from "./fc-core";
import { EditorControls } from "./fc-editor";
import { PassChrome } from "./fc-pass-chrome";
import { ToolsCard } from "./fc-tools-card";
import { TranslatorControls } from "./fc-translator";
import { UserBanksCard } from "./fc-user-banks";
import { useFinalCut, type FinalCutState } from "./use-final-cut";
import { useFinalCutLibrary, type FinalCutLibrary } from "./use-final-cut-library";

type Spec = (typeof CREATIVE_PASSES)[number];

/** One creative pass's card: a component of its own so a keystroke in it never remounts it. */
function PassCard({ spec, ctx, fc, lib, models }: { spec: Spec; ctx: AppContext; fc: FinalCutState; lib: FinalCutLibrary; models: SceneModels }): JSX.Element {
  const stored = fc.settings.passes?.find((p) => p.type === spec.type);
  const live = onPass(fc.settings.passes, spec.type) !== undefined;
  const change = (patch: Partial<FinalCutPass>): void => fc.patch(spec.type, patch);
  return (
    <article className={`fc-card fc-pass${live ? " on" : ""}`} style={{ "--p": spec.tone } as CSSProperties} data-part={`scene.finalcut.pass.${spec.type}`}>
      <header>
        <div><div className="kick">{spec.kicker}</div><h3>{spec.title}</h3></div>
        <LiveSwitch on={live} onToggle={() => fc.toggle(spec.type)} />
      </header>
      <div className="fc-body">
        <p>{spec.text}</p>
        {live && stored ? (
          <>
            <div className="fc-controls"><PassChrome pass={stored} models={models} onChange={change} /></div>
            {spec.type === "editor" && <EditorControls pass={stored} onChange={change} />}
            {spec.type === "translator" && <TranslatorControls pass={stored} onChange={change} />}
            {spec.type === "custom-agent" && <AgentControls ctx={ctx} pass={stored} lib={lib} onChange={change} />}
          </>
        ) : <div className="fc-off">Enable this pass to expose its controls and prompt contract.</div>}
      </div>
    </article>
  );
}

export function FinalCutTab({ ctx, chat, onChanged }: { ctx: AppContext; chat: Chat; onChanged(chat: Chat): void }): JSX.Element {
  const fc = useFinalCut(ctx, chat, onChanged);
  const lib = useFinalCutLibrary(ctx);
  const models = useSceneModels(ctx, chat, onChanged);
  const { settings } = fc;
  const passes = settings.passes;
  const on = settings.on === true;
  const running = activePasses(passes).length;
  return (
    <div className="wbody pp fc-wing" data-part="scene.finalcut">
      <header className="hero">
        <span className="hi"><Ic name="lucide:scissors" size={20} /></span>
        <div>
          <div className="eb">Now in review</div>
          <h2>The <em>Final Cut</em></h2>
          <p>Configure what happens after the narrator writes and before the reply is saved. Creative passes use an LLM. The safety check is deterministic and can also inspect your own message before send.</p>
        </div>
      </header>
      <section className={`fc-card fc-master${on ? " on" : ""}`}>
        <div>
          <b>Final Cut</b>
          <p>{on ? (running === 0 ? "On, but no pass is switched on yet. The narrator output saves unchanged." : `On. ${running} ${running === 1 ? "pass runs" : "passes run"} on every new reply, in this order.`) : "Off. The narrator output saves unchanged. Your settings below are kept."}</p>
        </div>
        <LiveSwitch on={on} onToggle={() => fc.setOn(!on)} />
      </section>
      {fc.error && <div className="fc-error" role="alert">{fc.error}</div>}
      <section className="fc-stats">{stats(passes).map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (s) => <div key={s.label}><small>{s.label}</small><b>{s.value}</b></div>)}</section>
      <ToolsCard tools={settings.tools} models={models} onChange={fc.setTools} />
      <SafetyCard pass={onPass(passes, "validator") ?? passes?.find((p) => p.type === "validator")} onToggle={() => fc.toggle("validator")} onChange={(patch) => fc.patch("validator", patch)} />
      <AntiSlopCard pass={passes?.find((p) => p.type === "anti-slop")} models={models} onToggle={() => fc.toggle("anti-slop")} onChange={(patch) => fc.patch("anti-slop", patch)} />
      <UserBanksCard lib={lib} />
      <section className="fc-grid-cards">
        {CREATIVE_PASSES.filter((c) => c.type !== "custom-agent").map((c) => <PassCard key={c.type} spec={c} ctx={ctx} fc={fc} lib={lib} models={models} />)}
      </section>
      <section className="fc-full">{CREATIVE_PASSES.filter((c) => c.type === "custom-agent").map((c) => <PassCard key={c.type} spec={c} ctx={ctx} fc={fc} lib={lib} models={models} />)}</section>
      <Contract passes={passes ?? []} rulebook={[]} />
      <div className="fc-foot"><Ic name="lucide:corner-down-right" size={12} /><b>On save &middot; </b>the final text, a changelog and warnings for each pass, and the original reply are kept with the saved reply, and Undo puts the original back as an edit.</div>
    </div>
  );

}
