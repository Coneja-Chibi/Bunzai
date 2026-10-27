/**
 * The Story Director's page in the scene scope (wireframe SCOPES.scene, dir), shown while the Director Prop is on. Every row is a Director setting (ChatStore rule 47) written through
 * `useDirectorPanel().settings`, the one writer the Prop's own settings block uses; options, ranges and defaults come from the owners (director-types.ts, personalities, director-model.tsx,
 * director-settings.tsx). The model is a select (director-model-row.tsx); the Director's panel (story, arcs, trace) is a tool, reached by a drill row. The wireframe's Pacing, House-rule switches and chat notes
 * have no store and are not drawn.
 */
import type { JSX, ReactNode } from "react";
import { PERSONALITIES } from "../../../../../../core/director/personalities";
import { DIRECTOR_PROP_ID } from "../../../../../../core/director/settings";
import { DIRECTOR_CALLS_MAX, DIRECTOR_CALLS_MIN, DIRECTOR_CREATIVITY, DIRECTOR_EVERY_MAX, DIRECTOR_INSTRUCTIONS_MAX, DIRECTOR_TEMPERATURE_MAX, type DirectorCommandMode, type DirectorCreativity, type DirectorPersonality, type DirectorSettingsPatch } from "../../../../../../stage/contracts/director-types";
import type { DirectorPanel } from "../../../../../../studio/scene-director-edit";
import { EFFORTS, MODES } from "../../../props/story-director/director-model";
import { CREATIVITY_LABEL } from "../../../props/story-director/director-settings";
import { useDirectorPanel } from "../../../props/story-director/use-director-panel";
import { ActionRow, DrillRow, RadioCards, SegmentedRow, SelectRow } from "../../frames/settings-rows";
import type { SettingsCategory } from "../../frames/settings-window";
import type { WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { DirectorModelRow } from "./director-model-row";
import { SavedNumber, SavedText, SavedToggle } from "./saved";

type Settings = DirectorPanel["settings"];
type Save = (patch: DirectorSettingsPatch) => Promise<void>;

/** One section's body: the Director's saved settings, or why they are not there yet. Each setting is written alone, the way the Prop's own block writes it. */
function Part({ a, render }: { a: WingArgs; render(s: Settings, save: Save): ReactNode }): JSX.Element {
  const data = useDirectorPanel(a.ctx, a.scene.chat);
  if (data.load.state === "loading") return <p className="msn-st-secd" role="status">Loading...</p>;
  if (data.load.state === "failed") return <ActionRow label="Could not read the Story Director" description={data.load.why} action="Try again" onAction={data.reload} />;
  const save: Save = async (patch) => { const why = await data.settings(patch); if (why) a.ctx.setStatus(why); };
  return <>{render(data.load.panel.settings, save)}</>;
}

export function directorCategory(a: WingArgs, open: OpenProgram): SettingsCategory {
  const panel = (): void => open(`prop-${DIRECTOR_PROP_ID}`);
  return { id: `prop-${DIRECTOR_PROP_ID}`, label: "Story Director", icon: "mdi:drama-masks", group: "Features", sections: [
    { id: "director-style", title: "Personality", description: "How the Director speaks up.", body: (
      <Part a={a} render={(s, save) => (
        <>
          <RadioCards label="Personality" value={s.personality} options={PERSONALITIES.map((p) => ({ value: p.id, label: p.name, description: p.tagline }))} onChange={(personality) => void save({ personality: personality as DirectorPersonality })} />
          <SegmentedRow label="Creativity" description="How boldly the Director steers the story." value={s.creativity} options={DIRECTOR_CREATIVITY.map((c) => ({ value: c, label: CREATIVITY_LABEL[c] }))} onChange={(creativity) => void save({ creativity: creativity as DirectorCreativity })} />
        </>
      )} />
    ) },
    { id: "director-model", title: "Model and commands", body: (
      <Part a={a} render={(s, save) => (
        <>
          <DirectorModelRow a={a} settings={s} save={save} />
          <SelectRow label="Reasoning" description="Auto follows the model default." value={EFFORTS.find((e) => e.id === (s.reasoning ?? null))?.label ?? "Auto"} options={EFFORTS.map((e) => ({ value: e.label, label: e.label }))}
            onChange={(label) => void save({ reasoning: EFFORTS.find((e) => e.label === label)?.id ?? null })} />
          <RadioCards label="Command mode" value={s.commandMode} options={MODES.map((m) => ({ value: m.id, label: m.label, description: m.description }))} onChange={(commandMode) => void save({ commandMode: commandMode as DirectorCommandMode })} />
        </>
      )} />
    ) },
    { id: "director-runtime", title: "Runtime", body: (
      <Part a={a} render={(s, save) => (
        <>
          <SavedNumber label="DM temperature" description="Randomness of the Director's reasoning and tool decisions." saved={s.temperature} min={0} max={DIRECTOR_TEMPERATURE_MAX} step={0.05} write={(temperature) => save({ temperature })} />
          <SavedToggle label="Auto-retry invalid tool responses" description="Retries once when the model returns malformed tool data. May add one extra model call." saved={s.autoRetry} write={(autoRetry) => save({ autoRetry })} />
          <SavedToggle label="Update trackers automatically" description="The Director updates the trackers that are on after a reply." saved={s.autoUpdate} write={(autoUpdate) => save({ autoUpdate })} />
          {s.autoUpdate && <SavedNumber label="Every N replies" description="Replies between a tracker's updates; 1 is after every reply." saved={s.every} min={1} max={DIRECTOR_EVERY_MAX} step={1} write={(every) => save({ every })} />}
          {s.autoUpdate && <SavedNumber label="Model calls per reply" description="Up to this many calls for the tracker round. Each costs tokens." saved={s.callsPerReply} min={DIRECTOR_CALLS_MIN} max={DIRECTOR_CALLS_MAX} step={1} write={(callsPerReply) => save({ callsPerReply })} />}
        </>
      )} />
    ) },
    { id: "director-rules", title: "Rules", body: (
      <Part a={a} render={(s, save) => (
        <SavedText label="House rules" description="Standing instructions the Director follows every turn." rows={4} saved={s.instructions} write={(text) => save({ instructions: text === "" ? null : text.slice(0, DIRECTOR_INSTRUCTIONS_MAX) })} />
      )} />
    ) },
    { id: "director-panel", title: "Story and trace", body: <DrillRow label="Story Director panel" description="The story so far, arcs, analysis and what it sent last turn." onOpen={panel} /> },
  ] };
}
