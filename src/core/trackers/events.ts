/**
 * The Events tracker, RoleCall's `parallelEvents` module (stores/immersion/parallel-events.ts, ParallelEventsWingPanel.tsx, the prompt line at
 * immersion-context.ts:269-282): things that happen elsewhere while the scene goes on, with their urgency, the people in them and how they end. Pure: the panel
 * computes the next state with `applyEvents` and the scene keeps it (ChatStore rule 43). Events come from Generate and Refresh, which only propose (generate.ts).
 *
 * Differences from RoleCall: Delete marks the event and leaves an Undo; a full list (200) refuses another where RoleCall drops the oldest;
 * RoleCall's updateEvent quietly CREATES an event when it is given an id it does not know, and here a refresh of a missing event changes nothing.
 */
import { arr, bool, dflt, num, obj, oneOf, opt, str, type Of } from "./shape";
import { appendItem, find, hasUniqueIds, liveOf, markRemoved, patchItem, unmarkRemoved } from "./list";
import type { GenSpec } from "./generate";
import { entry, listOf, norm, sync, type RefreshSpec } from "./refresh";

export const URGENCIES = ["low", "medium", "high", "critical"] as const;
export const PLOT_CATEGORIES = ["immediate", "looming", "completed"] as const;
export const AWARENESS = ["unaware", "suspicious", "aware"] as const;
export type Urgency = (typeof URGENCIES)[number];

const MAX_EVENTS = 200;
const text = (max: number, o: { min?: number; def?: string } = {}) => str({ max, ...o });
const npc = obj({ name: text(80, { min: 1 }), role: opt(text(80)), status: opt(text(80)) });
const fields = {
  title: text(200, { min: 1 }),
  description: text(2000, { def: "" }),
  locationName: text(120, { def: "Unknown" }),
  urgency: oneOf(URGENCIES, "medium"),
  canIntervene: bool({ def: true }),
  involvedNpcs: dflt(arr(npc, 20), []),
  plotCategory: opt(oneOf(PLOT_CATEGORIES)),
  isHidden: opt(bool()),
  playerAwareness: opt(oneOf(AWARENESS)),
};
const eventShape = obj({
  ...fields,
  id: text(80, { min: 1 }),
  startedAt: num({ lo: 0, hi: 1e15 }),
  isOngoing: bool(),
  estimatedDuration: opt(text(100)),
  potentialOutcomes: opt(arr(text(300, { min: 1 }), 20)),
  actualOutcome: opt(text(1000)),
  resolvedAt: opt(num({ lo: 0, hi: 1e15 })),
  removedAt: opt(num({ lo: 0, hi: 1e15 })),
});
export type Ev = Omit<Of<typeof eventShape>, "id" | "startedAt" | "isOngoing" | "resolvedAt" | "removedAt" | "actualOutcome"> & Partial<Pick<Of<typeof eventShape>, "estimatedDuration" | "potentialOutcomes">>;
type Stored = Of<typeof eventShape>;
export interface Events { events: Stored[] }
export const DEFAULT_EVENTS: Events = { events: [] };

const stateShape = obj({ events: arr(eventShape, MAX_EVENTS * 2) });
export function parseEvents(data: unknown): Events | null {
  const s = stateShape.check(data);
  return s && hasUniqueIds(s.events) ? s : null;
}
export const readEvents = (data: unknown): Events => (data === undefined ? DEFAULT_EVENTS : parseEvents(data) ?? DEFAULT_EVENTS);
const live = (e: Events): Stored[] => liveOf(e.events);
export const ongoing = (e: Events): Stored[] => live(e).filter((x) => x.isOngoing);
export const resolved = (e: Events): Stored[] => live(e).filter((x) => !x.isOngoing);
export const criticalCount = (e: Events): number => ongoing(e).filter((x) => x.urgency === "critical").length;

export type EventsAction =
  | { kind: "add"; event: Ev; id: string; at: number }
  | { kind: "refresh"; id: string; event: Ev }
  | { kind: "resolve"; id: string; at: number }
  | { kind: "remove"; id: string; at: number }
  | { kind: "restore"; id: string };

/** One panel action, as RoleCall's store does it (parallel-events.ts:addEvent, updateEvent, resolveEvent, removeEvent), returning the next state; the same state when nothing changes. */
export function applyEvents(e: Events, a: EventsAction): Events {
  switch (a.kind) {
    case "add": {
      const events = appendItem(e.events, { ...a.event, id: a.id, startedAt: a.at, isOngoing: true } as Stored, MAX_EVENTS);
      return events ? { events } : e;
    }
    case "refresh": return { events: patchItem(e.events, a.id, (x) => ({ ...x, ...a.event })) };
    case "resolve": return find(e.events, a.id)?.isOngoing ? { events: patchItem(e.events, a.id, (x) => ({ ...x, isOngoing: false, resolvedAt: a.at })) } : e;
    case "remove": return find(e.events, a.id) ? { events: markRemoved(e.events, a.id, a.at) } : e;
    case "restore": return { events: unmarkRemoved(e.events, a.id) };
  }
}

const ORDER: Readonly<Record<Urgency, number>> = { critical: 0, high: 1, medium: 2, low: 3 };

/** The narrator's Parallel Events line (immersion-context.ts:269-282): how many are ongoing and the two most urgent. Nothing when none is ongoing. */
export function eventsLines(e: Events): string[] {
  const on = ongoing(e);
  if (on.length === 0) return [];
  const top = [...on].sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency]).slice(0, 2);
  return [`**Parallel Events**: ${on.length} ongoing | ${top.map((x) => `"${x.title}" (${x.urgency})`).join(", ")}`];
}

/** RoleCall's schema text for a `parallelEvents` entry (generate-tracker-item/route.ts, moduleSchemas.parallelEvents). */
export const EVENTS_GEN: GenSpec<Ev> = {
  description: () => "Parallel event entry with story ledger categorization",
  schema: () => `{
  "title": string,
  "description": string,
  "locationName": string,
  "urgency": "low" | "medium" | "high" | "critical",
  "canIntervene": boolean,
  "involvedNpcs": [{ "name": string, "role": string }],
  "plotCategory": "immediate" | "looming" | "completed",
  "isHidden": boolean,
  "playerAwareness": "unaware" | "suspicious" | "aware"
}`,
  item: obj(fields) as GenSpec<Ev>["item"],
};

/** Refresh from chat history (RoleCall initialize-trackers moduleInstructions.parallelEvents). */
export const EVENTS_REFRESH: RefreshSpec = {
  maxTokens: 4000,
  instruction: (subs) => `List any events happening elsewhere that the protagonist is aware of but not directly involved in. Categorize them by plot importance (immediate=happening now, looming=building tension, completed=recently resolved).
Format: { "events": [${EVENTS_GEN.schema(subs)}] }`,
  rows: (d) => live(readEvents(d)).map((e) => entry("events", e.title, EVENTS_GEN.item.coerce(e) ?? e)),
  next(d, a, env) {
    const made = listOf(a, "events", EVENTS_GEN.item, env);
    if (!made) return null;
    const e = readEvents(d);
    return sync(e, live(e), made, (x: { title: string }) => norm(x.title), {
      refresh: (s, old, event) => applyEvents(s, { kind: "refresh", id: old.id, event }),
      add: (s, event) => applyEvents(s, { kind: "add", event, id: env.id(), at: env.now }),
      remove: (s, old) => env.skipped.length > 0 ? s : applyEvents(s, { kind: "remove", id: old.id, at: env.now }),
    });
  },
};
