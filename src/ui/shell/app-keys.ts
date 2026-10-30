/**
 * Every chord that moves between apps, decided in one place.
 *
 * WHY A TABLE. The dock is the only way to change rooms right now, which means every app switch
 * costs a trip to the mouse. Shortcuts fix that and immediately create the problem the rail already
 * solved once: bindings added one at a time, in whichever handler was open, until nobody can answer
 * "does this chord already mean something". src/kit/render/rail/rail-key-map.ts is the shape that
 * worked - one list you can read, a pure resolver over it, and the on-screen hints GENERATED from
 * the same rows, so a printed chord cannot disagree with what the key does. This file copies it.
 *
 * WHY THE NUMBERS ARE NOT WRITTEN DOWN. Ctrl+1 is "the first tile on the dock", not "the Workbench".
 * The dock is built by reading folders (CONTRACT V2), so a hardcoded id list would be a second
 * roster to keep in sync and would go stale the first time an app folder is added or reordered. The
 * table holds SLOTS; `appRoster` fills them from the manifests the dock itself draws from.
 *
 * WHY THE TYPING GUARD IS THE FIRST THING THE RESOLVER DOES. Kit shipped this exact bug (29dad0d,
 * "THE RAIL ATE THE COMPOSER"): a global key handler guarded only on "is my surface open", then
 * called preventDefault on keys the focused text editor needed. Typing a prompt lost every space and
 * silently toggled blocks on a real preset. This shell is full of large text editors - a card body,
 * a lorebook entry, a regex script - and a chord that fires into one of them is the same defect
 * wearing a different hat. `isTypingTarget` (_shared/typing-target.ts) is tested on its own so the guard is a
 * thing with a name rather than an easily-deleted line inside an effect.
 */
import type { AppManifestEntry } from "../app-contract";
import { dockManifestGroups } from "./dock-core";
import { isTypingTarget } from "../_shared/typing-target";

/** What a chord asks the shell for. `next`/`prev` name a direction, not an app: only the shell knows
 * which room is on screen, and this table is not allowed to. */
export type AppShortcut =
  | { readonly kind: "app"; readonly id: string }
  | { readonly kind: "next" }
  | { readonly kind: "prev" };

/** The element the key went to, narrowed to the two facts that decide whether it is being typed
 * into. A DOM `HTMLElement` satisfies this, which is how the listener hands `event.target` straight
 * through without the map importing anything from the DOM. */
export interface KeyTarget {
  readonly tagName: string;
  readonly isContentEditable: boolean;
}

/** Just the parts of a keydown the map reads. */
export interface AppKeyEvent {
  /** the character the key typed ("," , "ArrowRight") */
  readonly key: string;
  /** the PHYSICAL key ("Digit1"), which is what the number row is counted by */
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly target: KeyTarget | null;
}

/** Which tile a row points at. Slots are positions on the dock, resolved against the live roster. */
type Does =
  | { readonly at: "numbered"; readonly slot: number }
  | { readonly at: "foot"; readonly slot: number }
  | { readonly at: "next" }
  | { readonly at: "prev" };

/** One row of the table: what to press, where it goes, and how to say so. */
export interface AppBinding {
  readonly does: Does;
  /** how the key is written on screen, WITHOUT the accelerator ("1", ",", "alt+right") */
  readonly label: string;
  /** what it does, in words somebody reads once */
  readonly says: string;
  /** the platform accelerator: ctrl on Windows and Linux, cmd on a Mac. Exactly one, never both. */
  readonly accel?: boolean;
  readonly shift?: boolean;
  /** shift may be held or not: AZERTY types its digits with shift */
  readonly anyShift?: boolean;
  readonly alt?: boolean;
  /** matched on the typed character */
  readonly key?: string;
  /** matched on the physical key instead, for the number row */
  readonly code?: string;
}

/** How many dock tiles get a number. Nine because there is no ctrl+10. */
export const NUMBERED_SLOTS = 9;

const ORDINALS = [
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth",
] as const;

/**
 * The table.
 *
 * THE NUMBER ROW IS MATCHED ON `code`, NOT `key`. On an AZERTY layout the digits are the SHIFTED
 * legends, so ctrl+1 arrives as `key: "1"` with shift held - and this map refuses held modifiers it
 * did not ask for, on purpose, so that ctrl+shift+1 stays free for whoever wants it later. Reading
 * the physical key means the chord is the same key under the same finger on every layout, which is
 * what "the first tile" is supposed to mean. Punctuation stays on `key`, where the character IS the
 * thing the user is aiming at.
 *
 * THE BARE DIGIT COMES FIRST. In a browser tab, ctrl+1..9 belongs to the browser (Chrome and Firefox
 * switch tabs and never hand the page the key), so the number printed on a tile only worked in the
 * desktop app. The digit alone opens it everywhere; the typing guard below keeps it out of every
 * field, and a key something else already handled (`defaultPrevented`, e.g. the agent's ask panel
 * picking an option) never reaches here. ctrl+digit stays for the desktop app. The bare row is first,
 * so the tile's hint reads the key that works in both. Unlike the ctrl rows it matches the TYPED
 * digit with shift allowed: the printed "1" is what is aimed at, on AZERTY (shift) and the numpad too.
 *
 * SETTINGS IS THE FOOT, NOT A NUMBER. It sits in the dock's foot rather than the numbered body
 * (`dockFoot` in its manifest), and ctrl+comma is what "preferences" has meant for a decade.
 */
