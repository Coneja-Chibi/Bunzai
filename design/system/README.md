# Bunraku design system

The look of Bunraku as a set of tokens, a small set of HUD primitives, and a named-parts contract
that UI mods target. G3 "Arcade HUD" is the default look. C1 (JRPG + HUD) and C3 (Persona + HUD)
ship as example themes on the same names. Paper is G3 in daylight.

This is design work. Nothing here ships yet; the app's live tokens are still
`src/ui/theme/tokens.css` (see "Moving the app over" below). Open `foundations.html` in a browser.
Every page works from the filesystem with no server.

## Principles

1. **An app, not art.** Every surface stays a usable app: clear hierarchy, aligned grids, readable
   type, an obvious primary action. Nothing is tilted, glitched, jittered or shaken. "Game feel"
   comes from frames, readouts, meters, key prompts and slot tags, never from chaos.
2. **Square, flat, crisp.** Corners are square (`--bk-radius: 0`). The only round things are status
   dots and the ticket-bun logo. No glows, no blur shadows, no glass, no gradients as decoration
   and no fade-to-dark gradients: card art placeholders are a solid tint with `--bk-art-hatch`.
   No cursive and no italic display type.
   **Crisp, never hazy:** Deep clean floors, near-white primary text (7:1 on every surface),
   bright 2px edges, saturated accents, and a selected item that is unmistakable (G3: a solid tint
   slab with dark ink and bold text, not a thin outline).
3. **Dark by default, paper kept and good.** G3 is a deep, clean plum-black with no gray haze. Paper is a real theme:
   firm plum frames on blush, every color used as text dropped to its deep twin.
4. **Every feature stays where it is.** A restyle reskins the working surface. Nothing moves behind
   a mode, a toggle or a new screen. Character cards are portrait (2:3).
5. **Numbers are HUD.** Anything countable reads in IBM Plex Mono: counts, budgets, slot and level
   tags, timestamps, key caps. Anything that moves toward a target is a segmented meter with a label
   and a value.
6. **Legible first.** Primary text 7:1 and every other text role 4.5:1 on every surface, control boundaries and focus 3:1, a 12px
   type floor, 24px hit targets, and never color as the only signal.
7. **Motion means something.** It says a thing changed or a thing is waiting. At most a 2px lift,
   opacity, or a sheet sliding into place. Reduced motion turns all of it off.
8. **No emojis and no em dashes** anywhere: copy, labels, comments, file names.

## Folder map

```
design/system/
  README.md          this file: principles, naming, the parts contract, theming, builder rules
  the four builders' assignments and the taste page spec
  system.css         the ONE stylesheet a page links (imports everything below, in layers)
  tokens/
    fonts.css        the four faces, from src/ui/theme/fonts (offline, OFL)
    color.css        surfaces, lines, text, accent, action, status, console, decks, tints, data-viz
    type.css         families, scale, weights, line heights, tracking, case, role composites
    space.css        the 4px grid and layout jobs
    size.css         hit targets, controls, icons, avatars, cards, shell geometry, HUD ornament
    frame.css        the HUD chrome language and the selection grammar
    layer.css        z-index scale and flat elevation
    motion.css       durations, easings, lift and press distances
    focus.css        focus ring and the accessibility targets
    access.css       reduced motion, more contrast, forced colors (always wins over themes)
    protected.css    the host-only tokens for protected surfaces
  themes/
    g3.css           the default (its values ARE tokens/; this file names it)
    c1.css           JRPG Menu + Arcade HUD
    c3.css           Persona + Arcade HUD
    paper.css        G3 in daylight
  parts.css          the HUD primitives every component builds on
  foundations.html   every token drawn live, with contrast measured per theme
  page.css, page.js  spec-page chrome: theme and width switch, taste picks
```

Builders add `components/` and `screens/`. The lead adds `taste.html`.

## How a page uses it

```html
<html lang="en" data-theme="g3">
<link rel="stylesheet" href="system.css">
```

