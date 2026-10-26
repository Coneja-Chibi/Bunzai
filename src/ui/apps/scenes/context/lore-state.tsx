/**
 * The Prompt Inspector's Lore & state sub-tab (RoleCall `RightWingPanelContent.tsx:234-308` over `DebugWingPanelV2.tsx`). Before any reply only State shows, with RoleCall's sentence ("Lore,
 * macros, sources and the prompt layout appear here after you send a message."). After one: "Last captured assembly" with its message and token line, the Context Pressure meter, and the
 * tabs State, Lore, Macros, Sources, Flow and Compose over the one trace. The Est. Cost line is left out (Bunraku has no price source) and the
 * Tracker / History toggle (the request itself is Compose's text and This turn's Raw JSON). The meter's marks and target are per-viewer prefs.
 */
import { useState, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { Tabs } from "../../../components/button";
import type { AppContext } from "../../../app-contract";
import type { SceneTrace } from "../../../app-contract-scenes";
import type { Chat } from "../../../../stage/contracts/chat-store";
import { Pressure } from "./pressure";
import { meterOf, parseTarget, parseThresholds, TARGET_KEY, THRESHOLDS_KEY, type Meter } from "./pressure-core";
import { Lore } from "./tab-lore";
import { Macros } from "./tab-macros";
import { StateTab } from "./tab-state";
import { Compose, Flow, Sources } from "./tabs-request";
import { totalTokens, type Highlight } from "./lore-state-core";
import { neighbours } from "./this-turn-core";
import type { TraceState } from "./use-reply-trace";

type Tab = "state" | "lore" | "macros" | "sources" | "flow" | "compose";
const TABS: { value: Tab; label: string }[] = [
  { value: "state", label: "State" },
  { value: "lore", label: "Lore" },
  { value: "macros", label: "Macros" },
  { value: "sources", label: "Sources" },
  { value: "flow", label: "Flow" },
  { value: "compose", label: "Compose" },
];

const MESSAGE_KINDS = new Set(["greeting", "history", "current"]);

/** The small line under the tab: the assembler's count, and the provider's own beside it when it reported one. */
export function loreStateMeta(state: TraceState): string {
  const lore = state.state === "ready" ? state.trace?.lore : null;
  return lore ? `${lore.injected.length} lore entries` : "state ready";
}

function Header({ trace, meter }: { trace: SceneTrace; meter: Meter }): JSX.Element {
  const msgs = trace.blocks.filter((b) => MESSAGE_KINDS.has(b.kind)).length;
  return (
    <div className="ls-top">
      <span className="ls-ico"><Ic name="lucide:chart-pie" size={16} /></span>
      <div>
        <h3>{neighbours(trace).latest ? "Last captured assembly" : `Assembly of reply #${trace.reply.number}`}</h3>
        <p>{msgs} msgs • ~{totalTokens(trace).toLocaleString()}{meter.actual !== undefined ? ` → ${meter.actual.toLocaleString()} tokens` : " tokens (est.)"}</p>
      </div>
    </div>
  );
}

export function LoreState({ ctx, chat, state }: { ctx: AppContext; chat: Chat; state: TraceState }): JSX.Element {
  const [tab, setTab] = useState<Tab>("state");
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [thresholds, setThresholds] = useState(() => parseThresholds(ctx.prefs.get(THRESHOLDS_KEY)));
  const [target, setTarget] = useState(() => parseTarget(ctx.prefs.get(TARGET_KEY)));
  const trace = state.state === "ready" ? state.trace : null;
  if (!trace) {
    return (
      <div className="ls">
        <StateTab ctx={ctx} chatId={chat.id} version={chat.updatedAt} />
        <p className="ls-after">Lore, macros, sources and the prompt layout appear here after you send a message.</p>
      </div>
    );
  }
  const meter = meterOf(trace, thresholds, target);
  return (
    <div className="ls" data-part="scene.context.lore-state">
      <div className="ls-head">
        <Header trace={trace} meter={meter} />
        <Pressure meter={meter} thresholds={thresholds} target={target}
          onThresholds={(t) => { setThresholds(t); ctx.prefs.set(THRESHOLDS_KEY, t); }}
          onTarget={(n) => { setTarget(n); ctx.prefs.set(TARGET_KEY, n); }} />
        <Tabs label="Lore and state" items={TABS} value={tab} onChange={setTab} />
      </div>
      <div className="ls-main">
        {tab === "state" && <StateTab ctx={ctx} chatId={chat.id} version={chat.updatedAt} trace={trace} />}
        {tab === "macros" && <Macros trace={trace} />}
        {tab === "lore" && <Lore trace={trace} />}
        {tab === "sources" && <Sources trace={trace} onHighlight={(h) => { setHighlight(h); setTab("compose"); }} />}
        {tab === "flow" && <Flow trace={trace} />}
        {tab === "compose" && <Compose trace={trace} highlight={highlight} onClear={() => setHighlight(null)} />}
      </div>
    </div>
  );
}
