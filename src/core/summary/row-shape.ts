/**
 * What one row of the `summary` slot holds (slots/summary.ts), checked by the stores on every write. A generated row is keyed by the swipe id of the version it ends at; the person's
 * own text is the row keyed `person`. `edit` is a fresh id for every save of that text and `n` counts the saves along the chain (the `n` of the text it replaced, plus one); a generated row records in
 * `saw` and `sawN` the `edit` and `n` of the person row its writer read (none when there was none), which is how the two layers are ordered without a clock: a row that saw an older text is covered by a newer one,
 * and a row that saw a text that is gone (its message was deleted) still shows. `replace` marks a block that stands in for the text before it.
 */
import { SANITY_NUMBER, SANITY_TEXT } from "../../entities/_shared/sanity";
import { bool, num, obj, opt, str, type Of } from "../trackers/shape";

const id = str({ min: 1, max: SANITY_TEXT });
export const summaryRowShape = obj({
  version: id,
  text: str({ max: SANITY_TEXT }),
  through: num({ lo: 0, hi: SANITY_NUMBER, int: true }),
  at: num({ lo: 0, hi: SANITY_NUMBER }),
  replace: opt(bool()),
  edit: opt(id),
  n: opt(num({ lo: 0, hi: SANITY_NUMBER, int: true })),
  saw: opt(id),
  sawN: opt(num({ lo: 0, hi: SANITY_NUMBER, int: true })),
});
export type SummaryRow = Of<typeof summaryRowShape>;