`data-theme` takes `g3`, `c1`, `c3` or `paper`. With no attribute the page is G3.

Cascade layers decide who wins, regardless of selector weight. Order:
`@layer bk.access, bk.protected, bk.tokens, bk.theme, bk.parts, mod;`

| Layer | Holds | How it wins |
| --- | --- | --- |
| `bk.access` | reduced motion, more contrast, forced colors | every declaration `!important`; for important declarations the earliest layer wins, so no theme or mod can undo the person's settings |
| `bk.protected` | protected-surface tokens | same: `!important` in the second layer, unbeatable from later layers or unlayered CSS |
| `bk.tokens` | G3 base values | everything starts here |
| `bk.theme` | c1, c3, paper | later layer, overrides the base |
| `bk.parts` | the primitives | built on resolved tokens |
| `mod` | a UI mod's CSS | the host imports mod CSS into this layer only; it can restyle parts but cannot beat the two guarded layers |

## Naming rules

### Tokens

- Every token starts with `--bk-`. One name, one meaning. (The old `--stamp-x` meant "no offset" in
  G3, "tick size" in C1 and "shadow offset" in C3. A contract cannot do that; it is split into
  `--bk-frame-shadow-x`, `--bk-bracket-len` and friends.)
- Shape: `--bk-<group>-<role>[-<variant>]`, lowercase, hyphens. Groups: `surface`, `line`, `text`,
  `accent`, `action`, `ok`/`warn`/`danger`/`info`, `code`, `deck`, `host`, `tint`, `viz`, `wash`,
  `font`, `fs`, `fw`, `lh`, `track`, `case`, `type`, `space`, `pad`, `gap`, `hit`, `control`, `icon`,
  `avatar`, `card`, `dock`, `rail`, `side`, `hud`, `status`, `dialog`, `meter`, `pip`, `dot`,
  `frame`, `crown`, `bracket`, `head`, `divider`, `select`, `cursor`, `z`, `elev`, `dur`, `ease`,
  `pulse`, `lift`, `press`, `focus`, `protected`.
- Names describe the job, never the value: `--bk-text-dim`, not `--bk-grey-400`.
- A part reads roles, never hex and never a deck token directly. Per-item color always comes
  through the tint trio.
- Helpers private to one rule start with `--_` and are not part of the contract.

### The tint trio

Every colored thing (a deck, an app, a status) is drawn through three properties set on the
element or an ancestor:

| Property | Use it for |
| --- | --- |
| `--bk-tint` | fills: card art, slabs, chips that carry `--bk-text-on-tint` |
| `--bk-tint-text` | text and every mark that must be seen: meter fills, pips, rings, brackets, crowns |
| `--bk-tint-deep` | fills that carry `--bk-text-on-deep` (white) |

Set all three with one attribute: `data-deck="character|lorebook|persona|pack|preset|regex|fog|accent"`,
`data-app="scenes|workbench|library|press|agent|kit|settings"`, or `data-tone="ok|warn|danger|info"`
(tones set the first two only). A scene's own signature color sets all three inline; the app mints
them with `accentVars()` in `src/ui/_shared/decks.ts`.

### Primitive classes

`bk-` classes are the building blocks in `parts.css`: `.bk-frame`, `.bk-panel` (`__head`, `__body`,
`__foot`), `.bk-readout` (`__value`, `__label`), `.bk-tag`, `.bk-divider`, `.bk-label`, `.bk-bullet`,
`.bk-dot`, `.bk-meter` (`__label`, `__track`, `__fill`, `__value`, `__row`), `.bk-pips`, `.bk-item`,
`.bk-cursor`, `.bk-stage`, `.bk-chrome`, and type roles `.bk-title`, `.bk-heading`, `.bk-name`,
`.bk-meta`, `.bk-num`.

- **Variants** are data attributes: `data-crown`, `data-mark`, `data-lift`, `data-stacked`,
  `data-continuous`, `data-size="lg"`.
