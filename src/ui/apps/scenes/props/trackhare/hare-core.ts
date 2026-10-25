/**
 * TrackHare's pure rules (design/wireframes/props/trackhare.html; th-contract.md): grouping injected
 * hits by book, sorting them, the reason badge each hit wears, the Chains grouping, the badge count,
 * and the button's saved position/size (parsed fail-closed, clamped into the stage). No React, no IO.
 */
import type { IconName } from "../../../../_shared/ic";
import type { SceneLoreReason, SceneTrace, TraceLoreHit } from "../../../../app-contract-scenes";
import { boolOr } from "../../../../../core/guards";

export type SortMode = "placement" | "az" | "size";
export type Density = "detailed" | "compact";

export interface BookGroup {
  bookName: string;
  hits: TraceLoreHit[];
}

/** Injected hits grouped by book, each book in the order it first appears (placement order). */
export function bookGroups(hits: readonly TraceLoreHit[]): BookGroup[] {
  const order: string[] = [];
  const by = new Map<string, TraceLoreHit[]>();
  for (const hit of hits) {
    if (!by.has(hit.bookName)) {
      by.set(hit.bookName, []);
      order.push(hit.bookName);
    }
    by.get(hit.bookName)!.push(hit);
  }
  return order.map((bookName) => ({ bookName, hits: by.get(bookName)! }));
}

/** Placement keeps the trace's own order; A to Z sorts by title; Size sorts by tokens, largest first. */
export function sortHits(hits: readonly TraceLoreHit[], mode: SortMode): TraceLoreHit[] {
  if (mode === "az") return [...hits].sort((a, b) => a.title.localeCompare(b.title));
  if (mode === "size") return [...hits].sort((a, b) => b.tokens - a.tokens);
  return [...hits];
}

export interface ReasonBadge {
  icon: IconName;
  tone: string;
  text: string;
}

const REASON_LOOK: Record<SceneLoreReason, { icon: IconName; tone: string }> = {
  constant: { icon: "lucide:pin", tone: "var(--stage-macro)" },
  key: { icon: "lucide:key", tone: "var(--stage-ok)" },
  secondary: { icon: "lucide:key", tone: "var(--stage-ok)" },
  recursion: { icon: "lucide:link", tone: "var(--deck-lorebook)" },
  sticky: { icon: "lucide:clock", tone: "var(--stage-danger-text)" },
  special: { icon: "lucide:key", tone: "var(--stage-var)" },
  emotion: { icon: "lucide:key", tone: "var(--stage-var)" },
};

/** "2 turns left", singular "turn" for 1 (th-t4-gaps 2). */
const turnsLeft = (n: number): string => `${n} turn${n === 1 ? "" : "s"} left`;

/**
 * The hit row's reason icon, left-edge color, and badge text. Recursion names who woke it (from
 * `chains`, matched by title) and the loop. A sticky hit's `stickyLeft` (th-t4-gaps 2, from the fired
 * verdict's own detail) adds the wireframe's "STICKY: N turns left"; without it (an old trace), the
 * badge falls back to plain "STICKY".
 */
export function reasonBadge(hit: TraceLoreHit, chains: readonly { from: string; to: string; keyword: string }[]): ReasonBadge {
  const { icon, tone } = REASON_LOOK[hit.reason];
  const word = hit.matched[0];
  if (hit.reason === "constant") return { icon, tone, text: "ALWAYS ON" };
  if (hit.reason === "sticky") return { icon, tone, text: hit.stickyLeft === undefined ? "STICKY" : `STICKY: ${turnsLeft(hit.stickyLeft)}` };
  if (hit.reason === "recursion") {
    const from = chains.find((c) => c.to === hit.title)?.from ?? "another entry";
    return { icon, tone, text: `WOKEN BY: ${from} (loop ${hit.loop})` };
  }
  return { icon, tone, text: word ? `KEY: "${word}"` : hit.reason.toUpperCase() };
}

