/**
 * The narrator's lookup tool (04b "Narrator lookup", RoleCall Settings > Advanced "Narrator explore tool" = `tv_during_gen_search`,
 * `CompendiumSettings.tsx:1400-1414`; the tool is `explore_lorebook`, `narrator-engine/explore-lorebook-tool.ts`): while it writes, the
 * narrator can search the scene's readable Compendium books, or read entries in full. Read only, and over the same books and the same
 * index the recall pass reads (`buildRecallIndex`, `readable`), so a book set to off or write only is never in it. The index is built once
 * per reply, so the handles in the description are the handles a call names. RoleCall's third mode, browsing by tree node id, is not
 * ported: the description already lists every entry under its tree group, down to the recall depth the person chose.
 * Arguments are parsed once here (the loop never sees them raw); what a call returns for the trace is names and counts, never entry text.
 */
import { buildRecallIndex, type RecallCandidate } from "../core/compendium/recall-index";
import { resolveCompendium } from "../core/compendium/defaults";
import { countText } from "../core/tokens";
import { isRecord } from "../core/guards";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import type { NarratorTool } from "../stage/provider/tool-loop";
import { readable } from "./compendium-recall";
import type { ToolsContext } from "./scene-turn-tools";

/** The most tokens the tool's description spends on the index. */
const LOOKUP_INDEX_TOKENS = 6_000;
const MAX_QUERY = 200;
const MAX_IDS = 10;
const MAX_MATCHES = 10;
const SNIPPET = 200;

export interface LookupArgs { query?: string; entry_ids?: string[] }

const HANDLE = /^e\d+$/;

function parse(raw: unknown): { args: LookupArgs } | { error: string } {
  if (!isRecord(raw)) return { error: "The arguments must be an object." };
  const unknown = Object.keys(raw).find((k) => k !== "query" && k !== "entry_ids");
  if (unknown) return { error: `Unknown argument ${unknown}. Pass query, entry_ids, or both.` };
  const args: LookupArgs = {};
  if (raw["query"] !== undefined) {
    const query = typeof raw["query"] === "string" ? raw["query"].trim() : "";
    if (!query || query.length > MAX_QUERY) return { error: `query must be 1 to ${MAX_QUERY} characters.` };
    args.query = query;
  }
  if (raw["entry_ids"] !== undefined) {
    const ids = raw["entry_ids"];
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_IDS || !ids.every((id) => typeof id === "string" && HANDLE.test(id))) return { error: `entry_ids must be 1 to ${MAX_IDS} handles like e3, taken from the index.` };
    args.entry_ids = ids as string[];
  }
  return args.query === undefined && args.entry_ids === undefined ? { error: "Pass a query to search, or entry_ids to read entries." } : { args };
}

const hit = (c: RecallCandidate) => ({ bookId: c.bookId, entryId: c.entryId, bookName: c.bookName, title: c.name, tokens: countText(c.content) });

export const compendiumTools = ({ chat, loaded }: Pick<ToolsContext, "chat" | "loaded">): NarratorTool<never>[] => {
  const c = resolveCompendium(chat.compendium);
  if (!c.on || !c.lookup) return [];
  const open = readable(chat, loaded);
  const r = c.recall;
  const index = buildRecallIndex(open.map((b) => ({ id: b.id, name: b.name, entries: b.body.entries, categories: b.body.categories ?? [] })), { detail: r.detail, depth: r.depth, bookDisplay: r.bookDisplay, tokenBudget: LOOKUP_INDEX_TOKENS });
  if (index.candidates.size === 0) return [];
  const tool: NarratorTool<LookupArgs> = {
    access: SCENE_ACTION_TIERS["narrator.lookup"],
    definition: {
      type: "function",
      function: {
        name: "explore_lorebook",
        description: [
          "Look up what the world's books say about a character, place, item, event or anything stored, when you need a fact you were not given.",
          "Two ways to use it, alone or together:",
          "1. Search: pass query (words to look for) to list the entries that mention all of them, each with a handle like e3.",
          "2. Read: pass entry_ids (handles from the index below or from a search) to get those entries in full.",
          "Read only what you need.",
          "",
          "Index of the books you can read:",
          index.text,
        ].join("\n"),
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Words to look for across the entries. Every word must appear." },
            entry_ids: { type: "array", items: { type: "string" }, description: `Handles of entries to read in full, at most ${MAX_IDS}.` },
          },
        },
      },
    },
    parse,
    async run(args) {
      const shown: RecallCandidate[] = [];
      const lines: string[] = [];
      if (args.query !== undefined) {
        const terms = args.query.toLowerCase().split(/\s+/);
        const matches = [...index.candidates.values()].filter((e) => terms.every((t) => `${e.name} ${e.content}`.toLowerCase().includes(t)));
        if (matches.length === 0) lines.push(`No entries match "${args.query}".`);
        for (const e of matches.slice(0, MAX_MATCHES)) {
          shown.push(e);
          lines.push(`[${e.handle}] ${e.name} (${e.bookName}): ${e.content.replace(/\s+/g, " ").trim().slice(0, SNIPPET)}`);
        }
        if (matches.length > MAX_MATCHES) lines.push(`(${matches.length - MAX_MATCHES} more match; narrow the query.)`);
      }
      const missing: string[] = [];
      for (const id of args.entry_ids ?? []) {
        const e = index.candidates.get(id);
        if (!e) { missing.push(id); continue; }
        if (!shown.includes(e)) shown.push(e);
        lines.push(`## ${e.name} (${e.bookName})\n${e.content}`);
      }
      if (missing.length > 0) lines.push(`Not found in the index: ${missing.join(", ")}.`);
      return { text: lines.join("\n\n"), detail: { ...(args.query !== undefined ? { query: args.query } : {}), entries: shown.map(hit), ...(missing.length > 0 ? { missing } : {}) } };
    },
  };
  return [tool as NarratorTool<never>];
};