- **States** are ARIA first: `aria-selected`, `aria-current`, `aria-pressed`, `aria-expanded`,
  `aria-disabled`, `aria-invalid`, `aria-busy`. Use `data-selected` only when no ARIA state fits.
- **Pseudo-elements:** primitives own `::after`. `::before` is free for components. Never put a
  component's own decoration on `::after` of an element that is also a primitive.

## The named-parts contract (v1)

A mod restyles Bunraku by targeting **parts**, never class names. Classes are implementation and
can change in any release; part names are a public, versioned API.

- Every meaningful element carries `data-part`, a space-separated list of names, so a library card
  title can be both `ui.card.title` and `library.card.title`. Mods select with `~=`:
  `[data-part~="library.card.title"] { ... }`.
- Grammar: `<area>.<component>[.<element>]`, lowercase, hyphens inside a segment, at most three
  segments. Areas name a screen or `ui` for shared components.
- State is read from ARIA and the tint attributes on the same element, so a mod writes
  `[data-part~="scenes.card"][aria-selected="true"]`.
- **Slots** are named empty places a mod may fill: `data-slot="<area>.<place>"` (for example
  `shell.hud.end`, `library.card.badges`). Slots render nothing by default.
- **Protected parts** (`protected.*`) are drawn by the host in a shadow root that receives tokens
  and `tokens/protected.css` only, inside a `.bk-protected-root` wrapper (`:root` does not match
  in a shadow root, and document CSS cannot select the wrapper). They read only `--bk-protected-*`
  tokens. No theme or mod reaches them: the lock screen, the Kit Gate (approve, deny, talk it
  through), secret fields, recovery words, the mod manager, safe mode.

### Versioning

The contract is `v1` (`contract: 1` in the taste export). Adding a token, part or slot is a minor
change. Renaming or removing one is a major change: the old name stays as an alias for one major
version and is listed in this file under "Deprecated". Changing what a name means is a rename.

### Registry: shared components (`ui.*`)

| Part | Element parts |
| --- | --- |
| `ui.button` | `.label`, `.icon`, `.key` |
| `ui.icon-button` | `.icon` |
| `ui.key-chip` | `.key`, `.label` |
| `ui.field` | `.label`, `.control`, `.hint`, `.error` |
| `ui.select` | `.control`, `.chevron` |
| `ui.search` | `.icon`, `.control`, `.clear` |
| `ui.switch` | `.track`, `.knob`, `.label` |
| `ui.check` | `.box`, `.label` |
| `ui.segments` | `.item` |
| `ui.tabs` | `.tab`, `.count` |
| `ui.slider` | `.track`, `.fill`, `.thumb`, `.value` |
| `ui.chip` | `.label`, `.remove` |
| `ui.tag` | `.value` |
| `ui.swatches` | `.swatch` |
| `ui.tooltip` | `.body` |
| `ui.menu` | `.item`, `.section`, `.divider`, `.key` |
| `ui.frame` | (the `.bk-frame` primitive) |
| `ui.panel` | `.head`, `.body`, `.foot` |
| `ui.readout` | `.value`, `.label` |
| `ui.meter` | `.label`, `.track`, `.fill`, `.value` |
| `ui.pips` | `.pip` |
| `ui.badge` | `.dot`, `.label` |
| `ui.card` | `.art`, `.crown`, `.tag`, `.badge`, `.title`, `.subtitle`, `.meta`, `.marker`, `.actions` |
| `ui.dialog` | `.title`, `.body`, `.actions` |
| `ui.sheet` | `.grab`, `.title`, `.body`, `.foot` |
| `ui.toast` | `.body`, `.action` |
| `ui.notice` | `.title`, `.body`, `.actions` |
| `ui.empty` | `.title`, `.body`, `.actions` |
| `ui.progress` | `.step`, `.bar` |
| `ui.error-card` | `.title`, `.body`, `.actions` |

### Registry: screens

