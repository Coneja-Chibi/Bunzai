/**
 * What a tracker adds to a reply, read off the real pipeline with sample values: the "### Trackers" block the AI reads each turn (the tracker
 * at its starting values, its prompt line run read-only by the macro engine exactly as prompt assembly does), the plain line that block falls
 * back to, the tracker's line inside the shared `update_trackers` tool, and what both cost in tokens. A list is shown with one sample row.
 * A prompt line the engine reports a problem with is shown as the engine renders it, with the problem in words beside it.
 */
import { createDefaultContext, processMacros } from "../../../../core/macros";
import { linkedTrackersText } from "../../../../core/assembly/trackers";
import { refreshTrackerTexts, renderTracker, trackerState, trackerViews, updateTrackersTool, type TrackerValue } from "../../../../core/tracker";
import { countText } from "../../../../core/tokens";
import type { TrackerBody } from "../../../../entities/tracker/schema";

/** The name the sample row of a list goes by. */
const SAMPLE_ROW = "Example";
const SAMPLE_ID = "sample";
/** The tracker macro's words for a tracker that is not linked (handlers/tracker.ts). */
const OTHER_TRACKER = /^There is no tracker named (.+?). (?:No tracker is linked|Trackers:)/;

export interface TrackerPreview {
  /** The block the AI reads, header included. */
  text: string;
  /** The default rendering a blank prompt line falls back to. */
  plain: string;
  /** The first problem the engine reports with the prompt line, or null. */
  error: string | null;
  /** The first problem that would stay a problem in the scene. A macro naming another tracker is not one, since that tracker may be linked there; see `others`. */
  blocking: string | null;
  /** The names of other trackers the prompt line reads, which are not linked in this preview. Whether such a name is a real tracker is for the library to say. */
  others: string[];
  /** The tracker's line in `update_trackers`. */
  toolLine: string;
  /** Tokens the block and the tool line add to every reply. */
  tokens: number;
}

/** The tracker at its starting values; a list gets one row so its line shows what a row reads like. */
function sampleValue(body: TrackerBody): TrackerValue {
  const record = trackerState({}, SAMPLE_ID, { ...body, layout: "record" }).shown as Record<string, string | number | boolean>;
  return body.layout === "record" ? record : [{ name: SAMPLE_ROW, ...record }];
}

const made = new WeakMap<TrackerBody, TrackerPreview>();

/** The preview of this draft; the same draft is built once, however many parts of the editor ask. */
export function trackerPreview(body: TrackerBody): TrackerPreview {
  const known = made.get(body);
  if (known) return known;
  const built = buildPreview(body);
  made.set(body, built);
  return built;
}

function buildPreview(body: TrackerBody): TrackerPreview {
  const shown = sampleValue(body);
  const views = trackerViews([{ id: SAMPLE_ID, body, shown, stored: shown }]);
  const context = createDefaultContext({ trackers: views });
  let error: string | null = null;
  let blocking: string | null = null;
  const others: string[] = [];
  refreshTrackerTexts(views, (template) => {
    const done = processMacros(template, { ...context, readOnly: true, randomSeed: 1 });
    error = done.errors[0]?.message ?? null;
    blocking = done.errors.find((e) => !OTHER_TRACKER.test(e.message))?.message ?? null;
    others.push(...done.errors.flatMap((e) => OTHER_TRACKER.exec(e.message)?.[1] ?? []));
    return done.text;
  });
  const text = linkedTrackersText(views.values());
  const toolLine = updateTrackersTool([body]).description.split("\n").slice(1).join("\n");
  return { text, plain: renderTracker(body, shown), error, blocking, others, toolLine, tokens: countText(text) + countText(toolLine) };
}
