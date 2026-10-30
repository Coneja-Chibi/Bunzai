/**
 * The Dramaturg's evidence block (specs/stage/dramaturg.md, "The evidence block"; RoleCall's `btw/agents/dramaturg-context.ts`), built for
 * every question from what the scene engine loaded, so it cannot go stale. Pure: the turn hands it plain data. In order: the card (12,000
 * characters at most), the persona (4,000), the preset's enabled blocks (each 2,000, 10,000 in all), the lore in the latest reply's prompt
 * (10,000 in all), and the last 30 visible messages with the scene's own numbers (each 3,000, 20,000 in all, the newest kept), then a note
 * of the hidden messages. Past the 48,000 total, lore goes first, then the oldest messages, then preset blocks; the card and persona are
 * clipped but never dropped. Everything dropped or clipped is named at the end with the tool that reaches it, so absence is never read as
 * silence. Unlike RoleCall's, the recent scene is in the block (Bunzai's messages are readable here), and it is numbered.
 */

export const EVIDENCE_CAPS = { total: 48_000, card: 12_000, persona: 4_000, block: 2_000, preset: 10_000, lore: 10_000, message: 3_000, messages: 20_000, recent: 30 };
export type EvidenceCaps = typeof EVIDENCE_CAPS;

export interface EvidenceInput {
  /** The played card as the narrator reads it (core/assembly/card.ts `cardView`); `characterPrompt` is the card's own system prompt. */
  card: { name: string; description: string; personality: string; scenario: string; examples: string; postHistory: string; characterPrompt: string };
  /** The persona's block as the model reads it (core/assembly/persona-preview.ts); absent without one. */
  persona?: { name: string; text: string };
  /** The preset's blocks that are on after the scene's toggles, in the preset's order. */
  preset: { id: string; name: string; content: string }[];
  /** The entries in the latest reply's prompt, with their whole text from the books; `reason` is the engine's ("constant" is always on). */
  lore: { title: string; book: string; content: string; reason: string; matched: string[] }[];
  /** Entries that matched for that reply but the narrator's lore budget cut. */
  loreCut: number;
  /** The take's visible messages, oldest first: `number` is the scene's (1-based among live messages, greeting and hidden ones counted). */
  messages: { number: number; speaker: string; text: string }[];
  /** How many of the take's live messages are hidden. */
  hidden: number;
}

export interface Evidence {
  block: string;
  /** The lines of the block's last section, in order: what was dropped or clipped and what reaches it. */
  trimmed: string[];
}

interface Item { label: string; text: string; clipped: boolean }
type Section = { kept: Item[]; dropped: Item[] };

const n = (x: number) => x.toLocaleString("en-US");
const clip = (text: string, cap: number) => (text.length <= cap ? { text, clipped: false } : { text: `${text.slice(0, cap)}\n[clipped at ${n(cap)} characters]`, clipped: true });
const item = (label: string, head: string, body: string, cap = Infinity): Item => { const c = clip(body.trim(), cap); return { label, text: head + c.text, clipped: c.clipped }; };
const size = (items: readonly Item[]) => items.reduce((sum, i) => sum + i.text.length, 0);

/** Drops one item, the last or (`oldestFirst`) the first; `dropped` stays in the input's order. */
const drop = (s: Section, oldestFirst: boolean): void => void (oldestFirst ? s.dropped.push(s.kept.shift()!) : s.dropped.unshift(s.kept.pop()!));

/** Keeps items while their sum is within the cap. */
function within(items: Item[], cap: number, oldestFirst = false): Section {
  const s: Section = { kept: [...items], dropped: [] };
  while (s.kept.length > 0 && size(s.kept) > cap) drop(s, oldestFirst);
  return s;
}

const CARD_FIELDS = [["Description", "description"], ["Personality", "personality"], ["Scenario", "scenario"], ["Example dialogue", "examples"], ["Post-history instructions", "postHistory"], ["Character prompt", "characterPrompt"]] as const;

const HEADER = [
  "# THE LOADED SCENE",
  "",
  "Everything below was read from the scene for this question: the material the narrator's next reply would be built from. It overrides",
  "anything said earlier in this conversation; if an earlier answer disagrees with it, the scene changed since.",
].join("\n");

