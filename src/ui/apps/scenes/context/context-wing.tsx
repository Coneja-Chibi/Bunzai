/**
 * The Context wing (RoleCall's right-rail "Context": "What the AI sees and remembers"): the Tools / Context strip over Prompt Inspector
 * (meta "history / review", the first tab) and Memory (RoleCall `right-wing-groups.ts:116-120`). One width for both tabs (context-style.ts).
 * The Inspector's sub-tab is kept here so it survives a visit to Memory, as RoleCall keeps it in the panel's state (`RightWingPanelContent.tsx:119`),
 * and the wing reads the reply's trace once for the sub-tabs that show it.
 */
import { useState, type JSX } from "react";
import { Button } from "../../../components/button";
import { draftKey, readDraft } from "../composer-tools-core";
import { Ic } from "../../../_shared/ic";
import type { AppContext } from "../../../app-contract";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../../studio/scenes";
import { FoldoutTabs, type FoldoutTab } from "../scene-foldout";
import { useLiveDraft } from "./draft-bus";
import { InspectorShell, type InspectorTab } from "./inspector-shell";
import { LoreState, loreStateMeta } from "./lore-state";
import { MemoryTab } from "./memory-tab";
import { NextSend } from "./next-send";
import { requestReview } from "./review-open";
import { ThisTurn } from "./this-turn";
import { useForecast } from "./use-forecast";
import { ThemeSlot } from "../../../_shared/theme-slot";
import { tabOr, type Wing } from "../scene-wing-data";
import { WingFrame } from "../scene-wing-frame";
import type { WingResize } from "../wing-resize-edge";
import { useReplyTrace } from "./use-reply-trace";

/** What the wing reads of the open scene, and the one way it hands a changed chat back. */
export interface ContextProps { ctx: AppContext; scene: OpenScene; onChat(chat: Chat): void }

type Tab = "inspector" | "memory";
const TABS: FoldoutTab<Tab>[] = [{ id: "inspector", label: "Prompt Inspector", meta: "history / review" }, { id: "memory", label: "Memory" }];

/** The wing's panel: the section RoleCall draws, in the frame every wing shares (its width and drag edge are the page's: use-wing-widths.ts). */
export function ContextSection({ wing, resize, ...props }: ContextProps & { wing: Wing; resize?: WingResize; initialTab?: string }): JSX.Element {
  return (
    <WingFrame wing={wing} extra="context-wing" {...(resize ? { resize } : {})}>
      <ThemeSlot id="scene.wing.context" />
      <ContextWing {...props} />
    </WingFrame>
  );
}

export function ContextWing({ initialTab, ...props }: ContextProps & { initialTab?: string }): JSX.Element {
  const { ctx, scene } = props;
  const [tab, setTab] = useState<Tab>(() => tabOr(TABS.map((t) => t.id), initialTab, "inspector"));
  const [sub, setSub] = useState<InspectorTab>("this-turn");
  const [none, setNone] = useState(false);
  const trace = useReplyTrace(ctx, scene.chat);
  // Next send follows the composer as it is typed, and is only built while its tab is the one showing (RoleCall keeps the preview lazy).
  const draft = useLiveDraft(scene.chat.id, () => readDraft(ctx.prefs.get(draftKey(scene.chat.id))));
  const forecast = useForecast(ctx, scene.chat, draft, tab === "inspector" && sub === "next-send");
  const bodies = {
    thisTurn: <ThisTurn state={trace.state} onPick={trace.pick} onRefresh={trace.reload} />,
    nextSend: <NextSend state={forecast} />,
    loreState: <LoreState ctx={ctx} chat={scene.chat} state={trace.state} />,
    meta: { nextSend: forecast.loading ? "loading" : "forecast", loreState: loreStateMeta(trace.state) },
  };
  return (
    <>
      <FoldoutTabs<Tab> area="Tools" group="Context" tabs={TABS} active={tab} onSelect={setTab} />
      {tab === "inspector" ? <><ThemeSlot id="scene.wing.context.inspector" /><InspectorShell bodies={bodies} tab={sub} onTab={setSub} onReview={() => setNone(!requestReview())} /></> : <><ThemeSlot id="scene.wing.context.memory" /><MemoryTab {...props} /></>}
      {none && (
        <div className="cx-toast" role="status" data-part="scene.context.toast">
          <Ic name="lucide:circle-alert" size={20} />
          <span>No calls are awaiting review.</span>
          <Button variant="quiet" size="sm" onClick={() => setNone(false)}>Close</Button>
        </div>
      )}
    </>
  );
}
