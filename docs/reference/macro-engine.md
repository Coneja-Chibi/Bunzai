# The macro engine

RoleCall's macro engine, ported under `src/core/macros/` inside the closed world
[ADR-012](../decisions/ADR-012-macro-evaluation-boundary.md) allows. It parses `{{macro::arg}}`
templates and evaluates them against a value-only context, producing expanded text **plus segments
that remember which authored characters produced them**. Codecs and adapters never call it; macro
text stays opaque payload at every import and conversion boundary.

## What it does

It behaves as RoleCall's engine does in its recorded version, and a test
proves it: `rc-parity.test.ts` runs all 179 entries of RoleCall's own characterization corpus,
recorded from RoleCall by `tools/rc-recorder`, and requires the same parse tree, text, errors,
variable changes, variables read, and expansions for each. RoleCall's processor tests and its handler
tests are ported too; each test file's header names any RoleCall case it leaves out, and why.

- **Syntax.** Normalization (`normalize.ts`) applies RoleCall's rewrites in RoleCall's order: escaped
  braces, `<user>`/`<char>`/`<bot>`, `{{.var}}` and `{{$var}}` shorthand, space forms, and
  single-colon forms (`{{setvar:x:5}}` becomes `{{setvar::x::5}}`). It does so **through an offset
  map**, so every parsed node traces back to the authored range it came from (`toSource`). The
  parser (`parse.ts`) is a span-carrying port of RoleCall's tokenizer. A macro's output that holds
  macros is normalized and evaluated again, one level down.
- **Macros.** Twenty-five of RoleCall's families (`handlers/`, a file each, a few split in two under
  the file-size cap), registered in
  RoleCall's order from one closed table (`catalog.ts`, `registry.ts`), because the order decides
  which family owns a name two of them claim. Lazy macros (`{{foreach}}`, `{{when_all}}`,
  `{{when_any}}`, `{{whenempty}}`, `{{ifset}}`, `{{switch}}`, `{{and}}`, `{{or}}`) receive
  their arguments unevaluated; the last three gained this in Bunraku only (bug fix 2026-09-30,
  worth porting back to RC, which still evaluates them eagerly).
  Phases (`{{phase::post_render::...}}`, `{{defer::...}}`) are
  orchestrated across a preset's prompts by `processPhasedBlocks`. RoleCall's game, mechanics,
  visual novel, and off-band families are not ported; their names are unknown macros here.
- **Bunraku's own macros.** One family of Bunraku's (`handlers/chat-watch.ts`), registered last so it never takes a
  RoleCall name, reads the run's messages and changes nothing: `{{mentions::word::N}}` counts a word or phrase in the
  last N messages (all without N), `{{lastmention::word}}` says how many messages ago it was last said (1 is the
  latest, empty when never), `{{tally::a,b,c::N}}` names the one mentioned most (the first listed on a tie, empty when
  none is), and `{{odds::30}}` is `true` that percent of the time from the run's seed. A word matches whole (accents
  included) and ignoring case, with word and text in one Unicode form (NFC); its pattern is built from the escaped word,
  never author regex, so it needs no `allowRegex`. The messages are indexed once per list, on first use, in one pass
  (every whole word with the message and the place in it of each occurrence), kept in a WeakMap so the index dies with the list. A
  single word is a read; a phrase, or a query with punctuation in it, starts from its rarest word's places and checks its other
  words and the text between them only there (so a phrase on a very common first word costs what its rarest word costs), and
  its answer is kept with the list. Matches do not overlap, as a global pattern's do not. Every loop that scales with the input
  (the build, the matching, a tally's words) checks the run's deadline. There is no limit on how many words a run looks up, on a word's
  length (the hostile-input text ceiling aside) or on how many words a tally takes.
- **The tracker macro.** `handlers/tracker.ts` reads the library trackers a scene links ([tracker.md](entities/tracker.md)) and
  changes nothing: `{{tracker::Name}}` is the tracker's text (its template run read-only, else the default rendering),
  `{{tracker::Name::field}}` a record's field, `{{tracker::Name::row::field}}` a list row's field. The turn hands the linked
  trackers to the context (`MacroContext.trackers`, by lowercased name); a tracker that is not linked, or an unknown field or
  row, is a macro error that names it.
- **Unknown macros** render as their reconstructed text plus an error entry, never silence and never
  a throw. RoleCall's prompt assembler strips whatever is left from the prompt; Bunraku's assembler
  is not ported yet.
- **Variables.** Local and global maps with RoleCall's scopes (`session:`, `char:`, `arc:`, `scene:`,
  `global:`); changes apply at once and are listed as side effects. `readOnly` turns writes into
  no-ops, for historical messages. In a scene the local map is the `vars` slot of the scene state
  ([scene-state.md](scene-state.md)): a turn starts it from the variables as the shown history left them (or, for a new
  version of a reply or a continue, as they were before that reply), and the changes its prompt made are kept as deltas on the
  version it stores, so a regenerate never counts a write twice. The global map is still one library document.

