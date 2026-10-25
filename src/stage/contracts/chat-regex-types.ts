/**
 * What a scene keeps of the regex sets it uses and of the answers it gave a preset's choice groups.
 * `sets` is RoleCall's `regex_script_ids`: the scripts the person switched on for this chat, in the order they were switched on. `choices`
 * is RoleCall's `preset_choice_selections`: per preset, per choice group, the person's answer. The sets and the presets are the library's;
 * the store never checks an id against it (D18), and a set or preset that is gone is left out. Split from chat-store.ts for the file-size
 * cap; chat-store.ts re-exports.
 */

/** One answer to a choice group: an option id (select_one), option ids (select_many), on or off (toggle), or free text (input). */
export type ChoicePick = string | string[] | boolean;

/** The answers to one preset's choice groups, by group id. Sparse: a group never answered is not here and takes its declared default. */
export type ChoicePicks = Record<string, ChoicePick>;

export interface ChatRegex {
  /** Regex set ids, in the order they were switched on. No duplicates, at most 50, each 1 to 200 characters with no control characters. */
  sets?: string[];
  /** The Wardrobe's rack: sets the person hung up, kept so they can be worn again after a reload. Same shape as `sets`; a set on the rack is not on. */
  rack?: string[];
  /** Answers by preset id, at most 50 presets. */
  choices?: Record<string, ChoicePicks>;
}

/**
 * A change to a scene's regex: a key given replaces it, a key given as null clears it, a key left out stays. `choices` merges: each preset
 * given merges group by group (a group given as null is cleared, a preset given as null forgets all its answers).
 */
export interface ChatRegexPatch {
  sets?: string[] | null;
  rack?: string[] | null;
  choices?: Record<string, Record<string, ChoicePick | null> | null> | null;
}
