/**
 * Deck metadata: each kind's face (accent, labels, glyph) as the UI uses it, read from the kind hub
 * (src/entities/<kind>/kind.ts via src/generated/kinds.ts), never written here. Consumers: the Workbench deck chips and
 * floated deck, the shell's tab
 * kind tags and tray beads, the Library rail and its Carousel. Kinds are OPEN strings
 * (drop-in formats may add kinds); deckMeta falls back gracefully for unknown ones.
 * Also owns the --a convention: accentVars mints the pair every accent-wearing root paints.
 */
import { accentRole, type AccentFloors } from "./accent-role";
import { icSvg } from "./ic-svg";
import { KINDS, kindOf } from "../../generated/kinds";

export interface DeckMeta {
  /** canonical kind ("character") */
  kind: string;
  /** the deck's plural display name ("Characters") */
  plural: string;
  /** one of them ("Character", "Regex set"), for counts of exactly one */
  singular: string;
  /** short tag for tabs/chips ("char") */
  short: string;
  /** the deck's accent: a `var(--deck-*)` reference into tokens.css (hues live THERE, the
   *  no-hardcode doctrine). Only ever consumed in CSS contexts (`--a`/`--spine` style props). */
  accent: string;
  /** one line on what the deck holds, under its name in the Library rail ("World knowledge") */
  blurb: string;
  /** first-party line-icon SVG markup (render through the Library's Icon, never innerHTML) */
  glyph: string;
  /** how a count of its pieces reads ("1 preset", "3 pieces" in a deck other kinds join) */
  countWords: readonly [string, string];
}

const FALLBACK_GLYPH = icSvg("lucide:square", 18);

/** Every kind's deck face, from the kind hub (src/entities/<kind>/kind.ts); glyphs are lucide, stroke = currentColor. */
const ALL: DeckMeta[] = KINDS.map((k) => ({
  kind: k.id, singular: k.singular, plural: k.plural, short: k.short, accent: k.accent, blurb: k.blurb, glyph: icSvg(k.icon, 18),
  countWords: [k.singular.toLowerCase(), k.plural.toLowerCase()],
}));
const BY_KIND = new Map(ALL.map((d) => [d.kind, d]));

/** The Library deck a kind's pieces sit in: its own, or the one its kind.ts joins (a Script Sheet's is the presets'). */
export const deckOf = (kind: string): string => kindOf(kind)?.deck ?? kind;
/** The kinds whose pieces one deck holds, in display order. */
export const deckKinds = (deck: string): string[] => KINDS.filter((k) => (k.deck ?? k.id) === deck).map((k) => k.id);

/** A deck as its heading shows it: the owning kind's face, with the deck's own name when other kinds join it ("Writing"). */
export function deckHead(deck: string): DeckMeta {
  const meta = deckMeta(deck);
  const k = kindOf(deck);
  return k?.deckTitle ? { ...meta, plural: k.deckTitle, singular: k.deckTitle, blurb: k.deckBlurb ?? meta.blurb, countWords: ["piece", "pieces"] } : meta;
}
const DECKS = KINDS.filter((k) => k.libraryDeck && !k.deck).map((k) => deckHead(k.id));

/** The Library's decks, in display order. */
export const knownDecks = (): DeckMeta[] => [...DECKS];

/**
 * The style pair an accent-wearing root paints: --a (borders, spines, marks) plus --a-deep
 * (TEXT-BEARING fills). A piece accent is a hex: its --a-deep comes from accentRole under the active
 * theme's floors (useAccentVars supplies them), exactly like the scoped character and persona accents. Accent words use its text-held --a-text twin.
 * A deck or signature accent is a var(--deck-*) / var(--sig-*) reference whose -deep twin lives in tokens.css; anything
 * else (or a hex with no readable floors) omits --a-deep so CSS falls back to var(--accent-deep). No accent ->
 * undefined (the var() fallback chains rule).
 */
export function accentVars(accent: string | undefined, floors: AccentFloors | null): Record<string, string> | undefined {
  if (!accent) return undefined;
  const role = floors ? accentRole(accent, floors) : null;
  if (role) return { "--a": accent, "--a-deep": role.deep, "--a-text": role.text };
  const token = accent.match(/^var\(--((?:deck|sig)-[a-z0-9]+)\)$/);
  if (token) return { "--a": accent, "--a-deep": `var(--${token[1]}-deep)` };
  return { "--a": accent };
}

const SIGNATURES = 8; // --sig-1 .. --sig-8 in tokens.css

/** A piece's color: its own (authored, or taken from its art), else one of the signature colors picked from its id, so it
 * wears the same one everywhere and always. Display only; nothing is saved. */
export function pieceColor(piece: { id: string; accent?: string }): string {
  if (piece.accent) return piece.accent;
  let hash = 0;
  for (let i = 0; i < piece.id.length; i++) hash = (hash * 31 + piece.id.charCodeAt(i)) >>> 0;
  return `var(--sig-${(hash % SIGNATURES) + 1})`;
}

/** Meta for any kind; unknown kinds get a readable fallback (open-by-design). */
export function deckMeta(kind: string): DeckMeta {
  return (
    BY_KIND.get(kind) ?? {
      kind,
      plural: kind.charAt(0).toUpperCase() + kind.slice(1) + "s",
      singular: kind.charAt(0).toUpperCase() + kind.slice(1),
      short: kind.slice(0, 4),
      accent: "var(--deck-fog)",
      blurb: "Pieces",
      glyph: FALLBACK_GLYPH,
      countWords: [kind, `${kind}s`],
    }
  );
}
