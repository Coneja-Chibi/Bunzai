/**
 * The deeper page of favorite models (wireframe SCOPES.scene, models: "Search the list, mark favorites"): one switch per model every connection lists, the star the AI wing's model list draws, written by the same
 * `toggleFavorite` (use-scene-models.ts, the per-user pref `scenes.favoriteModels`). The list can run to hundreds of rows, so it is windowed, and a search narrows it.
 */
import { useState, type JSX } from "react";
import { VirtualRows } from "../../../../../_shared/virtual-list";
import { TextAreaRow, ToggleRow } from "../../frames/settings-rows";
import { onChatOf } from "../../wing-props";
import { modelChoices, useSceneModels } from "../../../use-scene-models";
import { chatOf, type SceneEnv } from "./env";

const ROW_PX = 64;

export function FavoriteModels({ env }: { env: SceneEnv }): JSX.Element {
  const models = useSceneModels(env.a.ctx, chatOf(env), onChatOf(env.a));
  const [query, setQuery] = useState("");
  const starred = new Set(models.favorites);
  const q = query.trim().toLowerCase();
  const all = modelChoices(models);
  const shown = all.filter((c) => !q || c.label.toLowerCase().includes(q));
  return (
    <div data-part="scene.messenger.settings.models.favorites">
      <TextAreaRow label="Search models" description={`${all.length.toLocaleString()} models across your connections.`} rows={1} value={query} onChange={setQuery} />
      {models.conns !== null && all.length === 0 && <p className="msn-st-secd">None of your connections lists a model yet.</p>}
      <VirtualRows items={shown} keyOf={(c) => c.value} estimate={ROW_PX} render={(c) => <ToggleRow label={c.label} description="Shown first in the narrator and Story Director model lists." on={starred.has(c.value)} onChange={() => models.toggleFavorite(c.value)} />} />
    </div>
  );
}
