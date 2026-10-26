/**
 * The scene scope of the Messenger settings (approved wireframe messenger-discord/settings.html, SCOPES.scene), filed by where each value is stored: lorebooks, the compendium, participants,
 * the model and the Control Booth are this scene's, so they sit here even where the wireframe drew them under the character. A section is only rows: each bound to the writer the Full Chat
 * panel uses, or a drill row that opens the tool's Messenger program through the shell's opener. One file per category under ./scene. Rows the maps mark missing (stream replies, Director
 * pacing, backdrop blur) are not drawn.
 */
import type { SettingsScope } from "../frames/settings-window";
import type { WingArgs } from "../wing-props";
import type { OpenProgram } from "./scopes";
import { boothCategory } from "./scene/booth";
import { featuresCategories } from "./scene/features";
import { memoryCategory } from "./scene/memory";
import { overviewCategory } from "./scene/overview";
import { picturesCategory } from "./scene/pictures";
import { worldCategory } from "./scene/world";
import { writingCategory } from "./scene/writing";

export function sceneScope(a: WingArgs, open: OpenProgram): SettingsScope {
  const { scene } = a;
  const env = { a, open };
  return {
    id: "scene", title: scene.chat.title ?? a.name, kind: "Scene", subtitle: `${scene.messageCount} messages`,
    categories: [overviewCategory(a, open), boothCategory(a, open), writingCategory(env), memoryCategory(env), worldCategory(a, open), ...featuresCategories(a, open), picturesCategory(a, open)],
  };
}
