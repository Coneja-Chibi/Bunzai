/**
 * The library trackers a scene links (ChatPrompting.trackers), read for a turn: each is read from the library and checked by the tracker kind's
 * strict decoder, a gone or unreadable one is left out, and so is one whose name another linked tracker already has (a name means one tracker).
 * Each comes with its value in the scene state (`LinkedTracker`). Their one narrator tool, `update_trackers`, is made here too: it is the loop's
 * only write, held to `stateScoped` because its effect is pending deltas on the reply being written (scene-turn-writes.ts), and the write door is
 * handed to this tool alone. A call's arguments are checked, then applied to the values as the reply stands; after each success the turn's tracker
 * views (what the macros read) follow, so a later macro or formula in the same reply reads the new value.
 */
import { processMacros } from "../core/macros";
import { withoutDeadline } from "../core/macros/deadline";
import { freeName } from "../core/tools";
import { TRACKER_TOOL, applyTrackerUpdates, checkUpdatesShape, refreshTrackerTexts, trackerState, updateTrackersTool, type LinkedTracker, type TrackerState, type UpdatesCall } from "../core/tracker";
import type { SceneState } from "../core/scene-state/types";
import type { TrackerBody } from "../entities/tracker/schema";
import { SCENE_ACTION_TIERS } from "../kit/tools/safety/scene-tiers";
import { INVALID_TOOL, type NarratorTool } from "../stage/provider/tool-loop";
import type { ToolsContext } from "./scene-turn-tools";
import type { TurnWrites } from "./scene-turn-writes";

/** Reads one tracker piece by id, decoded; null when it is gone or unreadable. */
export type ReadTracker = (id: string) => Promise<TrackerBody | null>;

/** The linked trackers that can be read, in order, each with its value in `state`. */
export async function linkedTrackers(read: ReadTracker | undefined, ids: readonly string[] | undefined, state: SceneState): Promise<LinkedTracker[]> {
  const out: LinkedTracker[] = [];
  if (!read) return out;
  for (const id of ids ?? []) {
    const body = await read(id);
    if (body && !out.some((t) => t.body.name.toLowerCase() === body.name.toLowerCase())) out.push({ id, body, ...trackerState(state, id, body) });
  }
  return out;
}

/** The narrator tool for the turn's linked trackers, or null when none is linked. `taken` are the names the other tools already use. */
export function trackerTool(ctx: ToolsContext, taken: readonly string[], writes: TurnWrites): NarratorTool<never> | null {
  const linked = ctx.loaded.linkedTrackers ?? [];
  if (linked.length === 0) return null;
  /** Each tracker's value as the reply stands, stored and shown: where the prompt left it, then every call this reply has made. */
  const standing = new Map<string, TrackerState>(linked.map((t) => [t.id, { shown: t.shown, stored: t.stored }]));
  const now = (): LinkedTracker[] => linked.map((t) => ({ ...t, ...standing.get(t.id)! }));
  const { description, parameters } = updateTrackersTool(linked.map((t) => t.body));
  const tool: NarratorTool<UpdatesCall> = {
    access: SCENE_ACTION_TIERS["narrator.tracker"],
    stateScoped: true,
    definition: { type: "function", function: { name: freeName(TRACKER_TOOL, new Set([INVALID_TOOL, ...taken])), description, parameters } },
    // Only the shape is checked here, in one cheap pass, and the call is handed on as the model sent it (the loop echoes it back to the model);
    // run applies it once, to the values as they stand, inside the tool's time budget.
    parse: (raw) => {
      const errors = checkUpdatesShape(raw);
      return errors.length > 0 ? { error: `Nothing was changed. ${errors.join(" ")}` } : { args: raw as UpdatesCall };
    },
    run: async (call) => {
      const applied = applyTrackerUpdates(now(), call, writes.now());
      if ("errors" in applied) throw new Error(`Nothing was changed. ${applied.errors.join(" ")}`);
      const refused = await writes.append(applied.deltas);
      if (refused) throw new Error(refused);
      for (const [id, value] of applied.values) standing.set(id, value);
      followViews(ctx, linked, standing);
      return { text: applied.text, detail: { changes: applied.deltas.length } };
    },
  };
  return tool as NarratorTool<never>;
}

/** The turn's macro context reads the tracker views the prompt was built with; after a write they take the new values and their texts are rendered again (templates read-only). */
function followViews(ctx: ToolsContext, linked: readonly LinkedTracker[], standing: ReadonlyMap<string, TrackerState>): void {
  const context = ctx.macros.context;
  if (!context?.trackers) return;
  for (const t of linked) {
    const view = context.trackers.get(t.body.name.toLowerCase());
    if (view?.body === t.body) view.value = standing.get(t.id)!.shown;
  }
  refreshTrackerTexts(context.trackers, (template) => processMacros(template, { ...withoutDeadline(context), readOnly: true, randomSeed: 1 }).text);
}
