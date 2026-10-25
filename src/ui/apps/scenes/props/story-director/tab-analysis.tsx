/**
 * The Analysis tab (RoleCall's AnalysisTab, StoryDirectorWingPanel.tsx:1163-1276): the last turn's analysis as headed key and value blocks, and the pacing analysis. RoleCall's "Chapter Update"
 * block is not drawn: the state keeps the chapter itself (the Story tab), not the update the Director last asked for.
 */
import type { JSX } from "react";
import type { DirectorState } from "../../../../../stage/contracts/director-types";
import { KeyValues, Section } from "./director-parts";

export function AnalysisTab({ state }: { state: DirectorState }): JSX.Element {
  const last = state.recentAnalysis.at(-1);
  if (!last) return <div className="dr-quiet" data-part="scene.director.analysis.empty"><p>No analysis yet</p></div>;
  const { turn, pacingAnalysis, ...rest } = last;
  return (
    <div className="dr-pane" data-part="scene.director.analysis">
      <Section title="Turn Analysis" icon="lucide:brain"><KeyValues data={{ turn, ...rest }} /></Section>
      {pacingAnalysis && <Section title="Pacing Analysis" icon="lucide:activity"><p className="dr-dim big">{pacingAnalysis}</p></Section>}
    </div>
  );
}
