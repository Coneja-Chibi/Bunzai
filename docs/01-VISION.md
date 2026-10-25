# Vision

## Who it's for

Simple for simple folk, an absolute unit for power users. Concretely, four people:

1. **The first-timer** who found a broken card on a Discord and wants to fix it or make
   their own. They should succeed in under five minutes without reading anything.
2. **The botmaker** who publishes cards for a community and juggles four platforms'
   formats, token budgets, and slop-avoidance by hand today.
3. **The lore architect** with a 300-entry worldbook who needs trigger debugging,
   consistency checks, and version history that isn't "final_v3_REAL.json".
4. **The archivist** with years of RP logs containing characters that were never
   written down as cards.

## The five pillars

1. **Every format, losslessly.** Import anything, export anything, and a file that
   round-trips through us is byte-equivalent in meaning. Platform-specific fields ride
   in escrow rather than being dropped. We aim to be the reference implementation the
   other tools test against.
2. **The interview is the editor.** Creation happens by conversation with adaptive
   depth: quick-pick chips for momentum, freeform always available, the artifact
   assembling visibly as you answer. Modes and settings for every temperament.
3. **The Doctor is honest.** Deterministic checks (token waste, format errors,
   contradictions, slop banks) run free and offline. AI treatment is optional,
   staged, and approved fix-by-fix. The tool proves what it did in plain terms.
4. **Local first, yours only.** One database on your disk, encrypted at rest, exported
   to readable files whenever you ask. Keys in your OS keychain. No account, no server,
   no telemetry. The single .exe is the whole product.
5. **The agent has range.** Runs on frontier models beautifully and on a 7B local model
   acceptably. Persona system makes the agent's working style user-chosen
   (collaborator / terse / detail-hound / challenger / hype).

## What we are not

- Not only a studio. The Studio makes the content; the Stage plays it. Bunraku is the
  one place where the card you just finished can be played immediately, locally, with
  a visible prompt trace, and then exported anywhere. Hoplight remains the neutral
  studio without a stage; Bunraku is the same studio with the show attached.
- Not a card hosting site or community platform. Files are the social layer; people
  share them where they already gather.
- Not a RoleCall funnel. RC-branded lineage, but every platform is a first-class
  export target. The moment ST users smell favoritism, we lose them.

## The taste bar

The output bar is: a card produced by the Table Read, or treated by the Doctor, should
be visibly better-crafted than what a skilled human makes unaided in an hour. Specific
beats generic, playable beats poetic, every token earning its place. Anti-slop is a
core mechanic (banks, detectors, rewrite passes), not a marketing word.