| Area | Parts |
| --- | --- |
| `title` | `title.screen`, `title.mark`, `title.wordmark`, `title.tagline`, `title.prompt`, `title.menu`, `title.menu.item`, `title.preview`, `title.legend` |
| `shell` | `shell.app`, `shell.hud`, `shell.hud.brand`, `shell.hud.score`, `shell.hud.meter`, `shell.hud.keys`, `shell.dock`, `shell.dock.brand`, `shell.dock.app`, `shell.dock.icon`, `shell.dock.add`, `shell.dock.fold`, `shell.tabs`, `shell.tabs.tab`, `shell.stage`, `shell.status`, `shell.status.item`, `shell.drop-veil`, `shell.boot-error`, `shell.follow`, `shell.close-piece` |
| `gate` | `gate.door`, `gate.load-in`, `gate.all-aboard`, `gate.failed` (the unlock form inside is `protected.unlock`) |
| `setup` | `setup.wizard`, `setup.question`, `setup.option`, `setup.progress`, `setup.stage`, `setup.recap` |
| `library` | `library.room`, `library.rail`, `library.rail.deck`, `library.rail.collection`, `library.rail.add`, `library.rail.trash`, `library.top`, `library.search`, `library.dial`, `library.section`, `library.section.head`, `library.section.views`, `library.card`, `library.card.art`, `library.card.title`, `library.card.tagline`, `library.card.chip`, `library.card.facts`, `library.card.switch`, `library.card.menu`, `library.card.start`, `library.new-tile`, `library.send-bar`, `library.damage`, `library.doors` |
| `import` | `import.veil`, `import.reading`, `import.receipt`, `import.receipt.line`, `import.choose`, `import.duplicates`, `import.options`, `import.result` |
| `trash` | `trash.panel`, `trash.filter`, `trash.row`, `trash.row.time`, `trash.row.restore`, `trash.empty` |
| `press` | `press.room`, `press.rail`, `press.queue`, `press.card`, `press.card.readiness`, `press.rider`, `press.target`, `press.result` |
| `scenes` | `scenes.rail`, `scenes.rail.tile`, `scenes.side`, `scenes.favorites`, `scenes.recent`, `scenes.recent.row`, `scenes.folders`, `scenes.folder`, `scenes.plaque`, `scenes.filters`, `scenes.hero`, `scenes.preview`, `scenes.grid`, `scenes.card`, `scenes.card.takes`, `scenes.cut-list` |
| `scene` | `scene.header`, `scene.take-pill`, `scene.messages`, `scene.message`, `scene.message.name`, `scene.message.body`, `scene.message.tools`, `scene.cut-line`, `scene.composer`, `scene.composer.send`, `scene.starting`, `scene.reply-counter`, `scene.fail`, `scene.update-badge`, `scene.wings`, `scene.wing`, `scene.wing.tab` |
| `workbench` | `workbench.room`, `workbench.tabs`, `workbench.pane`, `workbench.split`, `workbench.recents`, `workbench.recents.item`, `workbench.empty` |
| `editor` | `editor.header`, `editor.mode`, `editor.save`, `editor.card`, `editor.card.head`, `editor.toc`, `editor.toc.item`, `editor.rail`, `editor.lens`, `editor.conflict` (each editor also prefixes its own: `character.*`, `preset.*`, `lorebook.*`, `regex.*`, `persona.*`, `quickreply.*`, `pack.*`, `htmldoc.*`) |
| `settings` | `settings.room`, `settings.nav`, `settings.nav.item`, `settings.section`, `settings.row`, `settings.row.label`, `settings.row.control` |
| `agent` | `agent.window`, `agent.screen-brief`, `agent.transcript`, `agent.message`, `agent.composer`, `agent.slash`, `agent.queue`, `agent.trace` (the write card is `protected.gate`) |
| `catalog` | `catalog.room`, `catalog.card` (and `docs.*`, `macrolab.*`, `css-workshop.*`, `htmlview.*` for the catalog-only tools) |
| `protected` | `protected.unlock`, `protected.gate`, `protected.secret`, `protected.words`, `protected.mods`, `protected.safe-mode` |

