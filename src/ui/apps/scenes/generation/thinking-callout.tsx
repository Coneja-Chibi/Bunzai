/** The "Two kinds of thinking" callout above Reasoning (RoleCall's SamplerPanel.tsx:856-885), copy exact but for the product's name. */
import type { JSX } from "react";
import { Ic } from "../../../_shared/ic";

const SHAPES = ["<think>", "<thinking>", "<plan>", "[THINK]"];

export function ThinkingCallout(): JSX.Element {
  return (
    <div className="gn-callout" data-part="scene.generation.kinds">
      <span className="gn-cico"><Ic name="mdi:lightbulb-on-outline" size={20} /></span>
      <div>
        <p><b>Two kinds of thinking in Bunzai.</b></p>
        <p><b>Provider reasoning:</b> the model&apos;s own reasoning, sent separately from the reply and set by the Reasoning level below. Hidden (or summarized) unless your provider surfaces it.</p>
        <p><b>Thinking in the reply:</b> thought blocks the model writes <i>inside the reply itself</i>, usually because your preset asks for it. Thinking in Replies below sets what gets caught. Common shapes:{" "}
          {SHAPES.map((s) => <code key={s}>{s}</code>)}.</p>
        <p className="gn-heads"><b>Heads-up:</b> thinking in the reply counts against your response/output token budget. If your thinking template runs long, bump <code>max_tokens</code> so the model doesn&apos;t cut off mid-answer after finishing the thought block. The two can run together, or one at a time.</p>
      </div>
    </div>
  );
}
