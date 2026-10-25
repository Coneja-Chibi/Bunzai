/**
 * The pure side of Import chat history (RoleCall `lib/lorebook/tv-ingest.ts`): how a chat is cut into chunks of about N tokens as
 * its messages stream past, which entry types a run may file for the phases switched on, and what a chunk's call is told. RoleCall
 * runs three tool phases in one conversation (Search, Facts, Narrative); here one JSON answer per chunk does the same work with the
 * phases as switches: Search shows the call the entries that exist (so it files into them instead of duplicating), Facts allows the
 * ten fact types, Narrative allows recaps and plots and asks for plot overviews. The answer is read by `parseHistorian` with this
 * run's allowed types. Pure; nothing here reads a chat.
 */
import type { ChatCompendiumIngest } from "../../stage/contracts/chat-settings-types";
import { countText } from "../tokens";
import { ENTRY_TYPES, ENTRY_TYPE_INFO, type EntryType } from "./types";
import { MAX_ITEMS } from "./filing-schema";
import { knownFields, REQUIRED_FIELDS } from "./entry-types";

export interface Chunker {
  /** Adds one message's text; returns the chunk that was full before it, if any. */
  push(text: string): string | null;
  /** The last, partly filled chunk. */
  flush(): string | null;
}

/** Groups messages into chunks of at most `maxTokens` (a single longer message is a chunk of its own), holding one chunk at a time. */
export function createChunker(maxTokens: number): Chunker {
  let text = "";
  let used = 0;
  return {
    push(line) {
      const cost = countText(line);
      const full = used > 0 && used + cost > maxTokens ? text : null;
      if (full !== null) { text = ""; used = 0; }
      text += `${line}\n\n`;
      used += cost;
      return full;
    },
    flush() {
      const out = used > 0 ? text : null;
      text = "";
      used = 0;
      return out;
    },
  };
}

/** The types a run may file: Facts allows every type but recaps, Narrative allows recaps and plots; with neither on there is nothing to do. */
export function ingestAllowed(phases: Pick<Required<ChatCompendiumIngest>, "facts" | "narrative">): EntryType[] {
  return ENTRY_TYPES.filter((t) => (phases.facts && t !== "summary") || (phases.narrative && (t === "summary" || t === "plot")));
}

export interface IngestPromptInput {
  /** Live message indices the chunk spans, end exclusive. */
  from: number;
  to: number;
  chunk: string;
  phases: Pick<Required<ChatCompendiumIngest>, "search" | "facts" | "narrative">;
  allow: readonly EntryType[];
  /** The existing entries (Search), or an empty text. */
  snapshot: string;
  /** What the chunks before this one filed (Continuity), oldest first. */
  activity: readonly string[];
  guidance: string;
  language: string;
}

const typeLine = (type: EntryType): string => `- ${type} (${ENTRY_TYPE_INFO[type].label}): ${knownFields(type).map((f) => (REQUIRED_FIELDS[type].includes(f) ? `${f}*` : f)).join(", ")}`;
const LOG_LINES = 100;

export function ingestMessages(input: IngestPromptInput): { system: string; user: string } {
  const { phases } = input;
  const span = Math.max(1, input.to - input.from);
  const narrative = phases.narrative
    ? `\n\nNARRATIVE: summarize the significant scenes of this chunk as "summary" entries, roughly ${Math.max(2, Math.ceil(span / 8))} for it, 3 to 5 sentences each in past tense (who, what happened, outcome, emotional beats), with participants, significance (minor, moderate, major or pivotal) and key_moments. Every summary MUST belong to a plot: put the plot's exact name in "parent_plot", reusing an existing plot when it fits. Then write "arcs": for each plot you summarized, that plot's overview as one cohesive chronological narrative.`
    : "";
  const search = phases.search && input.snapshot
    ? `\n\nEXISTING ENTRIES (file into one by its canonical name instead of making a duplicate; nothing you file can delete an entry):\n${input.snapshot}`
    : "";
  const continuity = input.activity.length > 0
    ? `\n\nPREVIOUS INGEST ACTIVITY (do NOT create duplicates for these; when the same subject comes up again, file under the SAME name to merge into the entry):\n${input.activity.slice(-LOG_LINES).join("\n")}`
    : "";
  const guidance = input.guidance.trim() ? `\n\nUSER GUIDANCE (it cannot widen what you may write):\n${input.guidance.trim()}` : "";
  const language = input.language.trim() ? `\n\nWrite every field value in ${input.language.trim()}.` : "";
  const system = `You are a compendium curator processing roleplay chat messages. Extract, type and organize the world's facts and narrative into typed entries.

ENTRY TYPES YOU MAY FILE (* is required; fields not listed are kept as given):
${input.allow.map(typeLine).join("\n")}

Rules:
- Pick the RIGHT type for each piece of information. A character's signature spell is a power (with the character as its user) and the character's profile is a character entry; do not jam them into one.
- Extract FACTS, not opinions or speculation. Third person; present tense for characters, places and world rules, past tense for events and summaries.
- Be concise but complete; fill every relevant typed field. No meta-commentary about the roleplay. Do not extract trivial dialogue or mundane actions. Do not make up anything that is not in the messages.
- The name (or title, or topic) of every entry is REQUIRED. If you cannot name it from the chat, skip it rather than file a placeholder.
- Filing an entry whose canonical name exists MERGES into it: arrays append, objects merge, scalars replace. Send only what is new.${narrative}${search}${continuity}${guidance}${language}

ANSWER FORMAT - reply with one JSON object and nothing else:
{"filings":[{"type":"character","entry":{"name":"Canonical Name","description":"..."}}]${phases.narrative ? ',"arcs":[{"plot":"Plot Name","overview":"..."}]' : ""}}
At most ${MAX_ITEMS} filings. {"filings":[]} means nothing to file.`;
  return { system, user: `Process these chat messages (${input.from} to ${input.to - 1}):\n\n${input.chunk}` };
}

/** One line of the activity log per filed item. */
export const activityLine = (type: string, name: string): string => `${type}: ${name}`;
