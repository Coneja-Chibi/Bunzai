/**
 * The Stage wing's tab contract (RoleCall's buildRightFoldoutTabs, right-wing-groups.ts:108-115): Appearance, Gallery, Music, Spotify,
 * Wardrobe, in that order. Each tab beyond Appearance lives in its own file and exports one StageTab; the wing maps the
 * list through FoldoutTabs and shows the ones whose `visible` says so. A tab body carries no title of its own (the strip owns it).
 */
import type { JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { OpenScene } from "../../../studio/scenes";

export type StageTabId = "appearance" | "gallery" | "music" | "spotify" | "wardrobe";

/** What the wing hands every tab body. */
export interface StageTabProps { ctx: AppContext; chat: Chat; scene: OpenScene; /** Takes the scene's chat back from a write a tab made (setSceneBackdrop), as the Backdrop row does. */ onChat(chat: Chat): void }

export interface StageTab {
  id: Exclude<StageTabId, "appearance">;
  label: string;
  /** The small line under the label; a gallery counts its pictures (RoleCall counted messages, F8). */
  meta?(scene: OpenScene): string | undefined;
  /** Music while its Prop is on, Spotify while connected, Wardrobe while it exists; `propsOn` is null until the Props switch has loaded. */
  visible(ctx: { scene: OpenScene; propsOn: readonly string[] | null; prefs?: AppContext["prefs"] }): boolean;
  Panel(props: StageTabProps): JSX.Element;
}
