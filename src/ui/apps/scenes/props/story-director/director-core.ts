/**
 * What the Story Director panel decides before it draws (RoleCall's StoryDirectorWingPanel.tsx helpers and story-director-tabs.ts): the five tabs, how arcs group
 * under their chapter and by horizon, the activity filters and labels, the "n/threshold" overdue badge, and the relative time. Pure, so each rule is provable without a render.
 * RoleCall's colors become theme roles (sky is info, emerald is ok, red is danger, amber is warn, violet is brand, fuchsia is select, orange is action).
 */
import type { IconName } from "../../../../_shared/ic";
import type { DirectorActivity, DirectorActivityType, DirectorArc, DirectorChapter, DirectorHorizon, DirectorSeed } from "../../../../../stage/contracts/director-types";

export const DIRECTOR_TABS = [
  { id: "story", label: "Story", icon: "lucide:book-open" },
  { id: "arcs", label: "Arcs", icon: "lucide:git-branch" },
  { id: "analysis", label: "Analysis", icon: "lucide:brain" },
  { id: "activity", label: "Activity", icon: "lucide:activity" },
  { id: "debug", label: "Debug", icon: "lucide:bug" },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];
export type DirectorTabId = (typeof DIRECTOR_TABS)[number]["id"];

export const ACTIVITY_LABELS: Readonly<Record<DirectorActivityType, string>> = {
  turn_start: "Turn Start", turn_finish: "Turn Done", turn_error: "Turn Error", arc: "Arc", seed: "Seed", invisible_arc: "Invisible Arc", directive: "Directive", momentum: "Momentum", edit: "Edit", tracker: "Tracker",
};
/** The theme role each activity type is drawn in (RoleCall's DM_ACTIVITY_COLORS). */
export const ACTIVITY_TONES: Readonly<Record<DirectorActivityType, string>> = {
  turn_start: "var(--bk-role-info-text)", turn_finish: "var(--stage-ok)", turn_error: "var(--stage-danger-text)", arc: "var(--stage-warn)", seed: "var(--bk-role-ok-text)",
  invisible_arc: "var(--bk-role-select-text)", directive: "var(--bk-role-brand-text)", momentum: "var(--bk-role-action-text)", edit: "var(--stage-soft)", tracker: "var(--bk-role-info-text)",
};
export const RESULT_TONES = { success: "var(--stage-ok)", error: "var(--stage-danger-text)", info: "var(--bk-role-info-text)" } as const;

export type ActivityFilter = "all" | "turns" | "tools" | "planning";
export const ACTIVITY_FILTERS: readonly { id: ActivityFilter; label: string }[] = [{ id: "all", label: "All" }, { id: "turns", label: "Turns" }, { id: "tools", label: "Tools" }, { id: "planning", label: "Planning" }];
const FILTER_TYPES: Readonly<Record<Exclude<ActivityFilter, "all">, readonly DirectorActivityType[]>> = {
  turns: ["turn_start", "turn_finish", "turn_error"], tools: ["arc", "seed", "invisible_arc", "tracker"], planning: ["directive", "momentum"],
};

/** Newest first, as RoleCall's store lists them; the state keeps them oldest first. */
export function activityNewestFirst(list: readonly DirectorActivity[], filter: ActivityFilter = "all"): DirectorActivity[] {
  const kept = filter === "all" ? list : list.filter((a) => FILTER_TYPES[filter].includes(a.type));
  return [...kept].reverse();
}

