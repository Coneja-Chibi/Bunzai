/**
 * The library tools a scene links (ChatPrompting.tools) as narrator tools: each is read from the library and checked by the tool
 * kind's strict decoder, then called through the same tool loop as the lookup. A tool that is gone or unreadable is left out, and so is
 * one whose linked dice piece or formula is (it could only fail). Call
 * names come from the tool's name; one already taken (the lookup's, or an earlier tool's) gets a number, so no call is ambiguous.
 */
import { callName, freeName, readToolCall, runTool, toolDefinition, type ToolArgs, type ToolLinks } from "../core/tools";
import { safeParseCanonicalEntity } from "../entities/runtime-schema";
import type { DiceBody } from "../entities/dice/schema";
import type { FormulaBody } from "../entities/formula/schema";
import type { ToolBody } from "../entities/tool/schema";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { INVALID_TOOL, type NarratorTool } from "../stage/provider/tool-loop";
import { compendiumTools } from "./compendium-lookup";
import { trackerTool } from "./library-trackers";
import type { NarratorToolsFor, ToolsContext } from "./scene-turn-tools";

export type ReadPiece = (kind: string, id: string) => Promise<unknown | null>;

/** A scene's tools: the lorebook lookup first, then the library tools it links (none without a library), then the one update tool for its linked trackers. */
export const narratorTools = (read: ReadPiece | undefined): NarratorToolsFor => async (ctx, writes) => {
  const lookup = compendiumTools(ctx);
  const library = read ? await libraryTools(ctx, read, lookup) : [];
  const trackers = trackerTool(ctx, [...lookup, ...library].map((t) => t.definition.function.name), writes);
  return [...lookup, ...library, ...(trackers ? [trackers] : [])];
};

/** One stored piece of the given kind, checked by its strict decoder; null when it is gone, unreadable or another kind. */
export async function readPiece(read: ReadPiece, kind: string, id: string): Promise<unknown | null> {
  const parsed = safeParseCanonicalEntity(await read(kind, id).catch(() => null));
  return parsed.ok && parsed.entity.kind === kind ? parsed.entity.body : null;
}

export async function libraryTools(ctx: ToolsContext, read: ReadPiece, before: readonly NarratorTool<never>[]): Promise<NarratorTool<never>[]> {
  const taken = new Set([INVALID_TOOL, ...before.map((t) => t.definition.function.name)]);
  const out: NarratorTool<never>[] = [];
  for (const id of ctx.chat.prompting?.tools ?? []) {
    const body = (await readPiece(read, "tool", id)) as ToolBody | null;
    if (!body) continue;
    const dice = body.action.kind === "dice" ? ((await readPiece(read, "dice", body.action.id)) as DiceBody | null) : undefined;
    const formula = body.action.kind === "formula" ? ((await readPiece(read, "formula", body.action.id)) as FormulaBody | null) : undefined;
    if (dice === null || formula === null) continue;
    const links: ToolLinks = { ...(dice ? { dice } : {}), ...(formula ? { formula: { text: formula.text, context: () => ctx.macros.context } } : {}) };
    const name = freeName(callName(body.name), taken);
    const tool: NarratorTool<ToolArgs> = {
      access: SCENE_ACTION_TIERS["narrator.tool"],
      definition: toolDefinition(body, name),
      parse: (raw) => readToolCall(body, raw),
      run: async (args, _signal, deadline) => runTool(body, args, ctx.rand, links, deadline),
    };
    out.push(tool as NarratorTool<never>);
  }
  return out;
}
