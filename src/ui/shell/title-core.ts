/**
 * title-core - the pure boot decision for the attract title screen (Scenes P4): whether a fresh
 * launch should open on the attract screen before anything else, or boot should go straight to
 * wherever it already would. Kept pure and separate from App.tsx so every "must not show" case in
 * the plan is a table this file owns, not a live boot nobody can unit test.
 */

export interface TitleGateInput {
  /** this tab already had an active app remembered in session storage: a reload, not a fresh launch */
  reload: boolean;
  /** the URL asked for a specific app (parseLaunchTarget resolved to a real, mountable manifest entry) */
  requested: boolean;
  /** boot just followed the first-run setup wizard, which already greeted the user */
  freshFromSetup: boolean;
  /** a saved workspace bench was restored and names the app it wants mounted */
  restoredApp: boolean;
  /** automation is driving the browser (a test runner, a headless smoke) */
  webdriver: boolean;
}

/** Shows once per real launch: the first boot of a tab, past every case above. */
export function shouldShowTitle(input: TitleGateInput): boolean {
  return (
    !input.reload &&
    !input.requested &&
    !input.freshFromSetup &&
    !input.restoredApp &&
    !input.webdriver
  );
}

/**
 * Live-check-only escape hatch: a URL query flag that forces the title on even when
 * `navigator.webdriver` is true. App.tsx applies it BEFORE calling shouldShowTitle above, never
 * inside it, so the real rule (automation never sees the title) stays intact and this reads as a
 * visible boot-time exception rather than a weakened default.
 */
export const FORCE_TITLE_QUERY_PARAM = "forceTitle";
