/**
 * Vendor bundle: the password strength meter (zxcvbn, decision 5).
 * Its dictionaries are large, so it is a bundle of its own, fetched only when a password is being
 * chosen, never with the Settings screen. It runs in the page; the password never leaves it.
 */
import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as common from "@zxcvbn-ts/language-common";
import * as en from "@zxcvbn-ts/language-en";

const meter = new ZxcvbnFactory({
  dictionary: { ...common.dictionary, ...en.dictionary },
  graphs: common.adjacencyGraphs,
  translations: en.translations,
});

export interface Strength {
  /** 0 (guessable at once) to 4 (very hard): the meter's four segments light `score` of them. */
  score: 0 | 1 | 2 | 3 | 4;
  warning: string | null;
  suggestions: string[];
}

/** How hard a password is to guess. Only the score and advice come back, never the password. */
export function passwordStrength(password: string): Strength {
  const r = meter.check(password);
  return { score: r.score, warning: r.feedback.warning, suggestions: r.feedback.suggestions };
}
