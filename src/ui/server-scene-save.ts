/** Saves a scene carrier for the two import routes (save-bundle, save-staged): the studio's scene import, told how the persona codec names its avatar. */
import type { BundleSaveResult } from "../studio/bundle";
import type { StudioStoreLike } from "../studio/contracts";
import { saveScene } from "../studio/scene-import";
import { personaAvatarStem } from "../formats/sillytavern/persona";

export const saveSceneCarrier = (store: StudioStoreLike, raw: unknown): Promise<BundleSaveResult> => saveScene(store, raw, personaAvatarStem);
