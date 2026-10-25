/**
 * Mood Music's "Show Music tab" sub-row (RoleCall StagecraftExtensions.tsx:1535-1552, stageSettings.showMoodMusicTab): hides the Stage wing's
 * Music tab while the Prop, and its playback, stay on. A per-user pref, like the Stage wing's other display switches (07-stage.md).
 */
import { useState, type JSX } from "react";
import type { AppContext } from "../../../../app-contract";
import type { Chat } from "../../../../../stage/contracts/chat-store";
import { MUSIC_TAB_PREF, musicTabShown } from "../../stage-music-core";
import { ToggleSwitch } from "../../../../components/toggle-switch";

export function MusicTabRow({ ctx }: { ctx: AppContext; chat: Chat }): JSX.Element {
  const [shown, setShown] = useState(() => musicTabShown(ctx.prefs));
  const flip = (): void => { ctx.prefs.set(MUSIC_TAB_PREF, !shown); setShown(!shown); };
  return (
    <div className="pw-subrow" data-part="props.mood-music">
      <div><b>Show Music tab</b><small>Hide the right-side tab while keeping MoodMusic playback active.</small></div>
      <ToggleSwitch size="sm" on={shown} aria-label={`${shown ? "Hide" : "Show"} Mood Music tab`} onChange={flip} />
    </div>
  );
}
