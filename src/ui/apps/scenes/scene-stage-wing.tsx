/**
 * The Stage wing: RoleCall's Tools / Stage strip over its tabs (RightWingPanelContent.tsx, right-wing-groups.ts:108-115).
 * Appearance holds the display settings (stage-appearance.tsx); Gallery, Music, Spotify and Wardrobe are mount points
 * (stage-tabs.ts) shown while their `visible` says so. One width for every tab (RoleCall resized the wing per tab, F1).
 */
import { useEffect, useState, type JSX } from "react";
import { FoldoutTabs, type FoldoutTab } from "./scene-foldout";
import { StageAppearance, type AppearanceProps } from "./stage-appearance";
import { GALLERY_TAB } from "./stage-gallery";
import { MUSIC_TAB } from "./stage-music";
import { SPOTIFY_TAB } from "./stage-spotify";
import { WARDROBE_TAB } from "./stage-wardrobe";
import type { StageTab, StageTabId, StageTabProps } from "./stage-tabs";
import type { OpenScene } from "../../../studio/scenes";
import { ThemeSlot } from "../../_shared/theme-slot";
import type { StageOpenRequest } from "./use-stage-open";
import { tabOr } from "./scene-wing-data";

/** In RoleCall's order after Appearance. */
export const STAGE_TABS: readonly StageTab[] = [GALLERY_TAB, MUSIC_TAB, SPOTIFY_TAB, WARDROBE_TAB];

/** The scene the tabs belong to; absent while no scene is open, which leaves Appearance alone. */
export interface StageHost extends Omit<StageTabProps, "chat"> { propsOn: readonly string[] | null; request?: StageOpenRequest | null }
export interface StageProps extends AppearanceProps { host?: StageHost }

/** The newest tab request this wing has acted on: each is honoured once, so an old one never re-picks a tab on a later open. */
let honored = 0;
const honor = (request: StageOpenRequest | null | undefined): StageTabId | null => {
  if (!request || request.n <= honored) return null;
  honored = request.n;
  return request.tab;
};

export function StageWing({ host, initialTab, ...appearance }: StageProps & { initialTab?: string }): JSX.Element {
  const [active, setActive] = useState<StageTabId>(() => { const asked = honor(host?.request); return initialTab ? tabOr(["appearance", ...STAGE_TABS.map((t) => t.id)], initialTab, "appearance") : asked ?? "appearance"; });
  useEffect(() => { const tab = honor(host?.request); if (tab) setActive(tab); }, [host?.request]);
  const shown = host ? STAGE_TABS.filter((t) => t.visible({ scene: host.scene, propsOn: host.propsOn, prefs: host.ctx.prefs })) : [];
  const open = shown.find((t) => t.id === active);
  const shownTab: StageTabId = open ? active : "appearance";
  const tabs: FoldoutTab<StageTabId>[] = [{ id: "appearance", label: "Appearance" }, ...shown.map((t) => ({ id: t.id, label: t.label, ...metaOf(t, host?.scene) }))];
  return (
    <>
      <FoldoutTabs<StageTabId> area="Tools" group="Stage" tabs={tabs} active={shownTab} onSelect={setActive} />
      <div className="wtab" data-part="scene.stage">
        {shownTab === "appearance" && <ThemeSlot id="scene.wing.stage.appearance" />}
        {shownTab === "gallery" && <ThemeSlot id="scene.wing.stage.gallery" />}
        {shownTab === "music" && <ThemeSlot id="scene.wing.stage.music" />}
        {shownTab === "spotify" && <ThemeSlot id="scene.wing.stage.spotify" />}
        {shownTab === "wardrobe" && <ThemeSlot id="scene.wing.stage.wardrobe" />}
        {host && open ? <open.Panel ctx={host.ctx} chat={host.scene.chat} scene={host.scene} onChat={host.onChat} /> : <StageAppearance {...appearance} backdropSet={host?.scene.chat.backdrop !== undefined} />}
      </div>
    </>
  );
}

const metaOf = (t: StageTab, scene: OpenScene | undefined): { meta?: string } => {
  const meta = scene && t.meta?.(scene);
  return meta ? { meta } : {};
};
