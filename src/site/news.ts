/**
 * What's new, in plain words: turn a release's commit subjects (the fenced block release.yml writes)
 * into the lines a visitor reads. Pure; the browser client fetches the releases and draws them.
 */
import type { Commit, ReleaseInfo } from "../ui/_shared/version-history";

const HIDDEN = /^(release|chore|ci|test|docs|style|build)(\(|:|!)|^Merge /i;

/** "fix(kit): reads sized for real presets" -> "Reads sized for real presets". */
export function plainSubject(subject: string): string {
  const text = subject.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The changes worth showing a visitor: no release bumps, merges, chores, tests, or docs-only commits. */
export const visibleChanges = (commits: readonly Commit[]): string[] =>
  commits.filter((c) => !HIDDEN.test(c.subject)).map((c) => plainSubject(c.subject));

/** The one-line headline for a release, falling back to the version itself. */
export function newsHeadline(release: ReleaseInfo): string {
  return visibleChanges(release.commits)[0] ?? (release.headline ? plainSubject(release.headline) : release.version);
}
