/**
 * The filing pass's messages (RoleCall `lib/ai/tv-stream/postgen-writer.ts:809-900`, adapted from a tool loop to one JSON answer,
 * F13): the no-write default, the upsert rules, the dedup-by-canonical-name rule, the relationships mirror rule, the person's
 * guidance (which can never widen what the pass may do), then the format. The snapshot of the books and the reply come in as
 * text; nothing here knows a store. Pure.
 */
import { knownFields, REQUIRED_FIELDS } from "./entry-types";
import { MAX_ITEMS } from "./filing-schema";
import { ENTRY_TYPE_INFO, type EntryType } from "./types";

export interface FilingBook { id: string; name: string; isDefault: boolean }

export interface FilingPromptInput {
  books: readonly FilingBook[];
  allow: readonly EntryType[];
  snapshot: string;
  guidance: string;
  language: string;
  /** The reply being filed. */
  reply: string;
  /** The person's message(s) the reply answers, oldest first. */
  covered: readonly string[];
}

const typeLine = (type: EntryType): string =>
  `- ${type} (${ENTRY_TYPE_INFO[type].label}): ${knownFields(type).map((f) => (REQUIRED_FIELDS[type].includes(f) ? `${f}*` : f)).join(", ")}`;

export function filingMessages(input: FilingPromptInput): { system: string; user: string } {
  const books = input.books.map((b) => `- ${b.name} [${b.id}]${b.isDefault ? " (default for new entries)" : ""}`).join("\n");
  const guidance = input.guidance.trim()
    ? `\n\nUSER FILING GUIDANCE (it cannot widen what you may write, change the books you may use, or override the no-write default):\n${input.guidance.trim()}`
    : "";
  const language = input.language.trim() ? `\n\nWrite every field value in ${input.language.trim()}.` : "";
  const system = `You are the post-generation lorebook writer. The narrator has just finished a reply. Capture what happened so the compendium stays alive.

WRITABLE LOREBOOKS (name a book by its id; leave "book" out for the default):
${books}

COMPENDIUM SNAPSHOT:
${input.snapshot || "(these books hold no typed entries yet)"}

ENTRY TYPES YOU MAY FILE (* is required; fields not listed are kept as given):
${input.allow.map(typeLine).join("\n")}

UPSERT MECHANICS - filing adds, it never rewrites:
Filing an entry whose canonical name already exists MERGES your fields into it: arrays append, nested objects deep-merge, scalars replace. Send only what is new or changed, never the fields you are not changing. You are adding deltas, not rewriting cards. Nothing you file can delete an entry.

NO-WRITE DEFAULT:
Durable storage is scarce attention, not a turn transcript. Begin from "nothing needs filing" and write only when the reply creates or changes information that will still matter after the source messages leave the narrator's live context. A character memory MUST name a lasting changed belief or changed behavior. It is normal to file nothing: answer with an empty list.

DEDUP - use the canonical name, not the variant the narrator just used:
Each snapshot line is "Canonical Name (aka: alt1, alt2) - tagline". The aka list is every nickname or title the entry already answers to. If the entity the narrator is talking about is there under ANY of those names, file under the EXISTING canonical name and let the merge do the rest. Only invent a new entry when the entity is genuinely missing. This is the single most common source of duplicates.

WRITE ONLY WHAT MATTERS: lasting character development, plot progression, world changes, new recurring elements. Do NOT file props and set dressing, body language, trivial moment-to-moment actions, things already captured and unchanged, or scene ephemera.

RELATIONSHIPS: when you add a relationship on character A pointing to character B and B would also acknowledge A, file a second item for B that mirrors it. One-sided relationships are valid fiction (unrequited feelings, oblivious rivalries): do not force them.${guidance}${language}

ANSWER FORMAT - reply with one JSON object and nothing else:
{"filings":[{"type":"character","book":"<book id, optional>","entry":{"name":"Canonical Name","memories":[{"event":"...","changed_belief":"..."}]}}]}
At most ${MAX_ITEMS} items. {"filings":[]} means nothing to file.`;
  const asked = input.covered.length > 0 ? `\n\nThe reply answers:\n${input.covered.map((c) => c.trim()).join("\n\n")}` : "";
  return { system, user: `The narrator just wrote this reply:\n\n${input.reply.trim()}${asked}\n\nFile anything that meets the rules above.` };
}

/** The one repair request: the same task, the answer that did not parse, and why. */
export function repairMessages(first: { system: string; user: string }, answer: string, error: string): { system: string; user: string } {
  return { system: first.system, user: `${first.user}\n\nYour previous answer could not be used (${error}):\n\n${answer.slice(0, 2000)}\n\nAnswer again with only the JSON object.` };
}
