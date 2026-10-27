/**
 * A character's starting setup for new scenes (messenger backlog 23, D6): the preset (with its sampler overrides), the backdrop and whether the Story Director is on, kept per character in one
 * user pref and copied onto a scene as it is started, and only then. The checks are the scene store's own (checkPreset, checkBackdrop), so a default can never be something a scene could not hold.
 * Reading is per field: a field that cannot be read is reported and left off, the rest still apply. Writing keeps every other character's entry and every field it does not know, as authored.
 */
import { isPlainObject } from "../core/guards";
import { SETTING_KEYS } from "./settings-shape";
import { checkBackdrop } from "../stage/store/backdrop-rules";
import { checkPresetSamplers } from "../stage/store/preset-rules";
import { checkText } from "../stage/store/chat-rules";
import type { Chat, ChatBackdrop, ChatPresetSamplers, ChatStore } from "../stage/contracts/chat-store";
import { DIRECTOR_PROP_ID } from "../core/director/settings";
import type { StudioStoreLike } from "./contracts";

/** The pref the character scope writes and a new scene reads: `{ [characterId]: CharacterDefaults }`. */
export const CHARACTER_DEFAULTS_PREF = SETTING_KEYS.sceneCharacterDefaults;

export interface CharacterDefaults {
  /** A writing setup's id (a preset, a Script Sheet); the scene starts following it. */
  presetId?: string;
  /** That setup's kind; absent is a preset. */
  presetKind?: string;
  /** Sampler overrides laid over that preset; they ride on the preset, so they apply only with `presetId`. */
  samplers?: ChatPresetSamplers;
  backdrop?: ChatBackdrop;
  /** true switches the Story Director prop on for the new scene. */
  director?: boolean;
}

export const DEFAULT_FIELDS = ["presetId", "presetKind", "samplers", "backdrop", "director"] as const;
export type DefaultField = (typeof DEFAULT_FIELDS)[number];

const attempt = <T>(read: () => T): T | undefined => { try { return read(); } catch { return undefined; } };

/** One character's defaults from the saved pref, and the fields that were there but could not be read. Never throws. */
export function characterDefaultsOf(raw: unknown, characterId: string): { defaults: CharacterDefaults | null; problems: DefaultField[] } {
  const entry = isPlainObject(raw) && Object.hasOwn(raw, characterId) ? raw[characterId] : undefined;
  if (entry === undefined) return { defaults: null, problems: [] };
  if (!isPlainObject(entry)) return { defaults: null, problems: [...DEFAULT_FIELDS] };
  const defaults: CharacterDefaults = {};
  const problems: DefaultField[] = [];
  for (const field of DEFAULT_FIELDS) {
    const v = entry[field];
    if (v === undefined) continue;
    const ok = field === "presetId" ? attempt(() => (checkText(v, "preset id").trim() === "" ? undefined : (v as string)))
      : field === "presetKind" ? (typeof v === "string" && /^[a-z]+$/.test(v) ? v : undefined)
      : field === "samplers" ? attempt(() => checkPresetSamplers(v))
      : field === "backdrop" ? attempt(() => checkBackdrop(v) ?? undefined)
      : typeof v === "boolean" ? v : undefined;
    if (ok === undefined) problems.push(field);
    else (defaults as Record<string, unknown>)[field] = ok;
  }
  return { defaults: Object.keys(defaults).length > 0 ? defaults : null, problems };
}

/** The saved map with one character's fields changed: a value sets it, null clears it, a field left out stays. Everything else in the map is kept as it was; an emptied entry is dropped. */
export function withCharacterDefaults(raw: unknown, characterId: string, patch: { [K in DefaultField]?: CharacterDefaults[K] | null }): Record<string, unknown> {
  const map: Record<string, unknown> = isPlainObject(raw) ? { ...raw } : {};
  const entry: Record<string, unknown> = isPlainObject(map[characterId]) ? { ...(map[characterId] as Record<string, unknown>) } : {};
  for (const field of DEFAULT_FIELDS) {
    const v = patch[field];
    if (v === null) delete entry[field]; else if (v !== undefined) entry[field] = v;
  }
  if (Object.keys(entry).length > 0) map[characterId] = entry; else delete map[characterId];
  return map;
}

const FIELD_NAME: Record<DefaultField, string> = { presetId: "preset", presetKind: "preset", samplers: "sampler choices", backdrop: "backdrop", director: "Story Director choice" };

/**
 * Lays a character's saved defaults onto the scene just started. Each part is its own write through the store's own setter; a part that cannot be applied (unreadable, its preset or backdrop pack deleted,
 * or the write refused) is left off and named in `notes`, and the scene is returned as it stands.
 */
export async function applyCharacterDefaults(chats: ChatStore, studio: StudioStoreLike, started: Chat, characterId: string, name: string, saved: unknown): Promise<{ chat: Chat; notes: string[] }> {
  const { defaults, problems } = characterDefaultsOf(saved, characterId);
  const notes = problems.map((f) => `${name}'s saved ${FIELD_NAME[f]} could not be read, so this scene started without it.`);
  if (!defaults) return { chat: started, notes };
  let chat = started;
  const run = async (what: string, write: () => Promise<Chat | null>): Promise<void> => {
    try { chat = (await write()) ?? chat; } catch { notes.push(`${name}'s starting ${what} could not be applied, so this scene started without it.`); }
  };
  const there = async (kind: string, id: string): Promise<boolean> => (await studio.readVersioned(kind, id)) !== null;
  if (defaults.presetId !== undefined) {
    const kind = defaults.presetKind;
    if (kind && await there(kind, defaults.presetId)) await run("preset", () => chats.setPreset(chat.id, { kind, id: defaults.presetId!, toggles: {}, samplers: defaults.samplers ?? {} }));
    else notes.push(`${name}'s starting preset is no longer in the library, so this scene started without a preset.`);
  }
  if (defaults.backdrop) {
    if (await there("pack", defaults.backdrop.pack)) await run("backdrop", () => chats.setBackdrop(chat.id, defaults.backdrop!));
    else notes.push(`${name}'s starting backdrop picture pack is no longer in the library, so this scene started without a backdrop.`);
  }
  if (defaults.director === true) await run("Story Director choice", () => chats.setProps(chat.id, { on: [DIRECTOR_PROP_ID] }));
  return { chat, notes };
}