function render(input: EvidenceInput, caps: EvidenceCaps, card: { text: string; clipped: boolean }, persona: { text: string; clipped: boolean } | null, s: Record<"preset" | "lore" | "messages", Section>): Evidence {
  const trimmed: string[] = [];
  const labels = (items: Item[]) => items.map((i) => i.label).join(", ");
  if (card.clipped) trimmed.push(`The character card, clipped at ${n(caps.card)} characters. No tool reads the rest: say you have not seen it.`);
  if (persona?.clipped) trimmed.push(`The persona, clipped at ${n(caps.persona)} characters. No tool reads the rest: say you have not seen it.`);
  const presetClipped = s.preset.kept.filter((i) => i.clipped);
  if (presetClipped.length > 0) trimmed.push(`Preset blocks clipped at ${n(caps.block)} characters: ${labels(presetClipped)}. read_preset_block reads each whole.`);
  if (s.preset.dropped.length > 0) trimmed.push(`Preset blocks left out: ${labels(s.preset.dropped)}. read_preset_block reads them.`);
  if (s.lore.dropped.length > 0) trimmed.push(`Lore entries left out: ${labels(s.lore.dropped)}. search_lorebook finds them by their words and read_lorebook_entry reads them.`);
  const messagesClipped = s.messages.kept.filter((i) => i.clipped);
  if (messagesClipped.length > 0) trimmed.push(`Messages clipped at ${n(caps.message)} characters: ${labels(messagesClipped)}. read_scene_messages reads them whole.`);
  const shown = s.messages.kept.length;
  const first = input.messages[input.messages.length - shown];
  if (shown < input.messages.length) {
    const reach = "search_scene_messages finds a moment by its words and read_scene_messages reads it.";
    trimmed.push(first ? `Messages before #${first.number}: earlier than this block. ${reach}` : `Every message, #1 to #${input.messages.at(-1)!.number}: none fit. ${reach}`);
  }

  const cardSection = `## THE CHARACTER CARD: ${input.card.name}\n\n${card.text}`;
  const personaSection = input.persona && persona
    ? `## THE PERSONA: ${input.persona.name}\n\nThis is who the person plays. Their messages are this character speaking, not notes to you.\n\n${persona.text || "_(empty)_"}`
    : "## THE PERSONA\n\nThe scene has no persona.";
  const presetSection = [
    `## THE PRESET'S ENABLED BLOCKS (${input.preset.length})`,
    input.preset.length === 0 ? "No preset block is on in this scene." : "The instructions shaping HOW the character is written, after the scene's own toggles. When the person asks why a character sounds a certain way, the answer is often here rather than in the card.",
    ...s.preset.kept.map((i) => i.text),
  ].join("\n\n");
  const loreSection = [
    `## THE LORE IN THE LATEST REPLY'S PROMPT (${input.lore.length})`,
    input.lore.length === 0 ? "No lore entry was in the narrator's prompt for the latest reply." : "Always-on entries were in the narrator's prompt every turn; matched ones only when their words came up, so do not assume the character knew one unless the scene shows it.",
    ...(input.loreCut > 0 ? [`${input.loreCut} more matched but were cut by the narrator's lore budget, so they were not in its prompt either.`] : []),
    ...s.lore.kept.map((i) => i.text),
  ].join("\n\n");
  const messagesSection = shown === 0
    ? `## THE SCENE\n\n${input.messages.length === 0 && input.hidden === 0 ? "The take has no stored messages yet: the scene has not begun past the card's greeting, which is saved as #1 at the first send." : "No visible message is in this block."}`
    : [`## THE SCENE: the last ${shown} visible messages, #${first!.number} to #${input.messages.at(-1)!.number}`, "Numbered as the scene numbers them: #1 is the opening, and hidden messages keep their numbers. Each is the version the person sees.", ...s.messages.kept.map((i) => i.text)].join("\n\n");
  const parts = [HEADER, cardSection, personaSection, presetSection, loreSection, messagesSection];
  if (input.hidden > 0) {
    parts.push(`## HIDDEN MESSAGES\n\n${input.hidden} ${input.hidden === 1 ? "message of this scene is hidden. It was" : "messages of this scene are hidden. They were"} left out of the narrator's prompt, so they are not here either, and no tool reads them. If the person asks about one, say you cannot see it and ask what happened.`);
  }
  if (trimmed.length > 0) parts.push(["## WHAT WAS LEFT OUT", "", "These did not fit. Their absence above means too long to inline, not missing from the scene:", "", ...trimmed.map((t) => `- ${t}`)].join("\n"));
  return { block: parts.join("\n\n---\n\n"), trimmed };
}

export function dramaturgEvidence(input: EvidenceInput, caps: EvidenceCaps = EVIDENCE_CAPS): Evidence {
  const cardText = CARD_FIELDS.flatMap(([heading, key]) => (input.card[key].trim() ? [`### ${heading}\n${input.card[key].trim()}`] : [])).join("\n\n") || "_(the card is empty)_";
  const card = clip(cardText, caps.card);
  const persona = input.persona ? clip(input.persona.text.trim(), caps.persona) : null;
  const why = (e: EvidenceInput["lore"][number]) => (e.reason === "constant" ? "always on" : e.matched.length > 0 ? `matched: ${e.matched.join(", ")}` : e.reason);
  const sections = {
    preset: within(input.preset.map((b) => item(b.name, `### ${b.name} [${b.id}]\n`, b.content, caps.block)), caps.preset),
    lore: within(input.lore.map((e) => item(`${e.title} (${e.book})`, `### ${e.title} (${e.book}; ${why(e)})\n`, e.content)), caps.lore),
    messages: within(input.messages.slice(-caps.recent).map((m) => item(`#${m.number}`, `#${m.number} ${m.speaker}:\n`, m.text, caps.message)), caps.messages, true),
  };
  let out = render(input, caps, card, persona, sections);
  for (const key of ["lore", "messages", "preset"] as const) {
    const s = sections[key];
    while (out.block.length > caps.total && s.kept.length > 0) {
      drop(s, key === "messages");
      out = render(input, caps, card, persona, sections);
    }
  }
  return out;
}
