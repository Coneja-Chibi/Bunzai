/**
 * What the Library's shelves draw, and in what order. Pure: no DOM, unit-tested directly.
 *
 * THE DRAWN ORDER IS ONE LIST. Shift-range selection, Select all, and the agent's listing all walk
 * "what is on screen", and with every deck showing that is every section's pieces end to end. Computing it
 * once here, from the same sections the room renders, is what keeps those three from disagreeing
 * with the eye.
 */
import type { StudioEntitySummary } from "../../app-contract";
import { isRecord, recOr } from "../../../core/guards";
import { deckHead, deckOf, type DeckMeta } from "../../_shared/decks";
import { rankRecents } from "../workbench/recents-core";
import { plural } from "../../../core/text";

/** The top bar's order switch: search ranking (or studio order) vs newest first. */
export type ShelfOrder = "all" | "recent";

export const isShelfOrder = (v: unknown): v is ShelfOrder => v === "all" || v === "recent";

/** RC's row layout switch: a sideways row per deck, or the same cards wrapping. */
export type ShelfLayout = "carousel" | "grid";

export const isShelfLayout = (v: unknown): v is ShelfLayout => v === "carousel" || v === "grid";

export interface CarouselSection {
  deck: DeckMeta;
  /** "I", "II"... by position among the DRAWN sections, so the numbering never skips */
  numeral: string;
  /** this deck's pieces, in drawn order */
  pieces: StudioEntitySummary[];
  /** everything the deck holds, matched or not (the header's count while a search runs) */
  total: number;
}

/**
 * Newest first by the Workbench's own recency (later of imported and last opened). Open pieces are
 * NOT dropped here: the recents rail hides them because they are already tabs, but a shelf that
 * hid them would read as pieces gone missing.
 */
export function orderPieces(
  pieces: readonly StudioEntitySummary[],
  order: ShelfOrder,
  lastOpened: Record<string, number>,
): StudioEntitySummary[] {
  if (order === "all") return [...pieces];
  return rankRecents([...pieces], lastOpened, new Set(), pieces.length);
}

