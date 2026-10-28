/**
 * The only numbers a decoder uses to bound untrusted input. An imported card or file can be hostile, so a decoder refuses a list,
 * a text or a number far past anything a person writes. These are hostile-input guards set about 100 times past real use, NOT
 * design limits: nothing here is a product rule, and a refusal says the file is unusually large, not that the person hit a limit.
 * A decoder that needs a bound uses one of these and never a number of its own.
 */

/** Items in one list (fields, rows, ids, choices): a hostile file, not a design limit. */
export const SANITY_LIST = 10_000;
/** Characters in one text (a note, a template, a formula, a row): a hostile file, not a design limit. */
export const SANITY_TEXT = 1_000_000;
/** The largest whole number a decoder takes (a die's sides, a weight, a range end): a hostile-input guard, not a design limit. */
export const SANITY_NUMBER = Number.MAX_SAFE_INTEGER;

/** What a refusal says when a value passes a ceiling. */
export const SANITY_REFUSAL = "unusually large";
