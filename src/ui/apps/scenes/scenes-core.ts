/**
 * The Scenes list's pure logic: RoleCall's time filters (All Time / Week / Month / Year), its two
 * orders (Recent / Messages), the search over title and character, relative times, and the P3
 * gamified list's own grouping - the cast rail, Fan Favorites, the This Week / Earlier split, the
 * folder/character/smart-folder filter, take-strip pips, and a folder's deterministic tint (no
 * color is stored per folder - src/stage/contracts/chat-store.ts's SceneFolder has none).
 */
import type { SceneSummary } from "../../../studio/scenes";
import { plural } from "../../../core/text";

export type Period = "all" | "week" | "month" | "year";
export type SceneOrder = "recent" | "messages";
export type CharSort = "recent" | "az" | "messages";
export type SmartFolder = "longest";

const DAY = 86_400_000;
const SPAN: Record<Period, number> = { all: Infinity, week: 7 * DAY, month: 30 * DAY, year: 365 * DAY };

/** `alsoIds`: scenes a search of the chat summaries found, shown beside the title and character matches. */
export function shownScenes(all: readonly SceneSummary[], opts: { period: Period; order: SceneOrder; query: string; now: number; alsoIds?: ReadonlySet<string> }): SceneSummary[] {
  const q = opts.query.trim().toLowerCase();
  return all
    .filter((s) => opts.now - s.updatedAt <= SPAN[opts.period])
    .filter((s) => !q || s.title.toLowerCase().includes(q) || s.characterName.toLowerCase().includes(q) || opts.alsoIds?.has(s.id) === true)
    .sort((a, b) => (opts.order === "messages" ? b.messageCount - a.messageCount : 0) || b.updatedAt - a.updatedAt);
}

/** RoleCall's relative times: "3 minutes", "about 2 hours", "3 days", "about 1 month". */
export function since(then: number, now: number): string {
  const min = Math.max(0, Math.round((now - then) / 60_000));
  if (min < 1) return "less than a minute";
  if (min < 45) return plural(min, "minute");
  if (min < 1440) return `about ${plural(Math.round(min / 60), "hour")}`;
  if (min < 43_200) return plural(Math.round(min / 1440), "day");
  if (min < 525_600) return `about ${plural(Math.round(min / 43_200), "month")}`;
  return `about ${plural(Math.round(min / 525_600), "year")}`;
}

/** The short form the On Stage list shows: "3m", "2h", "3d", "4mo", "1y". */
export function sinceShort(then: number, now: number): string {
  const min = Math.max(0, Math.round((now - then) / 60_000));
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  if (min < 43_200) return `${Math.round(min / 1440)}d`;
  if (min < 525_600) return `${Math.round(min / 43_200)}mo`;
  return `${Math.round(min / 525_600)}y`;
}

export interface CastTile {
  characterId: string;
  name: string;
  /** the character's most recently updated scene, for the tile's art and its click target */
  latestSceneId: string;
  hasPortrait: boolean;
  /** immutable chat snapshot selector for frozen art; zero uses the live piece receipt */
  snapshotVersion: number;
  count: number;
  /** true when this character's latest scene is the single most recently updated scene overall */
  playing: boolean;
  /** the character's own signature color, from its most recent scene's frozen cast; absent falls
   * back to the character deck's pastel (P3b UI). */
  accent?: string;
}

/** One tile per distinct cast character, most recent first (`scenes` must already be newest-first,
 * as listScenes hands it over - the rail never re-sorts by a filter's own order). */
export function castRail(scenes: readonly SceneSummary[]): CastTile[] {
  const heroId = scenes[0]?.id;
  const byChar = new Map<string, CastTile>();
  for (const s of scenes) {
    const id = s.cast.character.id;
    const tile = byChar.get(id);
    if (tile) tile.count++;
    else byChar.set(id, { characterId: id, name: s.characterName, latestSceneId: s.id, hasPortrait: s.hasPortrait, snapshotVersion: s.snapshotVersion, count: 1, playing: s.id === heroId, accent: s.accent });
  }
  return [...byChar.values()];
}

export interface WeekSplit {
  thisWeek: SceneSummary[];
  earlier: SceneSummary[];
}

/** Scenes updated within 7 days vs. older, each half kept in the newest-first order it arrived in. */
export function splitByWeek(scenes: readonly SceneSummary[], now: number): WeekSplit {
  const thisWeek: SceneSummary[] = [];
  const earlier: SceneSummary[] = [];
  for (const s of scenes) (now - s.updatedAt <= 7 * DAY ? thisWeek : earlier).push(s);
  return { thisWeek, earlier };
}

/** Starred scenes, newest star first. */
export function fanFavorites(scenes: readonly SceneSummary[]): SceneSummary[] {
  return scenes.filter((s): s is SceneSummary & { favoredAt: number } => s.favoredAt !== undefined)
    .sort((a, b) => b.favoredAt - a.favoredAt);
}

/** The grid's filter: a character, a folder, or a smart folder (mutually exclusive - the rail only
 * ever asks for one at a time). `smart: "longest"` reorders by message count; a character or folder
 * filter keeps the scenes' incoming (newest-first) order. */
export function filterScenes(scenes: readonly SceneSummary[], opts: { character?: string; folder?: string; smart?: SmartFolder }): SceneSummary[] {
  if (opts.smart === "longest") return [...scenes].sort((a, b) => b.messageCount - a.messageCount);
  if (opts.character) return scenes.filter((s) => s.cast.character.id === opts.character);
  if (opts.folder) return scenes.filter((s) => s.folderId === opts.folder);
  return [...scenes];
}

/** The character page's own sort pills: Recent, A-Z, Messages. */
export function sortScenes(scenes: readonly SceneSummary[], order: CharSort): SceneSummary[] {
  const sorted = [...scenes];
  if (order === "az") sorted.sort((a, b) => a.title.localeCompare(b.title));
  else if (order === "messages") sorted.sort((a, b) => b.messageCount - a.messageCount);
  else sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted;
}

/** The take strip's pips: at most 5 dots, then a "+N" overflow count. */
export function takePips(count: number): { pips: number; overflow: number } {
  const pips = Math.max(1, Math.min(count, 5));
  return { pips, overflow: count > 5 ? count - 5 : 0 };
}

const FOLDER_TINTS = ["--deck-character", "--deck-lorebook", "--deck-persona", "--deck-pack", "--deck-preset", "--deck-regex"] as const;

/** A folder's chip color: SceneFolder stores no color, so one is picked deterministically from the
 * app's six deck pastels by hashing the folder's own id - stable across reloads, never persisted. */
export function folderTint(folderId: string): string {
  let hash = 0;
  for (let i = 0; i < folderId.length; i++) hash = (hash * 31 + folderId.charCodeAt(i)) | 0;
  return `var(${FOLDER_TINTS[Math.abs(hash) % FOLDER_TINTS.length]})`;
}