const ROMAN: readonly [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function roman(n: number): string {
  let rest = Math.max(1, Math.floor(n));
  let out = "";
  for (const [value, mark] of ROMAN) {
    while (rest >= value) {
      out += mark;
      rest -= value;
    }
  }
  return out;
}

/**
 * One section per deck that holds anything, in the rail's deck order, except that the deck chosen
 * at setup ("what are you making?") comes first: that is what opening on it means now that every
 * deck shows at once.
 *
 * An empty deck gets no section: a heading over nothing is a shelf that reads as broken, and the
 * rail already shows its zero. While a search runs, a deck with no MATCH is left out too, for the
 * same reason; its rail chip reads 0 of however many, so nothing looks lost.
 */
export function carouselSections(input: {
  /** matched pieces in rank order (the whole studio when no search runs) */
  readonly pieces: readonly StudioEntitySummary[];
  /** every deck with its studio total, in rail order */
  readonly counts: readonly { kind: string; count: number }[];
  readonly order: ShelfOrder;
  readonly lastOpened: Record<string, number>;
  /** the setup wizard's first deck, drawn first when it holds anything */
  readonly first?: string;
}): CarouselSection[] {
  const sections: CarouselSection[] = [];
  const counts = input.first
    ? [...input.counts.filter((c) => c.kind === input.first), ...input.counts.filter((c) => c.kind !== input.first)]
    : input.counts;
  for (const { kind, count } of counts) {
    if (count === 0) continue;
    const mine = input.pieces.filter((p) => deckOf(p.kind) === kind);
    if (mine.length === 0) continue;
    sections.push({
      deck: deckHead(kind),
      numeral: roman(sections.length + 1),
      pieces: orderPieces(mine, input.order, input.lastOpened),
      total: count,
    });
  }
  return sections;
}

/** Every drawn piece, section after section: the order ranges and Select all run over. */
export const drawnPieces = (sections: readonly CarouselSection[]): StudioEntitySummary[] =>
  sections.flatMap((s) => s.pieces);

/**
 * "Imported 3 days ago". IMPORTED, never "updated": the summary carries only the stamp from when
 * the piece arrived or was last saved through the studio, and calling that an edit date would
 * claim knowledge the studio does not have. Null when the stamp is absent or unreadable.
 */
export function importedAgo(importedAt: string | undefined, now: number): string | null {
  if (!importedAt) return null;
  const at = Date.parse(importedAt);
  if (!Number.isFinite(at)) return null;
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  const say = (n: number, unit: string): string => `Imported ${plural(n, unit)} ago`;
  if (minutes < 1) return "Imported just now";
  if (minutes < 60) return say(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return say(hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return say(days, "day");
  if (days < 35) return say(Math.floor(days / 7), "week");
  if (days < 365) return say(Math.floor(days / 30), "month");
  return say(Math.floor(days / 365), "year");
}

/** The per-deck facts the room already loaded for its shelves, keyed by piece id. */
export interface ShelfMeta {
  readonly lore: Readonly<Record<string, { enabled: boolean; entryCount: number }>>;
  readonly regex: Readonly<Record<string, { enabled: boolean; ruleCount: number; enabledRuleCount: number; doesWhat: string }>>;
  readonly persona: Readonly<Record<string, { brief?: string; pronouns?: string; sectionCount: number }>>;
}

export interface CardFacts {
  /** the big count on the art ("213 entries") */
  pill?: string;
  /** label/value pairs for the stats strip */
  stats: { label: string; value: string }[];
  /** the piece is switched off at set level */
  off: boolean;
  /** words the shelf already knows (a regex set's one-liner, a persona's brief) */
  words?: string;
}

/** What a card can state from the shelf meta alone, before (or without) a peek. */
/** A prompt format's card line: what it holds, and the honest note that nothing applies it yet. */
export function promptFormatWords(parts: readonly string[] | undefined): string {
  const held = parts?.length ? `${parts.join(" and ")}. ` : "";
  return `${held.charAt(0).toUpperCase()}${held.slice(1)}Used by text-completion connections, which Bunzai does not have yet.`;
}

export function cardFacts(e: StudioEntitySummary, meta: ShelfMeta): CardFacts {
  if (e.kind === "lorebook") {
    const m = meta.lore[e.id];
    if (!m) return { stats: [], off: false };
    return { pill: plural(m.entryCount, "entry", "entries"), stats: [{ label: "Entries", value: String(m.entryCount) }], off: !m.enabled };
  }
  if (e.kind === "regex") {
    const m = meta.regex[e.id];
    if (!m) return { stats: [], off: false };
    return {
      pill: plural(m.ruleCount, "rule", "rules"),
      stats: [{ label: "Rules", value: String(m.ruleCount) }, { label: "On", value: String(m.enabledRuleCount) }],
      off: !m.enabled,
      words: m.doesWhat || undefined,
    };
  }
  if (e.kind === "persona") {
    const m = meta.persona[e.id];
    if (!m) return { stats: [], off: false };
    return {
      stats: [
        ...(m.pronouns ? [{ label: "Pronouns", value: m.pronouns }] : []),
        { label: "Sections", value: String(m.sectionCount) },
      ],
      off: false,
      words: m.brief || undefined,
    };
  }
  return { stats: [], off: false };
}

/** Rough tokens the way RC printed them: 92.6K, 3.4K, 812. */
export function tokenLabel(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return String(tokens);
}

/** The RC cards, every section's first view, beside the drop-in ones. */
export const CARDS_VIEW = "cards";

/**
 * Which view a deck's section shows. Each deck keeps its own choice (`library.views`, kind to view
 * id), so a lorebook Shelf and a character Show can sit on one page. A stored id that is not a view
 * this deck offers, or anything unreadable, falls back to the cards: never to a view that would
 * draw another deck's shelf.
 */
export function sectionView(stored: unknown, kind: string, available: readonly string[]): string {
  if (!isRecord(stored)) return CARDS_VIEW;
  const id = stored[kind];
  return typeof id === "string" && (id === CARDS_VIEW || available.includes(id)) ? id : CARDS_VIEW;
}

/** The views map with one deck's choice changed, every other deck's kept. */
export function withSectionView(stored: unknown, kind: string, view: string): Record<string, string> {
  const base = recOr(stored);
  const kept = Object.fromEntries(Object.entries(base).filter((e): e is [string, string] => typeof e[1] === "string"));
  return { ...kept, [kind]: view };
}