Slots in v1: `shell.hud.start`, `shell.hud.end`, `shell.dock.end`, `shell.status.end`,
`library.card.badges`, `scenes.card.badges`, `scene.header.end`, `scene.composer.tools`,
`settings.section.end`. A builder who needs a part or slot that is not listed adds it following the
grammar and lists it in the page's "Parts" note; the lead merges it here.

## How themes override

A theme is one file of token overrides on `:root[data-theme="<id>"]`. Nothing else: no selectors,
no parts, no `!important`. `c1.css` and `c3.css` are the examples to copy.

- Every structural difference between the three looks is a token, and 0 turns a feature off:
  frame width, double-line gap and inner line, hard offset shadow, crown, bracket length, weight
  and the diagonal pair, whether brackets show at rest, head-bar fill and rule, divider weight,
  control frame and shadow, selection ring, fill and ink, the cursor triangle, title and action
  case, the move easing, lift and press distances, and a flat stage backdrop.
- Set `color-scheme` (dark or light) so native scrollbars and pickers follow.
- Re-check contrast: open `foundations.html?theme=<id>`; the check table measures 138 pairs live and
  must say 0 failing.
- A theme cannot touch `bk.access` or `bk.protected`: a person's reduced-motion setting and the
  protected surfaces always win.
- A full UI mod may go further than a theme (add, hide or rearrange parts, fill slots) with CSS in
  the `mod` layer targeting part names, and behavior only through the sandboxed extension system.
  That is a separate design; the token theme is the
  floor every mod starts from.

## What builders must follow

1. Link `../system.css` and `../page.css`, and load `../page.js`. Link nothing else for styling
   except your own area CSS file. Never link `src/ui/theme/tokens.css` or the wireframe token files.
2. Tokens only. No hex, rgb, named color, font family, or literal font size in your CSS. Spacing and
   sizes come from tokens; a literal px is allowed only for 1px hairlines and glyph geometry.
3. Build on the primitives. A framed thing is `.bk-frame`, a meter is `.bk-meter`, a chosen row is
   `.bk-item`. Do not redraw them.
4. Put `data-part` on every meaningful element, using the registry. Put ARIA states on everything
   stateful. Put `data-deck`, `data-app` or `data-tone` where color means something.
5. Every item works in all four themes. Check `?theme=g3`, `c1`, `c3`, `paper` before you call it
   done; paper is not optional.
6. Collapse with `@container`, never `@media` on the window. Screen mocks live in `.spec-screen` and
   must work at desktop, narrow and phone (`?width=`).
7. 12px floor (`--bk-fs-xs`), 24px hit targets (`--bk-hit-min`), never color alone.
8. Real copy, real names from the approved soft wireframes, sentence case unless the theme's case
   token says otherwise. No emojis, no em dashes, no "lorem ipsum".
9. Portrait cards are 2:3. Square corners. No italic display type.
10. Do not invent features. If a variant needs something the app does not have, label it
    **New: needs approval** on the page.

## Moving the app over

When approved, `src/ui/theme/tokens.css` is replaced by these files and every `var(--old)` is
rewritten. `data-theme="stage"` becomes `g3`; `paper` stays `paper`. The deck `-deep` values here
already match `deepAccent()` in `src/ui/_shared/color-math.ts`, whose unit test pins them; the G3
`--bk-accent-deep` is `deepAccent(#ff5fa0)`.

