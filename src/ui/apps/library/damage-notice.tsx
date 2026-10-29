/**
 * Library-local notice for studio JSON files that failed closed during canonical decoding.
 */
import type { JSX } from "react";
import type { StudioDamagedEntry } from "../../app-contract";
import { damageHidden, damageSeenList, PREF_DAMAGE_SEEN } from "./damage-dismiss";
import { plural } from "../../../core/text";
import { Button } from "../../components/button";
import { VirtualRows } from "../../_shared/virtual-list";
import { Panel } from "../../components/panel";

const ENTRY_ROW_PX = 24;

/**
 * Why one file did not open, in words that say what to do about it.
 *
 * NO DEFAULT CASE, deliberately. The reason union is the studio's own, imported rather than copied,
 * so a reason nobody has written a sentence for stops the build. It used to be a private list of
 * four beside a union of five, and the missing one printed on screen as the word `undefined`.
 */
const reasonText = (reason: StudioDamagedEntry["reason"]): string => {
  switch (reason) {
    case "unreadable-json": return "is not readable JSON";
    case "part-unreadable": return "has a stored part that could not be opened";
    /**
     * Not "damaged". By the time this shows, every format Bunzai ships has been offered the file
     * and declined it - so the honest statement is that nothing here recognises it, which is a fact
     * about Bunzai rather than an accusation about somebody's preset.
     */
    case "schema-mismatch": return "is not in a format Bunzai recognises";
    case "kind-mismatch": return "holds a different kind of piece than this folder is for";
    case "id-mismatch": return "holds a different piece id than its filename";
    case "unusable-filename":
      return "has characters its name cannot keep - rename it without spaces or punctuation";
    case "id-unreadable": return "could not be opened at all - its own stored record looks damaged";
  }
};

export function DamageNotice(props: {
  entries: readonly StudioDamagedEntry[];
  studioDir?: string;
  /**
   * Preferences, so a dismissal outlives the reload that would otherwise undo it.
   *
   * OPTIONAL, and its absence means no dismiss button. The first-run doors render this notice on a
   * studio with nothing else in it, where the unreadable files may be the only thing to look at -
   * an away button there would leave somebody staring at a blank room wondering where their
   * presets went.
   */
  prefs?: { get(key: string): unknown; set(key: string, value: unknown): void };
}): JSX.Element | null {
  if (props.entries.length === 0) return null;
  const prefs = props.prefs;
  // Dismissed is per FILE, not per notice: a new unreadable piece brings this straight back. See
  // damage-dismiss.ts, which holds the whole rule.
  if (prefs && damageHidden(props.entries, prefs.get(PREF_DAMAGE_SEEN))) return null;
  const count = props.entries.length;
  return (
    <Panel className="damage-note" data-part="library.damage" role="region" aria-labelledby="damage-note-title">
      <strong id="damage-note-title">
        {`${plural(count, "file")} in your studio folder could not be read`}
      </strong>
      {prefs && (
        <Button size="sm" variant="quiet" title="Put this away. It comes back if another file stops loading."
          aria-label="Dismiss this notice"
          onClick={() => prefs.set(PREF_DAMAGE_SEEN, damageSeenList(props.entries))}>
          Dismiss
        </Button>
      )}
      <p>The files are still on disk and Bunzai did not change them.</p>
      <details>
        <summary>Show files and recovery details</summary>
        <VirtualRows pick={false} className="dn-list" rowClassName="dn-row" items={props.entries} keyOf={(entry) => `${entry.kind}:${entry.id}`} estimate={ENTRY_ROW_PX} render={(entry) => (
          <>
            <code>{`${entry.kind}/${entry.id}.json`}</code>
            {` ${reasonText(entry.reason)}.`}
          </>
        )} />
        {props.studioDir && <p><code>{props.studioDir}</code></p>}
        <p>Restore a file from backup, or remove it yourself to clear this notice.</p>
      </details>
    </Panel>
  );
}
