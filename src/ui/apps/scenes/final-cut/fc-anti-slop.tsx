/**
 * The Anti-Slop Engine card and the Output Safety Check (RoleCall's AntiSlopCard and SafetyInterlock, PostProductionPanel.tsx:740-862,
 * 1473-1523): a Live/Off switch, the pass's settings in a fold (model, temperature, context, output mode, default depth, failure mode),
 * the attached sets, the watchlist and global replacement guidance; and the deterministic check with its six listed checks and the
 * switch that also checks your own message before it is sent. Copy is RoleCall's.
 */
import type { JSX } from "react";
import { BANK_DEPTH, type BankDepth } from "../../../../core/final-cut/banks";
import type { FinalCutPass } from "../../../../core/final-cut/pass";
import { QUALITY_CHECKS } from "../../../../core/final-cut/validate";
import type { SceneModels } from "../use-scene-models";
import { Area, Check, Sel } from "./fc-controls";
import { BankPicker } from "./fc-bank-picker";
import { FailureModeSelect, OutputModeToggle, PassChrome, type Change } from "./fc-pass-chrome";

export function LiveSwitch({ on, onToggle }: { on: boolean; onToggle(): void }): JSX.Element {
  return <button type="button" className={`fc-live${on ? " on" : ""}`} aria-pressed={on} onClick={onToggle}>{on ? "Live" : "Off"}</button>;
}

const DEPTHS = Object.fromEntries(Object.entries(BANK_DEPTH).map(([id, d]) => [id, { label: `${d.label}: ${d.hint}` }]));

export function AntiSlopCard({ pass, models, onToggle, onChange }: { pass: FinalCutPass | undefined; models: SceneModels; onToggle(): void; onChange: Change }): JSX.Element {
  const live = pass !== undefined && pass.enabled !== false;
  const sets = pass?.attachedSets?.length ?? 0;
  const banks = pass?.enabledBanks?.length ?? 0;
  return (
    <section className={`fc-card fc-antislop${live ? " on" : ""}`} style={{ "--p": "var(--stage-danger-text)" } as React.CSSProperties} data-part="scene.finalcut.antislop">
      <header>
        <div>
          <div className="kick">Pass &middot; phrase-substitution agent</div>
          <h3>Anti-Slop Engine</h3>
          <p>A first-class post-production agent. Watches for slop patterns and rewrites them in place. Runs on a small/cheap model since it's pattern substitution, not creative rewriting. Attach as many slopism sets as you want, then drill in to toggle individual banks.</p>
          {live && <span className="fc-meta">{sets} {sets === 1 ? "set" : "sets"} &middot; {banks} {banks === 1 ? "bank" : "banks"} on &middot; {pass.connection ? "custom model" : "scene model"}</span>}
        </div>
        <LiveSwitch on={live} onToggle={onToggle} />
      </header>
      {!live || !pass ? (
        <div className="fc-off">Enable to expose the multi-attach slopism set picker, per-bank toggles, depth-per-bank verbosity controls, watchlist, and replacement guidance.</div>
      ) : (
        <div className="fc-controls">
          <details className="fc-fold">
            <summary><span>Pass settings</span><small>model &middot; temperature &middot; context &middot; output &middot; depth</small></summary>
            <div className="fc-fold-body">
              <PassChrome pass={pass} models={models} onChange={onChange} strip={false} />
              <OutputModeToggle value={pass.outputMode} onChange={(outputMode) => onChange({ outputMode })} />
              <div className="fc-grid">
                <Sel label="Default depth per bank" value={pass.defaultDepth ?? "standard"} options={DEPTHS} onChange={(d) => onChange({ defaultDepth: d as BankDepth })} />
                <FailureModeSelect value={pass.failureMode} onChange={(failureMode) => onChange({ failureMode })} />
              </div>
            </div>
          </details>
          <BankPicker pass={pass} onChange={onChange} />
          <div className="fc-grid">
            <Area label="Custom slopism watchlist" value={pass.customSlopisms ?? ""} placeholder="Type phrases the agent should treat as banned. One per line." onChange={(customSlopisms) => onChange({ customSlopisms })} />
            <Area label="Replacement guidance (global override)" value={pass.antiSlopInstructions ?? ""} placeholder="Concrete verbs, character-specific beats, shorter metaphors..." onChange={(antiSlopInstructions) => onChange({ antiSlopInstructions })} />
          </div>
        </div>
      )}
    </section>
  );
}

export function SafetyCard({ pass, onToggle, onChange }: { pass: FinalCutPass | undefined; onToggle(): void; onChange: Change }): JSX.Element {
  const live = pass !== undefined && pass.enabled !== false;
  return (
    <section className={`fc-card fc-safety${live ? " on" : ""}`} style={{ "--p": "var(--stage-ok)" } as React.CSSProperties} data-part="scene.finalcut.safety">
      <div>
        <div className="kick">Deterministic interlock</div>
        <h3>Output Safety Check</h3>
        <p>Not continuity, not spellcheck, and not a creative rewrite. This is a cheap malformed-output guard before save. It exists so busted post-production tags, empty replies, and broken structured syntax do not quietly ship.</p>
      </div>
      <div className="fc-safety-controls">
        <LiveSwitch on={live} onToggle={onToggle} />
        {live && pass && (
          <>
            <FailureModeSelect value={pass.failureMode} onChange={(failureMode) => onChange({ failureMode })} />
            <Check label="Also check my messages before send" checked={pass.applyToUserMessages === true} onChange={(applyToUserMessages) => onChange({ applyToUserMessages })} />
          </>
        )}
      </div>
      <div className="fc-checks">{QUALITY_CHECKS.map((c) => <div key={c}>+ {c}</div>)}</div>
    </section>
  );
}
