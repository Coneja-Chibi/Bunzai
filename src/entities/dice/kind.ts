/** The dice kind: something a person rolls, as a roll, a table or a pool (core/dice-piece.ts rolls it). */
import { defineKind } from "../_shared/kind-descriptor";
import { emptyDiceBody, type DiceBody } from "./schema";

export default defineKind<"dice", DiceBody>({
  id: "dice", order: 76, singular: "Dice", plural: "Dice", short: "dice", receiptWord: "dice",
  blurb: "Rolls, tables and pools", icon: "lucide:dices", accent: "var(--deck-persona)", libraryDeck: true,
  blank: () => emptyDiceBody("My dice"), blankId: "dice",
  describe: (b) => [
    `name     ${b.name || "(unnamed)"}`,
    `type     ${b.type}`,
    `rolls    ${b.type === "roll" ? b.dice ?? "?" : b.type === "table" ? `${b.rows?.length ?? 0} rows` : b.pool ? `${b.pool.count}d${b.pool.sides}, ${b.pool.target}+` : "?"}`,
  ],
});
