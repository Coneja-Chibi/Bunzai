# Encore theme example

Encore is Bunzai's teaching package for presentation themes, and it uses every power a theme has. It is
the game one: a bottom HUD bar and a pause-menu hub, visual-novel message boxes, corner-bracket frames,
segmented meters and dense spacing on deep navy with saturated jewel roles. On top of the picks it adds its
own stylesheet, a bundled pixel font, two PNG images and content in four slots. Bunzai still renders every
control and calls its existing handlers.

The full author guide is
[docs/reference/extending/make-a-theme.md](../../../../docs/reference/extending/make-a-theme.md). The names
a stylesheet can aim at are listed in [docs/generated/theme-parts.md](../../../../docs/generated/theme-parts.md).

## The package, piece by piece

| File | What it is | Scope shown at install |
| --- | --- | --- |
| `manifest.json` | the descriptor: picks, palette, type, shape, accent | palette, type, shape, surfaces and accent |
| `assets/ticket-bun.svg`, `assets/ticket-frame.svg` | inert SVG marks for the dock and the Library frame | `appearance.assets` |
| `assets/starfield.png` | a 96 px star tile, tiled behind the Library and Scenes | `appearance.assets` |
| `assets/crest.png` | a 48 px pixel crest, used in two slots | `appearance.assets` |
| `fonts/silkscreen-700.woff2` | Silkscreen Bold, an OFL pixel face, for headings only | `appearance.fonts` |
| `styles.css` | the one checked stylesheet | `appearance.styles` |
| `slots` in the manifest | four slots filled with an image and short text | `ui.slots` |
| `LICENSE.txt` | CC0 for the artwork and styles, the OFL for the font | none; shown before approval |

Nine scopes in all. The installer lists them in plain words with the package digest, and approval is bound
to that digest: change any file and Encore is inactive until it is approved again.

### 1. Picks (tier zero)

`appearance.surfaces` picks one host-built layout for each of the 27 surfaces, for example `shell.nav:
hud-bar` and `scene.message: vn-box`. These need no CSS and no extra permission beyond `appearance.surfaces`.

### 2. Styles

`styles.css` restyles seven things that no built-in variant touches. Each block is named in the file and
aims at a stable `data-part`:

1. a drifting starfield behind the Library and Scenes (`library.main`, `scenes.main`), moving only when the
   person allows motion;
2. an XP strip along the top of the status line (`shell.status`);
3. stepped pixel corners and a gold lock-on ring on Library cards (`library.card`);
4. pixel headings with a dotted rule under each Library section (`library.section.header`);
5. pixel-cornered save cards in Scenes (`scenes.card`);
6. a CRT scanline sheet over the scene stage (`scene.root`);
7. a blinking prompt glyph on the message box (`scene.composer`).

The file only uses `url(asset:<id>)` for package files, no `@import`, and never names the protected layer,
or the whole package is refused. Bunzai loads it last, so it can override the host's normal rules, and
adds a scope so that no rule can match the lock screen, the Kit Gate or the theme manager.

### 3. Fonts

The manifest lists the font under `fonts`, and `styles.css` declares it with `@font-face`. A listed font the
stylesheet never uses is refused. Silkscreen sets headings and slot labels only, so body text keeps its
readable face. Its license is in `LICENSE.txt`.

### 4. Images

`assets` lists the two PNGs next to the two SVG marks. `starfield.png` is used from CSS as
`url(asset:starfield)`; `crest.png` is placed by slots. Bunzai serves each file from its own digest URL.

### 5. Slots

| Slot | Items |
| --- | --- |
| `library.header` | the crest and the text "Player one ready" in class `mod-banner` |
| `scenes.header` | the text "Stage select" in class `mod-tip` |
| `scene.backdrop` | the crest, faded to a watermark by the stylesheet |
| `shell.status.end` | the text "Encore" in class `mod-tip` |

Text is always drawn as text, and a class works only because `styles.css` defines it.

## Try it

Settings, Appearance, Encore: inspect it, read the nine scopes and the digest, then approve. Revoke returns
to the core appearance and removes the styles and slots at once.

## Changing the example

Edit a value, a rule or a slot, then inspect the package again. Every change alters the digest and needs
fresh approval, and `requests` must equal the scopes the manifest derives. Do not add script or HTML files.

## License

The artwork (`assets/`) and `styles.css` are original and dedicated to the public domain under CC0-1.0.
`fonts/silkscreen-700.woff2` is Silkscreen Bold, copyright the Silkscreen Project Authors, under the SIL Open
Font License 1.1. Both texts are in `LICENSE.txt`.
