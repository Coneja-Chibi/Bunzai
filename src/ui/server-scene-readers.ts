/**
 * What a scene's turn reads from the library beyond its own store: the regex sets the scene has on (ChatStore rule 42), as data for the
 * page's sandbox worker, and the person's saved choice answers for a preset (the pref `scenes.presetChoiceDefaults`, core/preset/choices.ts).
 * Both are reads; nothing here runs a rule.
 */
import type { RegexSetBody } from "../entities/regex/schema";
import { PRESET_CHOICE_DEFAULTS_KEY, defaultsFor } from "../core/preset/choices";
import type { SettingsStoreLike, StudioStoreLike } from "../studio/contracts";
import { bodyReader } from "../studio/body-reader";

export const choiceDefaultsOf = (settings: SettingsStoreLike | undefined): ((presetId: string) => Promise<Record<string, unknown> | undefined>) | undefined =>
  settings ? async (presetId) => defaultsFor((await settings.read() as unknown as Record<string, unknown>)[PRESET_CHOICE_DEFAULTS_KEY], presetId) : undefined;

export const regexReaderOf = (studio: StudioStoreLike | undefined): ((id: string) => Promise<RegexSetBody | null>) | undefined =>
  studio ? bodyReader<RegexSetBody>(studio, "regex") : undefined;

/** The optional turn dependencies, present only when their source is. */
export const sceneReaders = (studio: StudioStoreLike | undefined, settings: SettingsStoreLike | undefined) => {
  const readRegex = regexReaderOf(studio);
  const choiceDefaults = choiceDefaultsOf(settings);
  return { ...(readRegex ? { readRegex } : {}), ...(choiceDefaults ? { choiceDefaults } : {}) };
};
