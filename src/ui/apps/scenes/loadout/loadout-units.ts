/**
 * The ten units a loadout writes through: what the scene holds for each now, the
 * one way to compare two values of a unit, and the one setter call that writes it. Apply and Undo both go through
 * `writeUnit`, so a restore is the same call as the write it undoes.
 */
import type { LoadoutUnit } from "../../../../core/loadout-panels";
import type { ChatBackdrop, ChatConnection, ChatNote, ChatPreset, JsonValue } from "../../../../stage/contracts/chat-store";
import type { SceneLoreChoice, SceneSettings, ScenesApi } from "../../../app-contract-scenes";

/** The part of the scenes api the engine uses, so a test hands it a stand-in. */
export type LoadoutApi = Pick<
  ScenesApi,
  | "sceneSettings" | "setSceneConnection" | "setScenePreset" | "setSceneLore" | "setSceneProps" | "setScenePrompting" | "setSceneRegex" | "setSceneFinalCut" | "setSceneBackdrop" | "editScene"
  | "saveLoadoutReceipt" | "finishLoadoutReceipt" | "markLoadoutReceiptUndone"
>;

/** A unit's value with an empty list and an unset field both read as null, so "nothing" has one spelling. */
export function normUnit(unit: LoadoutUnit, value: unknown): JsonValue {
  if (value === undefined || value === null) return null;
  const empty =
    (unit === "lore" && !(value as SceneLoreChoice).added.length && !(value as SceneLoreChoice).off.length) ||
    (unit === "props" && !(value as { on: string[] }).on.length) ||
    (unit === "guides" && !(value as string[]).length) ||
    (unit === "regex" && !(value as string[]).length) ||
    (unit === "finalCut" && Object.keys(value as object).length === 0);
  return empty ? null : (value as JsonValue);
}

/** What the scene holds for a unit right now, in the shape the unit's setter takes. */
export function liveUnit(live: SceneSettings, unit: LoadoutUnit): JsonValue {
  const raw: Record<LoadoutUnit, unknown> = {
    connection: live.connection, preset: live.preset, lore: live.lore, props: live.props,
    guides: live.prompting?.guides, note: live.prompting?.note, regex: live.regex?.sets, finalCut: live.finalCut, backdrop: live.backdrop, persona: live.persona,
  };
  return normUnit(unit, raw[unit]);
}

const WRITE: Record<LoadoutUnit, (api: LoadoutApi, chatId: string, v: JsonValue) => Promise<unknown>> = {
  connection: (api, id, v) => api.setSceneConnection(id, v as ChatConnection | null),
  preset: (api, id, v) => api.setScenePreset(id, v as ChatPreset | null),
  lore: (api, id, v) => api.setSceneLore(id, v as SceneLoreChoice | null),
  props: (api, id, v) => api.setSceneProps(id, (v as { on: string[] } | null)?.on ?? []),
  guides: (api, id, v) => api.setScenePrompting(id, { guides: v as string[] | null }),
  note: (api, id, v) => api.setScenePrompting(id, { note: v as ChatNote | null }),
  regex: (api, id, v) => api.setSceneRegex(id, { sets: v as string[] | null }),
  finalCut: (api, id, v) => {
    const f = v as { on?: true; passes?: unknown[]; tools?: object } | null;
    return api.setSceneFinalCut(id, { on: f?.on ?? null, passes: (f?.passes as never) ?? null, tools: (f?.tools as never) ?? null });
  },
  backdrop: (api, id, v) => api.setSceneBackdrop(id, v as ChatBackdrop | null),
  persona: (api, id, v) => api.editScene("persona", { chatId: id, personaId: v as string | null }),
};

/** Writes one unit through its setter and answers what the setter answered (the page refreshes from it). */
export const writeUnit = (api: LoadoutApi, chatId: string, unit: LoadoutUnit, value: JsonValue): Promise<unknown> => WRITE[unit](api, chatId, value);