/** A chance roll adds its own badge (in `--stage-warn`), on top of whatever the reason badge says. */
export function rollBadge(hit: TraceLoreHit): { text: string; tone: string } | null {
  if (!hit.roll) return null;
  return { text: `CHANCE: rolled ${hit.roll.rolled}, needed ${hit.roll.needed}`, tone: "var(--stage-warn)" };
}

/** The button's badge: entries actually injected (lore that fired, and entries the Compendium recalled), never entries cut for space. */
export const badgeCount = (trace: SceneTrace | null): number => (trace?.lore?.injected.length ?? 0) + (trace?.recall?.injected.length ?? 0);

// -- Chains ------------------------------------------------------------------------------------------

export type ChainGroupName = "starters" | "links" | "ends" | "standalone";

export interface ChainRow {
  title: string;
  lines: string[];
}

export type ChainGroups = Record<ChainGroupName, ChainRow[]>;

/**
 * Starters fired directly and woke others; links were woken and woke others; ends were woken and
 * woke nothing; standalone neither woke nor was woken. Classified over this reply's injected hits by
 * title, against `chains`'s from/to edges.
 */
export function chainGroups(lore: NonNullable<SceneTrace["lore"]>): ChainGroups {
  const groups: ChainGroups = { starters: [], links: [], ends: [], standalone: [] };
  for (const hit of lore.injected) {
    const incoming = lore.chains.filter((c) => c.to === hit.title);
    const outgoing = lore.chains.filter((c) => c.from === hit.title);
    const woken = incoming.length > 0;
    const wokeOthers = outgoing.length > 0;
    const lines = [
      ...incoming.map((c) => `woken by ${c.from} (loop ${hit.loop})`),
      ...outgoing.map((c) => `woke ${c.to} with "${c.keyword}"`),
    ];
    const row: ChainRow = { title: hit.title, lines: lines.length > 0 ? lines : [reasonBadge(hit, lore.chains).text.toLowerCase()] };
    const which: ChainGroupName = woken && wokeOthers ? "links" : wokeOthers ? "starters" : woken ? "ends" : "standalone";
    groups[which].push(row);
  }
  return groups;
}

// -- The button's saved place -------------------------------------------------------------------------

export interface ButtonRect {
  x: number;
  y: number;
  size: number;
}

export const DEFAULT_BUTTON_RECT: ButtonRect = { x: 96, y: 28, size: 48 };
export const MIN_BUTTON_SIZE = 40;
export const MAX_BUTTON_SIZE = 96;

/** Fail-closed: anything that is not a well-formed rect answers null (the caller falls back to default). */
export function parseButtonRect(value: unknown): ButtonRect | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.x !== "number" || typeof r.y !== "number" || typeof r.size !== "number") return null;
  if (!Number.isFinite(r.x) || !Number.isFinite(r.y) || !Number.isFinite(r.size)) return null;
  return { x: r.x, y: r.y, size: r.size };
}

/** Keeps the button on the stage: size clamped to 40..96, position clamped so the whole square stays
 * inside the container. A 0x0 container (not yet measured, or JSDOM) skips position clamping. */
export function clampButtonRect(rect: ButtonRect, container: { width: number; height: number }): ButtonRect {
  const size = Math.min(MAX_BUTTON_SIZE, Math.max(MIN_BUTTON_SIZE, rect.size));
  if (container.width <= 0 || container.height <= 0) return { x: rect.x, y: rect.y, size };
  const x = Math.min(Math.max(0, rect.x), Math.max(0, container.width - size));
  const y = Math.min(Math.max(0, rect.y), Math.max(0, container.height - size));
  return { x, y, size };
}

export const parseSort = (value: unknown): SortMode => (value === "az" || value === "size" ? value : "placement");
export const parseDensity = (value: unknown): Density => (value === "compact" ? "compact" : "detailed");
