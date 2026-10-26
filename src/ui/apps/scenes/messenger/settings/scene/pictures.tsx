/**
 * The scene scope's Pictures page (wireframe SCOPES.scene, pics): the backdrop's values as rows (overlay darkness and a video's speed, written through `api.setSceneBackdrop` as the backdrop
 * picker writes them) and the gallery and wardrobe tools as drill rows, shown while their Stage tabs are. Picking the picture is the Control Panel layer's picker. Blur has no store and is not drawn.
 */
import type { JSX } from "react";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { DEFAULT_DIM, MAX_DIM, MAX_RATE, MIN_RATE, dimOf, isVideoRef, itemOf, rateOf } from "../../../scene-backdrop-core";
import { STAGE_TABS } from "../../../scene-stage-wing";
import { useBackdropPack } from "../../../use-backdrop-pack";
import { DrillRow } from "../../frames/settings-rows";
import type { SettingsCategory, SettingsSection } from "../../frames/settings-window";
import { onChatOf, type WingArgs } from "../../wing-props";
import type { OpenProgram } from "../scopes";
import { SavedSlider } from "./saved";

function BackdropRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const { ctx } = a;
  const chat = a.scene.chat;
  const onChat = onChatOf(a);
  const b = chat.backdrop;
  const loaded = useBackdropPack(ctx, b?.pack);
  const item = b && loaded.state === "ready" ? itemOf(loaded.pack, b) : null;
  const write = async (next: NonNullable<typeof b>): Promise<void> => {
    try { onChat(await ctx.api.setSceneBackdrop(chat.id, next)); } catch (e) { ctx.setStatus(`Could not change the backdrop: ${toErrorMessage(e)}`); }
  };
  return (
    <>
      <DrillRow label="Backdrop" description="The picture behind this scene's messages." value={b ? item?.label ?? "Picked" : "None"} onOpen={() => open("display")} />
      {b && <SavedSlider label="Overlay darkness" description={`How much the theme's color covers the picture. ${String(Math.round(DEFAULT_DIM * 100))}% is the default.`} saved={Math.round(dimOf(b) * 100)} min={0} max={Math.round(MAX_DIM * 100)} step={5} unit="%" write={(n) => write({ ...b, dim: n / 100 })} />}
      {b && item && isVideoRef(item.ref, item.mime) && <SavedSlider label="Video speed" saved={rateOf(b)} min={MIN_RATE} max={MAX_RATE} step={0.05} unit="x" write={(rate) => write({ ...b, rate })} />}
    </>
  );
}

export function picturesCategory(a: WingArgs, open: OpenProgram): SettingsCategory {
  const { scene } = a;
  const shown = (id: string): boolean => STAGE_TABS.some((t) => t.id === id && t.visible({ scene, propsOn: a.propsOn, prefs: a.ctx.prefs }));
  const tools: SettingsSection[] = [
    ...(shown("gallery") ? [{ id: "gallery", title: "My pictures", description: "Apply any picture as the backdrop.", body: <DrillRow label="Open gallery" onOpen={() => open("image-gallery")} /> }] : []),
    ...(shown("wardrobe") ? [{ id: "wardrobe", title: "Wardrobe", body: <DrillRow label="Open wardrobe" onOpen={() => open("wardrobe")} /> }] : []),
  ];
  return { id: "pictures", label: "Pictures", icon: "lucide:image", group: "Features", sections: [{ id: "backdrop", title: "Backdrop", body: <BackdropRows a={a} open={open} /> }, ...tools] };
}
