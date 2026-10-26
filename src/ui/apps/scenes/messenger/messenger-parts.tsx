/**
 * The Messenger's shared small parts: the round avatar (the art when there is some, else the first two letters) and the scene avatar built from a scene's frozen cast. The rail, the sidebar,
 * the header and the member list are in shell/.
 */
import type { JSX, ReactNode } from "react";
import type { AppContext } from "../../../app-contract";
import { SceneArt } from "../scene-art";
import type { SceneSummary } from "../../../../studio/scenes";

export const initials = (name: string): string => name.trim().slice(0, 2).toUpperCase() || "B";

export function Avatar({ name, art }: { name: string; art?: ReactNode }): JSX.Element {
  return <span className="msn-av" aria-hidden="true">{art ?? initials(name)}</span>;
}

export function SceneAvatar({ ctx, scene }: { ctx: AppContext; scene: Pick<SceneSummary, "id" | "snapshotVersion" | "hasPortrait" | "cast"> & { characterName: string } }): JSX.Element {
  return <Avatar name={scene.characterName} {...(scene.hasPortrait ? { art: <SceneArt ctx={ctx} chatId={scene.id} characterId={scene.cast.character.id} snapshotVersion={scene.snapshotVersion} hasArt name={scene.characterName} /> } : {})} />;
}
