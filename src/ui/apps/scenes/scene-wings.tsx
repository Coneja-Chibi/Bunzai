/**
 * The scene's wings (RoleCall's WingRail and WingShell). In the default theme a wing opens beside the chat and pushes it aside; other themes pause and blur the scene. Cast shows the scene's character and persona as two editing tabs plus an honest Participants tab (scene-cast-wing.tsx,
 * which also carries the Update available notice); Context holds the Prompt Inspector and Memory as tabs (context/context-wing.tsx). AI holds the model picker and, beside it, the generation settings (scene-ai-tabs.tsx, scene-ai-wing.tsx); Prompting holds the preset, the guides and the scene note
 * as tabs (scene-prompting.tsx); World holds the scene's lorebooks (scene-lore-wing.tsx); Props holds the
 * registered Props switch (props/props-wing.tsx, ChatStore rule 21). Final Cut holds the scene's regex sets (scene-final-cut.tsx, ChatStore rule 42). Stage holds Appearance, Gallery, Music, Spotify and Wardrobe as tabs (scene-stage-wing.tsx; stage-tabs.ts is the contract;
 * Appearance is RoleCall's StageSettingsPanel, stage-appearance.tsx); Control Booth composes the other wings' rows (scene-booth-wing.tsx), each through its home wing's own writer.
 * Every panel is drawn in a WingFrame (scene-wing-frame.tsx) and resizes from its edge (wing-resize-edge.tsx).
 */
import type { JSX, ReactNode } from "react";
import { Ic } from "../../_shared/ic";
import { WorldWing } from "./scene-world-wing";
import { AiTabs } from "./scene-ai-tabs";
import { StageWing, type StageProps } from "./scene-stage-wing";
import { ThemeSlot } from "../../_shared/theme-slot";
import { ContextSection, ContextWing, type ContextProps } from "./context/context-wing";
import { FoldoutTabs } from "./scene-foldout";
import { wingOf } from "./scene-wing-data";
import { WingFrame } from "./scene-wing-frame";
import type { WingResize } from "./wing-resize-edge";

export { WINGS } from "./scene-wing-data";
export { WingRails } from "./scene-wing-rail";

export function WingPanel({ id, tab, bare, single, castPanel, booth, ai, aiGeneration, stage, prompting, world, props, finalCut, context, resize }: {
  id: string;
  /** The tab to open on (a Messenger program, messenger/programs.ts). */
  tab?: string;
  /** Drawn for a Messenger program: the wing's body in a plain box, without the frame's edge, depth, sheen or drag edge. */
  bare?: boolean;
  /** Draw only `tab`'s body, without the wing's tab bar or crumb (a Messenger section). */
  single?: boolean;
  context?: ContextProps; castPanel?: JSX.Element; booth?: JSX.Element; ai?: JSX.Element; aiGeneration?: JSX.Element; stage?: StageProps; prompting?: { panel: JSX.Element }; world?: { panel: JSX.Element; compendium: JSX.Element; meta: string };
  props?: { panel: JSX.Element; meta: string };
  finalCut?: { panel: JSX.Element };
  /** The wing's drag edge; a panel drawn without one (a test, a closed slot) has none. */
  resize?: WingResize;
}): JSX.Element | null {
  const wing = wingOf(id);
  if (!wing) return null;
  const crumb = <div className="crumb">{wing.side === "l" ? "Scene" : "Tools"} <i>/</i> <b>{wing.label}</b></div>;
  const frame = (extra: string | undefined, body: ReactNode): JSX.Element => bare
    ? <div className={`wing-panel ${wing.side}${extra ? ` ${extra}` : ""}`} data-wing={wing.id}>{body}</div>
    : <WingFrame wing={wing} {...(extra ? { extra } : {})} {...(resize ? { resize } : {})}>{body}</WingFrame>;
  if (id === "cast" && castPanel) return frame("cast-wing", <><ThemeSlot id="scene.wing.cast" />{castPanel}</>);
  if (id === "booth" && booth) return frame(undefined, <><ThemeSlot id="scene.wing.booth" /><nav className="fold">{crumb}</nav>{booth}</>);
  if (id === "prompting" && prompting) return frame(undefined, <><ThemeSlot id="scene.wing.prompting" />{prompting.panel}</>);
  if (id === "finalcut" && finalCut) return frame(undefined, <><ThemeSlot id="scene.wing.finalcut" />{finalCut.panel}</>);
  if (id === "world" && world) return frame("world-wing", <><ThemeSlot id="scene.wing.world" /><WorldWing lore={world.panel} compendium={world.compendium} linked={world.meta} initialTab={tab} {...(single ? { single } : {})} /></>);
  if (id === "props" && props) {
    return frame("props-wing", <><ThemeSlot id="scene.wing.props" /><FoldoutTabs area="Scene" group="Props" tabs={[{ id: "props", label: "Props", meta: props.meta }]} active="props" onSelect={() => undefined} />{props.panel}</>);
  }
  if (id === "ai" && ai) return frame("ai-wing", <><ThemeSlot id="scene.wing.ai" /><AiTabs model={ai} initialTab={tab} {...(single ? { single } : {})} {...(aiGeneration ? { generation: aiGeneration } : {})} /></>);
  if (id === "context" && context) return bare ? frame("context-wing", <><ThemeSlot id="scene.wing.context" /><ContextWing initialTab={tab} {...(single ? { single } : {})} {...context} /></>) : <ContextSection wing={wing} initialTab={tab} {...(single ? { single } : {})} {...(resize ? { resize } : {})} {...context} />;
  // theme-key-ok: "stage" here is this wing's id, not a theme
  if (id === "stage" && stage) return frame("stage-wing", <><ThemeSlot id="scene.wing.stage" /><StageWing initialTab={tab} {...(single ? { single } : {})} {...stage} /></>);
  return frame(undefined, <><nav className="fold">{crumb}</nav><div className="wbody">
      <div className="quiet"><div><Ic name={wing.icon} size={34} /><div>{id === "context" ? "Open a saved scene to see what the AI sees." : `${wing.label} is not built yet.`}</div><small>{wing.blurb}</small></div></div>
    </div></>);
}
