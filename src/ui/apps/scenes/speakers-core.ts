/**
 * Per-speaker dialogue colours for a reply's quoted speech (RoleCall `lib/character-colors/attribute-speakers.ts`, merged by
 * `lib/scene/message-decorations.ts computeQuoteColorAssignments`): who said each quote, by the three patterns RoleCall reads (a name
 * before a speech verb after the quote, a name and a verb before it, a name and a colon before it), else the main character
 * (its solo-card fallback). Unlike RoleCall's second regex over the whole message, this reads the very quote nodes prose-core draws,
 * block by block, so a colour can never land one quote off. RoleCall's model-labelled speakers (`label_speakers`) are not ported.
 * Pure: no React, no DOM.
 */
import { escapeRegex } from "../../../core/regex/escape";
import type { Speaker } from "../../../core/participants/roster";
import { inlineLines, parseInline, type Block, type Inline } from "./prose-core";

const VERBS = [
  "said", "asked", "replied", "answered", "responded", "whispered", "murmured", "muttered", "growled", "snapped", "sighed", "laughed", "added",
  "continued", "called", "cried", "shouted", "exclaimed", "declared", "demanded", "insisted", "spoke", "remarked", "stated", "agreed", "breathed", "hissed",
].join("|");


interface Quote { start: number; end: number; text: string }

/** A block's text as plain prose with every quote (and where it sits) noted, in the order prose-core draws them. */
function flatten(lines: readonly string[]): { plain: string; quotes: Quote[] } {
  let plain = "";
  const quotes: Quote[] = [];
  const walk = (nodes: Inline[]): void => {
    for (const n of nodes) {
      if (n.t === "text" || n.t === "code" || n.t === "a") plain += n.s;
      else if (n.t === "q") {
        const start = plain.length;
        plain += '"';
        walk(n.kids);
        plain += '"';
        quotes.push({ start, end: plain.length, text: plain.slice(start + 1, -1) });
      } else if (n.t === "em" || n.t === "i" || n.t === "b") walk(n.kids);
    }
  };
  lines.forEach((line, i) => {
    if (i > 0) plain += "\n";
    walk(parseInline(line));
  });
  return { plain, quotes };
}

/** The speaker one quote belongs to, or null when no pattern names one. */
function speakerOf(plain: string, q: Quote, byLength: readonly Speaker[]): Speaker | null {
  const before = plain.slice(Math.max(0, q.start - 240), q.start);
  const after = plain.slice(q.end, q.end + 120);
  const patterns = (name: string): RegExp[] => {
    const n = escapeRegex(name);
    return [new RegExp(`^\\s*[,.!?:;]?\\s*${n}\\s+(?:${VERBS})\\b`, "i"), new RegExp(`\\b${n}\\s+(?:${VERBS})[,;:]?\\s*$`, "i"), new RegExp(`(?:^|[\\n.!?]\\s*)${n}\\s*:\\s*$`, "i")];
  };
  const text = [after, before, before];
  for (let p = 0; p < 3; p++) {
    for (const s of byLength) if (patterns(s.name)[p]!.test(text[p]!)) return s;
  }
  return null;
}

/** The colour of each quote in this block, in the order it is drawn; undefined when there are no speakers or no quotes. */
export function quoteTint(block: Block, speakers: readonly Speaker[]): (string | null)[] | undefined {
  if (speakers.length === 0) return undefined;
  const lines = inlineLines(block);
  if (lines.length === 0) return undefined;
  const { plain, quotes } = flatten(lines);
  if (quotes.length === 0) return undefined;
  const byLength = [...speakers].sort((a, b) => b.name.length - a.name.length);
  const main = speakers.find((s) => s.main);
  return quotes.map((q) => (q.text.trim() === "" ? null : (speakerOf(plain, q, byLength) ?? main)?.color ?? null));
}
