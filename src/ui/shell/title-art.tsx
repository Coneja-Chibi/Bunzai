/** The newest scene's backdrop art for a title variant, or nothing when there is no scene (or no piece store). */
import type { JSX } from "react";
import { SceneArt } from "../_shared/scene-art";
import type { PieceStore } from "../_shared/piece-store";
import type { SceneSummary } from "../../studio/scenes";

export default function RecentArt({ recent, pieces }: { recent: SceneSummary | null; pieces?: PieceStore }): JSX.Element | null {
  if (!recent || !pieces) return null;
  return <SceneArt ctx={{ pieces }} chatId={recent.id} characterId={recent.cast.character.id} snapshotVersion={recent.snapshotVersion} hasArt={recent.hasPortrait} name={recent.characterName} />;
}
