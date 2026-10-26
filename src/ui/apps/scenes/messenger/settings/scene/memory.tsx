/**
 * The scene scope's Memory page (approved wireframe messenger-discord/settings.html, scene > Prompt > Memory): what the story remembers (memory-rows.tsx, rows bound to the Memory tab's own writer) and the Context
 * inspector, a tool that opens as its own Messenger program. The inspector's four views (next send, this turn, lore state, macros) are tabs of that one program and cannot be opened one by one, so the page draws one row.
 */
import type { JSX } from "react";
import type { SettingsCategory } from "../../frames/settings-window";
import { DrillRow } from "../../frames/settings-rows";
import type { WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { sceneEnv, type SceneEnv } from "./env";
import { AdvancedBody, ControlsBody, SummaryBody } from "./memory-rows";

function InspectorRows({ env }: { env: SceneEnv }): JSX.Element {
  return <DrillRow label="Context inspector" description="Preview the next send, read the last call, and see the lore state and macros." value="Next send, this turn" onOpen={() => env.open("inspector")} />;
}

/** The Memory category of the scene scope. `open` is the shell's program opener; the category can be given the page's wing arguments and the opener, or both as one environment. */
export function memoryCategory(env: SceneEnv): SettingsCategory;
export function memoryCategory(a: WingArgs, open: OpenProgram): SettingsCategory;
export function memoryCategory(first: SceneEnv | WingArgs, open?: OpenProgram): SettingsCategory {
  const env = sceneEnv(first, open);
  return { id: "memory", label: "Memory", icon: "lucide:history", group: "Prompt", sections: [
    { id: "summary", title: "Summary", description: "What the story remembers once it outgrows the window.", body: <SummaryBody env={env} /> },
    { id: "summary-controls", title: "Summary controls", body: <ControlsBody env={env} /> },
    { id: "advanced", title: "Advanced", description: "Summary model only.", body: <AdvancedBody env={env} /> },
    { id: "inspector", title: "Context inspector", description: "What the model will see.", body: <InspectorRows env={env} /> },
  ] };
}
