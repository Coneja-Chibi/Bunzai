/**
 * The Trackers page's rows for each legacy tracker switched on: its AI Context (Always, Every 2, Every 5, Never; written by the tracker's own `useTracker().setContext`, the writer its panel's
 * settings menu calls) and, while the Story Director updates trackers on its own, whether it updates this one and how often (`api.setSceneTracker` with `auto`, as the Director's list writes it).
 * Storyboards are not listed: their context is part of their own Compendium panel, where Off is a different state from Always.
 */
import type { JSX } from "react";
import { isStoryboard } from "../../../../../../core/trackers";
import { TRACKER_CONTEXTS, TRACKER_PROP_PREFIX, type TrackerContext, type TrackerModule } from "../../../../../../stage/contracts/chat-store";
import { DIRECTOR_EVERY_MAX } from "../../../../../../stage/contracts/director-types";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { CONTEXT_LABELS } from "../../../props/trackers/tracker-frame";
import { useTracker } from "../../../props/trackers/use-tracker";
import { autoOf, listedModules } from "../../../props/story-director/auto-update";
import { useDirectorPanel } from "../../../props/story-director/use-director-panel";
import { isTrackerProp, moduleOf } from "../../panels/trackers/trackers-core";
import { ActionRow, SelectRow } from "../../frames/settings-rows";
import { onChatOf, type WingArgs } from "../../wing-props";
import { SavedNumber, SavedToggle } from "./saved";

const sentence = (words: string): string => words.charAt(0) + words.slice(1).toLowerCase();
const CONTEXTS = TRACKER_CONTEXTS.map((c) => ({ value: c, label: sentence(CONTEXT_LABELS[c]) }));
const identity = (data: unknown): unknown => data;

const named = (a: WingArgs, module: TrackerModule): { module: TrackerModule; name: string } => ({ module, name: a.registeredProps.find((p) => p.id === `${TRACKER_PROP_PREFIX}${module}`)?.name ?? module });

/** Every legacy tracker switched on in the scene (the storyboards have their own panel). */
const legacyOn = (a: WingArgs): { module: TrackerModule; name: string }[] =>
  a.registeredProps.filter((p) => isTrackerProp(p) && a.propsOn?.includes(p.id) && !isStoryboard(moduleOf(p))).map((p) => named(a, moduleOf(p)));

function ContextRow({ a, module, name }: { a: WingArgs; module: TrackerModule; name: string }): JSX.Element {
  const view = useTracker({ ctx: a.ctx, chat: a.scene.chat, onChat: onChatOf(a) }, module, identity);
  return (
    <>
      <SelectRow<TrackerContext> label={`${name}: AI context`} description="How often this tracker is sent to the model with a reply." value={view.context} options={CONTEXTS} onChange={(c) => view.setContext(c)} />
      {view.error && <p className="msn-st-secd" role="alert">{view.error}</p>}
    </>
  );
}

export function TrackerContextRows({ a }: { a: WingArgs }): JSX.Element {
  return <>{legacyOn(a).map(/* bounded-ok: the trackers switched on in one scene */ (t) => <ContextRow key={t.module} a={a} module={t.module} name={t.name} />)}</>;
}

/** Each tracker's own switch and number for the Story Director's automatic updates; the default is the Director's "Every N replies". */
export function TrackerAutoRows({ a }: { a: WingArgs }): JSX.Element | null {
  const { ctx } = a;
  const chat = a.scene.chat;
  const onChat = onChatOf(a);
  const director = useDirectorPanel(ctx, chat);
  if (director.load.state !== "ready" || !director.load.panel.on || !director.load.panel.settings.autoUpdate) return null;
  const every = director.load.panel.settings.every;
  const write = async (module: TrackerModule, name: string, auto: ReturnType<typeof autoOf>): Promise<void> => {
    try { onChat(await ctx.api.setSceneTracker(chat.id, module, { auto })); } catch (e) { ctx.setStatus(`could not change ${name}: ${toErrorMessage(e)}`); }
  };
  return (
    <>
      {listedModules(chat).map((m) => named(a, m)).map(/* bounded-ok: the trackers switched on in one scene */ ({ module, name }) => {
        const own = chat.trackers?.[module]?.auto;
        const on = own?.on !== false;
        return (
          <div key={module} data-part="scene.messenger.settings.tracker.auto">
            <SavedToggle label={`${name}: update automatically`} description="Whether the Story Director keeps this tracker up to date after a reply." saved={on} write={(next) => write(module, name, autoOf(next, own?.every))} />
            {on && <SavedNumber label={`${name}: every N replies`} description={`Replies between its updates. ${every === 1 ? "1 is after every reply" : `Leave it at ${every} to follow the Story Director`}.`} saved={own?.every ?? every} min={1} max={DIRECTOR_EVERY_MAX} step={1}
              write={(n) => write(module, name, autoOf(on, n === every ? undefined : n))} />}
            {on && own?.every !== undefined && own.every !== every && <ActionRow label={`${name}: use the default`} description={`Go back to every ${every} ${every === 1 ? "reply" : "replies"}.`} action="Use default" onAction={() => void write(module, name, autoOf(on, undefined))} />}
          </div>
        );
      })}
    </>
  );
}