What differs from RoleCall because ADR-012 requires it: no handler reads the clock, randomness, or
the host's locale or time zone. Time is `context.now`, a plain epoch value the caller supplies, read
in `context.timezone` (UTC when absent); with no `now`, time macros render `""` rather than
inventing a moment. Numbers and dates format in `context.locale` ("en-US" when absent), except
`{{time}}`, which always uses en-US as RoleCall's does. Randomness is
one mulberry32 stream from `context.randomSeed`, handed to each handler, so the same seed replays
the same rolls. A zone-less date given to `{{timediff}}` is read in `context.timezone` too, where
RoleCall read it in the server's zone. The evaluator caps the length of any string a node, handler,
variable write, or whole run produces, caps the number of nodes one run evaluates (a caller may also hand in a `deadline`, a point in time and its own clock: the run checks it every 64 nodes and after every handler and
stops with an error, as the tool loop does for a formula; the word-watching macros also check it inside their loops. A `soft` deadline,
which a prompt build uses, is watched only by those handlers: the one that runs out of time fails with the error in the macro report, and
the rest of the prompt still builds, so a hostile card cannot empty it. The prompt build's budget is `PROMPT_BUDGET_MS_DEFAULT`, 3 seconds,
overridden by the setting `scenes.promptBudgetMs`, which Settings > You > Studio > Time budgets shows in seconds; a macro it stops is named under the reply, `Generation.outOfTime`), and nests at most 100 deep. When a cap trips, the run records one error and stops: no handler is called after it, a
lazy handler is unwound out of the argument that tripped before it can write, and no cut-off value
reaches a variable, template, or user macro. A test scans every source file in the package for
clock, randomness, I/O, and host-locale reads, and checks the scan against a list of those forms.

Author regex (`{{regex}}` and compare's `matches`) runs only when the caller sets
`context.allowRegex`, and no caller does yet: a pattern that backtracks badly hangs a browser's
regex engine, and ADR-012 keeps regex under ADR-009's isolation, which the engine does not have.
Until then the tag renders as written with an error. RoleCall always runs it.

What differs for other reasons: the four stripped families above; RoleCall's interceptor hooks and
parse cache, which nothing in a turn uses; `{{switch}}`/`{{and}}`/`{{or}}` being lazy (above).
RoleCall bugs found while porting are kept for now and listed, with each one's proposed fix, in
the spec's findings.

## Segments: the editable-preview contract

`processMacros(source, context)` returns, alongside the flat text, one segment per top-level
node. A literal segment's `value` **is** the authored slice `source[sourceStart, sourceEnd)`,
verbatim - escaped braces unrestored, newline runs uncollapsed - so splicing an edited value into
that range can never corrupt the source; the restored, whitespace-collapsed rendering lives in
the flat `text`, which is postprocessed once as a whole (segments are provenance, not a
partition of it). A macro segment carries its raw authored expression, its resolved value, and -
for `random`/`pick` and block-if - which option or branch fired, so a preview can offer
branch-level edits instead of guessing at a flat string. `src/core/preset/live-render.ts` layers
this over `buildPreview`'s engine-truth ordering, threading one variable context across blocks in
build order and tagging each line with its block id.

## Who may call it

Exactly the ADR-012 list: the macro test bench (user-invoked), the transfer compatibility report,
prompt assembly and its previews such as `live-render.ts`, and chat display (`src/core/chat-display.ts`). The external-engine renderer
under `src/core/preset/render/` remains the cross-check oracle: it answers "what does the real
platform say", this engine answers "what does this say, and where did each character come from".
