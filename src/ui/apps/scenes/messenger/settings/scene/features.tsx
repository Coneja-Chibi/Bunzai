/**
 * The scene scope's Features pages (wireframe SCOPES.scene, props and the pages under it): one switch per registered Prop, through the page's own Props state (`a.propsState`, the same
 * list and write queue the Props wing and the rail read, so the rail follows); the Story Director's page (director.tsx); one page of tracker switches and a drill to the Trackers program
 * while any tracker is on; and a drill row to the program of any other Prop with a panel of its own, shown while it is on. Tracker sub-features are switches written with the module's `withSubs`.
 */
import type { JSX } from "react";
import { isTrackerModule } from "../../../../../../core/trackers";
import { DIRECTOR_PROP_ID } from "../../../../../../core/director/settings";
import { TRACKER_PROP_PREFIX } from "../../../../../../stage/contracts/chat-store";
import { toErrorMessage } from "../../../../../_shared/error-message";
import type { SceneProp } from "../../../props/prop-contract";
import { trackHareProp } from "../../../props/trackhare";
import { ActionRow, DrillRow, ToggleRow } from "../../frames/settings-rows";
import type { SettingsCategory, SettingsSection } from "../../frames/settings-window";
import { hasOwnProgram } from "../../panels";
import { isTrackerProp, trackersOn } from "../../panels/trackers/trackers-core";
import { onChatOf, type WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { ChangesRow } from "./changes-row";
import { directorCategory } from "./director";
import { HareRows, TooltipRow } from "./prop-pref-rows";
import { SavedToggle } from "./saved";
import { TrackerAutoRows, TrackerContextRows } from "./tracker-rows";

const GROUPS: readonly { group: SceneProp["group"]; id: string; title: string; description?: string }[] = [
  { group: undefined, id: "features", title: "Features", description: "Optional systems for this scene. A feature's own page shows in this list while it is on." },
  { group: "legacy", id: "legacy-trackers", title: "Legacy trackers", description: "Optional trackers the Story Director can keep up to date." },
  { group: "storyboard", id: "storyboards", title: "Storyboards", description: "Story state that feeds the Compendium's Storyboards tab." },
];

/** One switch per Prop of a group. Reads and writes the page's Props state; nothing is fetched here. */
function PropRows({ a, group }: { a: WingArgs; group: SceneProp["group"] }): JSX.Element {
  const { load, toggle, reload } = a.propsState;
  if (load.state === "loading") return <p className="msn-st-secd" role="status">Loading...</p>;
  if (load.state === "failed") return <ActionRow label="Could not read this scene's features" description={load.why} action="Try again" onAction={reload} />;
  return <>{a.registeredProps.filter((p) => p.group === group).map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (p) => <ToggleRow key={p.id} label={p.name} description={p.blurb} on={load.on.includes(p.id)} onChange={(on) => toggle(p.id, on)} />)}</>;
}

/** The Trackers drill and the sub-feature switches of the trackers that are on. Each is kept in the module's own state, so a tracker switched off keeps them. */
function TrackerRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { ctx } = a;
  const chat = a.scene.chat;
  const onChat = onChatOf(a);
  const withSubFeatures = a.registeredProps.filter((p) => isTrackerProp(p) && a.propsOn?.includes(p.id) && p.subs !== undefined);
  return (
    <>
      <DrillRow label="Trackers" description="Open the trackers that are on in this scene." value={`${String(trackersOn(a.registeredProps, a.propsOn).length)} on`} onOpen={() => open("trackers")} />
      {withSubFeatures.flatMap((p) => {
        const module = p.id.slice(TRACKER_PROP_PREFIX.length);
        if (!isTrackerModule(module)) return [];
        const on = chat.trackers?.[module]?.subs ?? {};
        return (p.subs ?? []).map((s) => (
          <SavedToggle key={`${p.id}.${s.id}`} label={`${p.name}: ${s.label}`} description={s.description} saved={on[s.id] === true}
            write={async (next) => {
              try { onChat(await ctx.api.setSceneTracker(chat.id, module, { subs: { ...on, [s.id]: next } })); } catch (e) { ctx.setStatus(`could not change ${p.name}: ${toErrorMessage(e)}`); }
            }} />
        ));
      })}
    </>
  );
}

export function featuresCategories(a: WingArgs, open: OpenProgram): SettingsCategory[] {
  const sections: SettingsSection[] = GROUPS.filter((g) => g.group === undefined || a.registeredProps.some((p) => p.group === g.group))
    .map((g) => ({ id: g.id, title: g.title, ...(g.description ? { description: g.description } : {}), body: <PropRows a={a} group={g.group} /> }));
  sections.push({ id: "tracker-changes", title: "What each reply changed", body: <ChangesRow a={a} /> }, { id: "prop-tooltips", title: "Props list", body: <TooltipRow a={a} /> });
  const pages: SettingsCategory[] = a.registeredProps.filter((p) => p.panel && hasOwnProgram(p) && a.propsOn?.includes(p.id)).map((p) => (p.id === DIRECTOR_PROP_ID ? directorCategory(a, open)
    : { id: `prop-${p.id}`, label: p.name, icon: p.icon, group: "Features", sections: [{ id: `prop-${p.id}`, title: p.name, description: p.blurb, body: <><DrillRow label={`Open ${p.name}`} onOpen={() => open(`prop-${p.id}`)} />{p.id === trackHareProp.id && <HareRows a={a} />}</> }] }));
  const trackers: SettingsCategory[] = trackersOn(a.registeredProps, a.propsOn).length > 0
    ? [{ id: "trackers", label: "Trackers", icon: "lucide:list", group: "Features", sections: [{ id: "trackers", title: "Trackers", description: "The trackers switched on in this scene.", body: <TrackerRows a={a} open={open} /> },
      { id: "tracker-each", title: "Each tracker", description: "How each tracker reaches the model and whether the Story Director keeps it current.", body: <><TrackerContextRows a={a} /><TrackerAutoRows a={a} /></> }] }] : [];
  return [{ id: "features", label: "Features", icon: "lucide:puzzle", group: "Features", sections }, ...pages, ...trackers];
}