| Old (tokens.css) | New |
| --- | --- |
| `--rose`, `--accent` | `--bk-accent` (G3 value `#ff5fa0`) |
| `--rose-deep`, `--accent-deep` | `--bk-accent-deep` |
| `--font-fancy` | `--bk-font-display` |
| `--font-big` | `--bk-font-name` |
| `--font-body`, `--font-mono` | `--bk-font-body`, `--bk-font-mono` |
| `--soft-axes` | `--bk-font-axes` (G3: SOFT 0, WONK 0) |
| `--text-body` | `--bk-fs-md` (16px, no longer fluid) |
| `--text-meta` (0.7rem, under the floor) | `--bk-fs-xs` (12px) |
| `--text-title` | `--bk-fs-title` |
| `--gap-s`, `--gap-m`, `--gap-l` | `--bk-space-2`, `--bk-space-4`, `--bk-space-8` (1.75rem rounds to the grid) |
| `--ink-border` | `--bk-frame-w` + `--bk-frame-color` |
| `--stamp-x`, `--stamp-y` | split by meaning: `--bk-frame-shadow-x/-y`, `--bk-bracket-len`, or nothing (G3) |
| `--stamp-shadow`, `--shadow-ink`, `--stage-black` | `--bk-shadow` |
| `--shadow-ink-deep`, `--scrim` | `--bk-scrim` |
| `--canvas`, `--paper`, `--stage-floor` | `--bk-surface-base` |
| `--chrome`, `--stage`, `--stage-well`, `--q-stage` | `--bk-surface-well` |
| `--paper-2`, `--stage-2`, `--shell-panel`, `--stage-deck`, `--stage-sunken`, `--q-stage-deck` | `--bk-surface-sunken` |
| `--stage-row` | `--bk-surface-field` |
| `--panel`, `--face`, `--stage-panel` | `--bk-surface-panel` |
| `--shell-panel-2` | `--bk-surface-raised` |
| `--status-bg` | `--bk-surface-ink` |
| `--edge` | `--bk-line-strong` |
| `--seam`, `--ghost`, `--stage-seam`, `--stage-faint` | `--bk-line` |
| `--stage-line` | `--bk-line-track` |
| `--ink`, `--text`, `--stage-card`, `--stage-paper` | `--bk-text` |
| `--text-soft`, `--stage-soft`, `--status-fg` | `--bk-text-soft` |
| `--text-dim`, `--stage-text-dim`, `--stage-kicker`, `--status-dim` | `--bk-text-dim` |
| `--muted`, `--stage-mute` | `--bk-text-faint` |
| `--text-faint`, `--stage-dim` (both under 4.5:1) | `--bk-text-disabled` (disabled only) |
| `--stage-ink` | `--bk-text-on-tint` as text, `--bk-surface-ink` as a plate |
| `--stage-white` | `--bk-text-on-deep` |
| `--link` | `--bk-text-link` |
| `--stamp-bg`, `--stamp-fg` | `--bk-action-bg`, `--bk-action-text` |
| `--stage-ok`, `--stage-ok-bg` | `--bk-ok`, `--bk-ok-bg` |
| `--stage-warn`, `--stage-warn-ink` | `--bk-warn`, `--bk-warn-bg` |
| `--stage-danger-text`, `-bg`, `-edge`, `-hot` | `--bk-danger`, `--bk-danger-bg`, `--bk-danger-line`, `--bk-danger-strong` |
| `--stage-danger-deep` | dropped: use `--bk-danger-bg` |
| `--stage-macro`, `--stage-var` | `--bk-code-macro`, `--bk-code-var` |
| `--stage-link` | `--bk-info` |
| `--stage-rose-well` | dropped: use `--bk-surface-raised` or a tint wash |
| `--tooth` | dropped: the HUD has no paper grain |
| `--prop-hare`, `--host-*` | `--bk-prop-hare`, `--bk-host-*` (fixed marks) |
| `--deck-<kind>`, `--deck-<kind>-deep` | `--bk-deck-<kind>`, `--bk-deck-<kind>-deep`, plus new `--bk-deck-<kind>-text` |
| `.stamp`, `.seam` | `.bk-frame[data-lift]`, `.bk-stage` |

Known gap: IBM Plex Mono ships at weight 500 only, so G3's bold numerals are synthesized. Adding the
OFL 700 file to `src/ui/theme/fonts/` would make them crisp; nothing here depends on it.

## Deprecated

Nothing yet (v1).
