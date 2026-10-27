---
id: reference/entities/dice
title: Dice entity
audience: dev
summary: The canonical piece for something a person rolls, made once and used anywhere. One kind with three types, a roll, a table or a pool, all rolled by the same dice math with randomness the caller hands in.
tags: [entity, dice, roll, table, pool, canonical]
related: [reference/entities/tool, reference/extending/new-kind, reference/entities/README]
---

# Dice entity

A `CanonicalDice` is `CanonicalEntity<"dice", DiceBody>`: a `name`, a `description`, a `type`, and the one field that
type rolls. Rolling itself is math and is not a piece: `src/core/dice.ts` reads dice notation and rolls it, and the
`{{roll}}` macro, the battle tracker and the spellbook use the same module. What each type of piece rolls is
`rollDicePiece` in `src/core/dice-piece.ts`, on randomness the caller hands in.

## Types

- **roll** carries `dice`, notation such as `2d6` or `1d20+3`, and totals it: "Stealth, 1d20+3: [14] +3 = 17".
- **table** carries `rows`, 1 to 200, each a `text` and a whole `weight` from 1 to 1,000. It rolls one die the size
  of all the weights and lands on the row that number falls in, so a row of weight 2 is twice as likely as one of
  weight 1: "Wild magic (rolled 2 of 3): Sparks".
- **pool** carries `pool`: a `count` of dice (1 to 100) of `sides` (2 to 1,000), and a `target`. Each die at or over
  the target is a success: "Shadow pool, 4d10, 8 or more: [8, 2, 10, 8] = 3 successes".

## Where dice are used

A tool links a dice piece by id (its `dice` action; [tool.md](tool.md)), so a model can roll it while it writes, and
the turn's seeded randomness decides the roll.

## The rules

A piece carries exactly the field its type rolls and no other. A roll's dice must be readable notation of 1 to 100
dice of 2 to 1,000 sides, and a pool's target may not be more than its sides. These are checked when the piece is
saved, so a stored piece always rolls.

## Editing

There is no editor yet: the dice editor waits for its approved wireframe. The Library's "New dice" saves a blank
roll of `1d20`.
