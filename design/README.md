# Design

Design studies for Bunzai. Nothing here ships; the app is `src/ui/`.

## Layout

```
design/
  wireframes/
    index.html     the gallery: open this first
    house.css      the wireframe house style, built only from the app's tokens
    rc-bridge.css  the in-between: RoleCall's theatrical structure on those same tokens
    theme.js       switches a page between the paper and stage themes
    encryption/    the lock screen, password, recovery words, Security settings, and notices
      in-between/  the same screens with RoleCall's feel (the current proposal)
```

Open `wireframes/index.html` in a browser. Every page works from the filesystem with no server.

## The rules

- **Wireframe first.** Every new screen, dialog, meter, prompt, or control is shown here as a
  wireframe and approved before any UI code is written.
- **Tokens only.** Every page links the app's real `src/ui/theme/tokens.css`. `house.css` uses
  only those tokens: no color, font, or spacing is written by hand, so a wireframe cannot drift
  from the app, and both themes can be checked with the switch on each page.
- **Existing components.** Each class in `house.css` copies the look of a real component and names
  it (Stamp, InkDialog, SettingsRow, SegControl, ToggleSwitch, the settings section cards, the
  notices). The build reuses those components from `docs/reference/components.md`; anything new is
  called out on the wireframe so it is a visible decision.
- **Copy is real copy.** Wireframe text is the proposed wording, with no emoji and no em dashes.

## Status

| Study | State |
|---|---|
| `wireframes/encryption/in-between/` | awaiting approval (the current proposal) |
| `wireframes/encryption/` | first draft, kept for comparison |
