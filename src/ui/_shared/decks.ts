/**
 * Deck metadata - the authored per-kind design constants (accent, plural label, short tag),
 * extracted exactly once. Consumers: the Workbench deck chips + floated deck, the shell's tab
 * kind tags and tray beads, the Library rail and its Carousel. Kinds are OPEN strings
 * (drop-in formats may add kinds); deckMeta falls back gracefully for unknown ones.
 * Also owns the --a convention: accentVars mints the pair every accent-wearing root paints.
 */
import { accentRole, type AccentFloors } from "./accent-role";
import { icSvg } from "./ic-svg";

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
}

/** RoleCall's library glyphs (lucide, stroke = currentColor), so a glyph takes whatever color its tile gives it. */
const GLYPH = {
  character: icSvg("lucide:user", 18),
  lorebook: icSvg("lucide:book-open", 18),
  persona: icSvg("lucide:circle-user", 18),
  pack: icSvg("lucide:package", 18),
  preset: icSvg("lucide:sliders-horizontal", 18),
  regex: icSvg("lucide:regex", 18),
  quickreply: icSvg("lucide:zap", 18),
  promptformat: icSvg("lucide:file-code", 18),
  fallback: icSvg("lucide:square", 18),
};

const DECKS: DeckMeta[] = [
  { kind: "character", singular: "Character", plural: "Characters", short: "char", accent: "var(--deck-character)", blurb: "Your cast", glyph: GLYPH.character },
  { kind: "lorebook", singular: "Lorebook", plural: "Lorebooks", short: "lore", accent: "var(--deck-lorebook)", blurb: "World knowledge", glyph: GLYPH.lorebook },
  { kind: "persona", singular: "Persona", plural: "Personas", short: "pers", accent: "var(--deck-persona)", blurb: "Who you play", glyph: GLYPH.persona },
  { kind: "pack", singular: "Pack", plural: "Packs", short: "pack", accent: "var(--deck-pack)", blurb: "Expressions and art", glyph: GLYPH.pack },
  { kind: "preset", singular: "Preset", plural: "Presets", short: "set", accent: "var(--deck-preset)", blurb: "Prompts and samplers", glyph: GLYPH.preset },
  { kind: "regex", singular: "Regex set", plural: "Regex sets", short: "rgx", accent: "var(--deck-regex)", blurb: "Text transformations", glyph: GLYPH.regex },
  { kind: "quickreply", singular: "Quick reply", plural: "Quick replies", short: "qr", accent: "var(--deck-preset)", blurb: "One-tap lines", glyph: GLYPH.quickreply },
  { kind: "promptformat", singular: "Prompt format", plural: "Prompt formats", short: "fmt", accent: "var(--deck-preset)", blurb: "Turn markers for text completion", glyph: GLYPH.promptformat },
];

const BY_KIND = new Map(DECKS.map((d) => [d.kind, d]));

/** Known decks in display order. */
export const knownDecks = (): DeckMeta[] => [...DECKS];

/**
 * The style pair an accent-wearing root paints: --a (borders, spines, marks) plus --a-deep
 * (TEXT-BEARING fills). A piece accent is a hex: its --a-deep comes from accentRole under the active
 * theme's floors (useAccentVars supplies them), exactly like the scoped character and persona accents.
 * A deck accent is a var(--deck-*) reference whose -deep twin lives in tokens.css; anything else (or a
 * hex with no readable floors) omits --a-deep so CSS falls back to var(--accent-deep). No accent ->
 * undefined (the var() fallback chains rule).
 */
export function accentVars(accent: string | undefined, floors: AccentFloors | null): Record<string, string> | undefined {
  if (!accent) return undefined;
  const role = floors ? accentRole(accent, floors) : null;
  if (role) return { "--a": accent, "--a-deep": role.deep };
  const deck = accent.match(/^var\(--deck-([a-z]+)\)$/);
  if (deck) return { "--a": accent, "--a-deep": `var(--deck-${deck[1]}-deep)` };
  return { "--a": accent };
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
      glyph: GLYPH.fallback,
    }
  );
}
