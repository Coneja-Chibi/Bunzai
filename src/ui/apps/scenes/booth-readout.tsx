/**
 * The Control Booth's Scene Readout and Context Usage (RoleCall's QuickPlayPanel "Scene Readout", :1619-1646, and its ContextUsageBar, :501-537): the take's
 * message count, the last reply's request and the average time a reply takes, three centred figures; and under them the context bar. RoleCall's average is a constant
 * (1.2s, a TODO); this one is the mean of the replies' stored generation times, a dash when none was timed. RoleCall's "Tokens" is the character card's size read from
 * another panel and 0 until it was opened; here it is the last reply's request as the Context wing's trace stored it (the provider's own count, else the assembler's with a
 * tilde), a dash before any reply. The bar is the Context wing's own Context Pressure meter (context/pressure-core.ts: the same figures, window, thresholds and target the
 * viewer set there), so the two never disagree; it shifts colour at that meter's marks where RoleCall's shifts at 80 and 95.
 */
import type { CSSProperties, JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";
import { averageReplyMs, formatTokens, requestTokens } from "./booth-readout-core";
import { meterOf, parseTarget, parseThresholds, TARGET_KEY, THRESHOLDS_KEY, type Level } from "./context/pressure-core";
import { useReplyTrace } from "./context/use-reply-trace";
import { formatGenTime } from "./scene-meta-core";

const TONE: Record<Level, string> = { healthy: "var(--w)", warning: "var(--stage-warn)", danger: "var(--stage-danger-text)", critical: "var(--stage-danger-text)" };

export function BoothReadout({ ctx, scene }: { ctx: AppContext; scene: OpenScene }): JSX.Element {
  const avg = averageReplyMs(scene.messages);
  const { state } = useReplyTrace(ctx, scene.chat);
  const trace = state.state === "ready" ? state.trace : null;
  const used = trace ? requestTokens(trace) : null;
  const meter = trace ? meterOf(trace, parseThresholds(ctx.prefs.get(THRESHOLDS_KEY)), parseTarget(ctx.prefs.get(TARGET_KEY))) : null;
  return (
    <>
      <section className="bth-sec" data-part="scene.booth.readout.section">
        <h3>Scene Readout</h3>
        <div className="bth-nums" data-part="scene.booth.readout">
          <div><b>{scene.messageCount.toLocaleString()}</b><small>Msgs</small></div>
          <div><b>{used ? `${used.exact ? "" : "~"}${formatTokens(used.tokens)}` : "-"}</b><small>Tokens</small></div>
          <div><b>{avg === null ? "-" : formatGenTime(Math.round(avg))}</b><small>Avg</small></div>
        </div>
      </section>
      <section className="bth-sec" data-part="scene.booth.context">
        <div className="bth-cx"><span>Context</span><span>{meter ? `${meter.used.toLocaleString()} / ${meter.limit.toLocaleString()}` : "0 / -"}</span></div>
        <div className={`bth-bar${meter?.level === "critical" ? " hot" : ""}`} role="meter" aria-label="Context usage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter ? Math.min(meter.percent, 100) : 0}>
          <i style={{ width: `${meter ? Math.min(meter.percent, 100) : 0}%`, "--bar": TONE[meter?.level ?? "healthy"] } as CSSProperties} />
        </div>
      </section>
    </>
  );
}
