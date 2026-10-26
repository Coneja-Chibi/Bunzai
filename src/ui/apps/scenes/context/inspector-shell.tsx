/**
 * The Prompt Inspector's shell (RoleCall's PromptInspectorShell.tsx): the eyebrow, "What the AI was sent", its one-line blurb, and a row of
 * tiles over the body: This turn, Next send, Lore & state, each with a small status line (rc `RightWingPanelContent.tsx:215-219`), and a fourth tile, Review,
 * that is not a tab: it brings a paused turn's review dialog back (review-open.ts). The open
 * sub-tab is the wing's to keep (it survives a visit to Memory); the bodies are mount points the slices fill.
 */
import type { JSX } from "react";
import { Button, Tabs } from "../../../components/button";

export type InspectorTab = "this-turn" | "next-send" | "lore-state";

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "this-turn", label: "This turn" },
  { id: "next-send", label: "Next send" },
  { id: "lore-state", label: "Lore & state" },
];

export interface InspectorBodies {
  thisTurn: JSX.Element;
  nextSend: JSX.Element;
  loreState: JSX.Element;
  /** The small line under Next send ("loading" or "forecast") and Lore & state ("N lore entries" or "state ready"); This turn is always "recorded". */
  meta: { nextSend: string; loreState: string };
}

export function InspectorShell({ bodies, tab, onTab, onReview }: { bodies: InspectorBodies; tab: InspectorTab; onTab(tab: InspectorTab): void; onReview(): void }): JSX.Element {
  const metaOf: Record<InspectorTab, string> = { "this-turn": "recorded", "next-send": bodies.meta.nextSend, "lore-state": bodies.meta.loreState };
  return (
    <div className="cx" data-part="scene.context.inspector">
      <div className="cx-hd">
        <p className="cx-eb">Prompt Inspector</p>
        <h2>What the AI was sent</h2>
        <p className="cx-sub">Recorded calls for each turn. Next send is a forecast.</p>
        <div className="cx-tabs">
          <Tabs label="Prompt Inspector" value={tab} onChange={onTab}
            items={TABS.map((t) => ({ value: t.id, label: <><b>{t.label}</b><small>{metaOf[t.id]}</small></> }))} />
          <Button size="sm" onClick={onReview}><b>Review</b><small>open review</small></Button>
        </div>
      </div>
      <div className="cx-body">{tab === "this-turn" ? bodies.thisTurn : tab === "next-send" ? bodies.nextSend : bodies.loreState}</div>
    </div>
  );
}