export const APP_KEYS: readonly AppBinding[] = [
  ...Array.from({ length: NUMBERED_SLOTS }, (_, i): AppBinding => ({
    does: { at: "numbered", slot: i },
    key: String(i + 1),
    anyShift: true,
    label: String(i + 1),
    says: `the ${ORDINALS[i]} app on the dock`,
  })),
  ...Array.from({ length: NUMBERED_SLOTS }, (_, i): AppBinding => ({
    does: { at: "numbered", slot: i },
    code: `Digit${i + 1}`,
    accel: true,
    label: String(i + 1),
    says: `the ${ORDINALS[i]} app on the dock`,
  })),
  { does: { at: "foot", slot: 0 }, key: ",", accel: true, label: ",", says: "settings" },
  {
    does: { at: "next" },
    key: "ArrowRight",
    accel: true,
    alt: true,
    label: "alt+right",
    says: "the next app along the dock",
  },
  {
    does: { at: "prev" },
    key: "ArrowLeft",
    accel: true,
    alt: true,
    label: "alt+left",
    says: "the app before this one",
  },
];

/** The dock's tiles as bare ids, in the order they are drawn - what the numbers count. */
export interface AppRoster {
  /** the numbered body of the dock: mountable, not the foot, not catalog-only */
  readonly numbered: readonly string[];
  /** the dock's foot (Settings) */
  readonly foot: readonly string[];
}

/**
 * Build the roster from the manifest list.
 *
 * The shared dock roster owns sorting and availability. Catalog-only tools receive slots too;
 * coming-soon apps never consume a shortcut that cannot navigate.
 */
export function appRoster(manifests: readonly AppManifestEntry[]): AppRoster {
  const groups = dockManifestGroups([...manifests]);
  return {
    numbered: groups.present.map((app) => app.id).slice(0, NUMBERED_SLOTS),
    foot: groups.foot.filter((app) => !app.comingSoon).map((app) => app.id),
  };
}

const wants = (binding: AppBinding, event: AppKeyEvent): boolean => {
  // Exactly one accelerator. Ctrl and Cmd are the same finger on different machines; holding BOTH
  // is a third chord and belongs to nobody.
  if (binding.accel === true ? event.ctrlKey === event.metaKey : event.ctrlKey || event.metaKey) return false;
  // Absent means "must NOT be held", the rail's rule: a binding that ignored modifiers would
  // swallow the chorded versions of its own key.
  if (binding.anyShift !== true && (binding.shift === true) !== event.shiftKey) return false;
  if ((binding.alt === true) !== event.altKey) return false;
  if (binding.code !== undefined) return binding.code === event.code;
  return binding.key !== undefined && binding.key.toLowerCase() === event.key.toLowerCase();
};

/** What this key means, or null to let it through. */
export function appShortcut(event: AppKeyEvent, roster: AppRoster): AppShortcut | null {
  if (isTypingTarget(event.target)) return null;
  const found = APP_KEYS.find((binding) => wants(binding, event));
  if (!found) return null;
  const does = found.does;
  if (does.at === "next" || does.at === "prev") return { kind: does.at };
  const list = does.at === "numbered" ? roster.numbered : roster.foot;
  const id = list[does.slot];
  // A slot past the end of a short dock is not an error and not a fallback: it is nothing, and
  // saying so lets the caller leave the keystroke alone instead of preventing a default it did
  // not replace.
  return id === undefined ? null : { kind: "app", id };
}

/**
 * The app one step along the numbered list, wrapping at both ends.
 *
 * AN APP THAT IS NOT ON THE LIST STARTS THE WALK AT THE TOP. Catalog-only rooms (Docs, the CSS
 * Workshop, the Apps catalog itself) are mountable but have no tile, so "the one after this" has no
 * answer for them. Landing on the first tile is a place the user can see themselves arrive at;
 * guessing an index would jump somewhere unrelated for reasons nothing on screen explains.
 */
export function stepApp(
  numbered: readonly string[],
  current: string,
  delta: 1 | -1,
): string | null {
  if (numbered.length === 0) return null;
  const at = numbered.indexOf(current);
  if (at < 0) return numbered[0] ?? null;
  return numbered[(at + delta + numbered.length) % numbered.length] ?? null;
}

/** How a chord is written on screen. `mac` swaps the accelerator's name, nothing else. */
export const chordLabel = (binding: AppBinding, mac: boolean): string =>
  `${binding.accel === true ? (mac ? "cmd+" : "ctrl+") : ""}${binding.label}`;

/**
 * The row that opens this app, or null when no chord does.
 *
 * THE DOCK ASKS THE TABLE. This is the whole reason the slots are data: a tile's hint comes from the
 * row that would actually fire, so the printed chord and the working chord cannot drift apart the
 * way a hand-listed help panel always eventually does. The dock needs the row rather than just its
 * label because it prints two lengths of the same fact - the full chord in the tooltip, the bare key
 * on the tile, where there is only room for one glyph.
 */
export function appBinding(appId: string, roster: AppRoster): AppBinding | null {
  const found = APP_KEYS.find((binding) => {
    const does = binding.does;
    if (does.at === "numbered") return roster.numbered[does.slot] === appId;
    if (does.at === "foot") return roster.foot[does.slot] === appId;
    return false;
  });
  return found ?? null;
}

/** The chord that opens this app, written out, or null when it has none. */
export function chordFor(appId: string, roster: AppRoster, mac: boolean): string | null {
  const found = appBinding(appId, roster);
  return found ? chordLabel(found, mac) : null;
}

/** True where the accelerator is called cmd. Takes the string so the map stays free of globals. */
export const isMacLike = (userAgent: string): boolean => /mac/i.test(userAgent);
