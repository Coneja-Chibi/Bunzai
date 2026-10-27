/**
 * One model as a select row, for every setting that names a model (the narrator's, the Story Director's): the choices are the AI wing's own (`modelChoices`, use-scene-models.ts), the starred models first,
 * the model already saved shown even when its connection no longer lists it, and an empty choice that means "none" (or "use the narrator's"). What a pick does is the caller's.
 */
import type { JSX } from "react";
import type { ChatConnection } from "../../../../../../stage/contracts/chat-store";
import { keyOf, modelChoices, type SceneModels } from "../../../use-scene-models";
import { SelectRow, type RowCopy } from "../../frames/settings-rows";

/** `none` is the empty choice's words; `current` is the saved model, if any. A pick of the empty choice calls `onPick(null)`. */
export function ModelSelect({ models, current, none, onPick, ...copy }: RowCopy & { models: SceneModels; current: ChatConnection | undefined | null; none: string; onPick(model: ChatConnection | null): void }): JSX.Element {
  const choices = modelChoices(models);
  const starred = new Set(models.favorites);
  const ordered = [...choices.filter((c) => starred.has(c.value)), ...choices.filter((c) => !starred.has(c.value))];
  const key = current ? keyOf(current) : "";
  const options = [{ value: "", label: none }, ...(key && !choices.some((c) => c.value === key) ? [{ value: key, label: key.replace("|", ": ") }] : []), ...ordered.map((c) => ({ value: c.value, label: c.label }))];
  return <SelectRow {...copy} value={key} options={options} onChange={(next) => { if (next === "") { onPick(null); return; } const hit = choices.find((c) => c.value === next); if (hit) onPick(hit.conn); }} />;
}