export function formatAgo(at: number, now: number): string {
  const diff = Math.max(0, Math.floor((now - at) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/** The floating button's badge: entries from the last five minutes. */
export const recentCount = (list: readonly DirectorActivity[], now: number): number => list.filter((a) => a.at > now - 5 * 60_000).length;
/** How long the button's border pulses after a new entry (RoleCall PULSE_ACTIVE_WINDOW_MS). */
export const PULSE_MS = 6_000;

/** Turns a seed or hidden arc may sit before RoleCall paints its counter red. */
export const OVERDUE_AT: Readonly<Record<DirectorHorizon, number>> = { immediate: 1, short: 3, medium: 5, long: 10, epic: 25 };
export const overdueOf = (horizon: DirectorHorizon, turns: number): { text: string; overdue: boolean } => ({ text: `${turns}/${OVERDUE_AT[horizon]}`, overdue: turns >= OVERDUE_AT[horizon] });

const HORIZON_ORDER: Readonly<Record<DirectorHorizon, number>> = { epic: 0, long: 1, medium: 2, short: 3, immediate: 4 };
export const HORIZON_LOOK: Readonly<Record<DirectorHorizon, { icon: IconName; tone: string }>> = {
  epic: { icon: "lucide:crown", tone: "var(--bk-role-select-text)" }, long: { icon: "lucide:mountain", tone: "var(--bk-role-info-text)" }, medium: { icon: "lucide:map-pin", tone: "var(--stage-warn)" },
  short: { icon: "lucide:zap", tone: "var(--stage-ok)" }, immediate: { icon: "lucide:flame", tone: "var(--stage-danger-text)" },
};

export interface ArcGroup { chapterId: string | null; label: string; arcs: DirectorArc[] }
/** RoleCall's groupArcsByChapter: arcs without a chapter first, then each chapter in number order, labelled "Ch. n: title". */
export function groupArcs(arcs: readonly DirectorArc[], chapters: readonly DirectorChapter[]): ArcGroup[] {
  const byId = new Map(chapters.map((c) => [c.id, c]));
  const groups = new Map<string | null, DirectorArc[]>();
  for (const arc of arcs) {
    const key = arc.chapterId && byId.has(arc.chapterId) ? arc.chapterId : null;
    groups.set(key, [...(groups.get(key) ?? []), arc]);
  }
  const loose = groups.get(null);
  const named = [...groups.entries()].filter((e): e is [string, DirectorArc[]] => e[0] !== null).sort((a, b) => (byId.get(a[0])?.number ?? 999) - (byId.get(b[0])?.number ?? 999));
  return [
    ...(loose ? [{ chapterId: null, label: "Unchaptered", arcs: loose }] : []),
    ...named.map(([id, list]) => ({ chapterId: id, label: `Ch. ${byId.get(id)!.number}: ${byId.get(id)!.title}`, arcs: list })),
  ];
}

export interface ArcSections { active: DirectorArc[]; completed: DirectorArc[]; abandoned: DirectorArc[] }
export function sectionArcs(arcs: readonly DirectorArc[]): ArcSections {
  return {
    active: arcs.filter((a) => a.status !== "complete" && a.status !== "abandoned").sort((a, b) => HORIZON_ORDER[a.horizon] - HORIZON_ORDER[b.horizon]),
    completed: arcs.filter((a) => a.status === "complete"),
    abandoned: arcs.filter((a) => a.status === "abandoned"),
  };
}

/** RoleCall's Current Chapter: the one the state points at, else the newest unfinished, else the newest (VVS-720). */
export function currentChapter(chapters: readonly DirectorChapter[], currentId: string | undefined): DirectorChapter | undefined {
  if (chapters.length === 0) return undefined;
  const open = chapters.filter((c) => c.status !== "complete");
  return chapters.find((c) => c.id === currentId) ?? open.at(-1) ?? chapters.at(-1);
}

export type BadgeTone = "ok" | "info" | "warn" | "mute";
/** RoleCall's StatusBadge: active is ok, complete is info, seeding or planned is warn, the rest muted. */
export function statusTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (s.includes("active") || s.includes("in progress")) return "ok";
  if (s.includes("complete")) return "info";
  if (s.includes("seeding") || s.includes("planned")) return "warn";
  return "mute";
}

/** Seed rows RoleCall groups by status; the state keeps a delivered flag, so a seed is planted or resolved. */
export const seedStatus = (s: DirectorSeed): "planted" | "resolved" => (s.payoffDelivered ? "resolved" : "planted");

/** The size readout under the Debug tab: "12.4 KB of 586 KB", and whether it is close to the limit the store enforces. */
export function sizeReadout(size: { bytes: number; max: number }): { text: string; near: boolean } {
  const kb = (n: number): string => `${Math.max(0.1, Math.round(n / 100) / 10)} KB`;
  return { text: `${kb(size.bytes)} of ${kb(size.max)}`, near: size.bytes >= size.max * 0.8 };
}

/** The most characters a note, a hidden arc's title and its text may hold. These mirror studio/scene-director-edit.ts (the page cannot import that server file); director-core.test.ts holds them equal. */
export const NOTE_MAX = 600;
export const HIDDEN_TITLE_MAX = 200;
export const HIDDEN_TEXT_MAX = 1_200;
