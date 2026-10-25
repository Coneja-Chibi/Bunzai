/** The player-name sanitizer reads word edges as Unicode: a name that starts or ends with a letter outside ASCII is cut like any other. */
import { describe, expect, test } from "bun:test";
import type { NarratorDirective } from "../../stage/contracts/director-types";
import { sanitizeForPlayerCharacter } from "./directive";

const with_ = (instruction: string): NarratorDirective => ({ mood: "m", pacing: "slow", callbacks: [{ reference: "r", instruction }] });
const kept = (d: NarratorDirective) => d.callbacks?.length === 1;

describe("non-ASCII names", () => {
  test.each([["Élodie", "Have Élodie feel the weight of it"], ["Élodie", "Élodie remembers the bell"], ["Åsa", "Let Åsa notice the draft"], ["沈墨", "沈墨 thinks about the letter"], ["Zoë", "Zoë's thoughts drift to the pier"]])("%s: %s is cut", (name, text) => {
    expect(kept(sanitizeForPlayerCharacter(with_(text), name))).toBe(false);
  });

  test("staging the same names is kept, and a longer word that merely contains the name is not mistaken for it", () => {
    expect(kept(sanitizeForPlayerCharacter(with_("Place Élodie at the third shelf"), "Élodie"))).toBe(true);
    expect(kept(sanitizeForPlayerCharacter(with_("Have Sélodiem feel it"), "Élodie"))).toBe(true);
    expect(kept(sanitizeForPlayerCharacter(with_("Have Asaki feel it"), "Åsa"))).toBe(true);
  });

  test("ASCII names still work, including a name inside a longer sentence", () => {
    expect(kept(sanitizeForPlayerCharacter(with_("Then, quietly, Merlin realizes the lie."), "Merlin"))).toBe(false);
  });
});
