/**
 * The Quest Board dossier (RoleCall `lib/compendium/dossiers/quests.ts`): the book's plots as quests, sorted by urgency, with their objectives, links
 * and deadline, and the digest the narrator reads. Built from plot entries alone; RoleCall's journal-only quests, recent history and promotion
 * candidates come from the Story Director's journal, which is not here. Its "[USE]" line that tells the model to name slugs in tool calls is left out:
 * the narrator has no tools.
 */
import { isRecord, type Rec } from "../../guards";
import type { CompendiumEntry } from "../read";
import { aiContext, clamp, entriesOfType, lineLimit, readArray, readBool, readNumber, readString, readStrings, slug, type ContextProfile, type DossierAiContext } from "./base";

export interface QuestObjective { id: string; slug: string; description: string; status: "done" | "open" | "failed" | "blocked"; meta: string | null }
export interface QuestItem {
  id: string; slug: string; name: string; status: string; type: string | null; description: string | null; tagline: string | null;
  urgency: number; deadline: string | null; progress: string | null; characters: string[]; locations: string[]; items: string[]; objectives: QuestObjective[];
}
export interface QuestsDossier {
  type: "quests"; title: "Quest Board";
  stats: { active: number; blocked: number; imminentDeadlines: number; linkedCharacters: number; failurePressure: number; rewardBacklog: number };
  critical: QuestItem[]; active: QuestItem[]; blocked: QuestItem[]; completed: QuestItem[]; failed: QuestItem[];
  ai: DossierAiContext;
}

const ACTIVE = new Set(["not_started", "active", "stalled", "escalating", "in_progress", "ongoing"]);
const BLOCKED = new Set(["blocked", "stalled"]);
const DONE = new Set(["completed", "complete", "done", "resolved"]);
const FAILED = new Set(["failed", "abandoned", "lost"]);
const normalizeStatus = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, "_");
const DEADLINE = ["deadline", "due", "due_date", "time_limit"] as const;

function objectiveStatus(raw: string): QuestObjective["status"] {
  const s = normalizeStatus(raw);
  return DONE.has(s) ? "done" : FAILED.has(s) ? "failed" : BLOCKED.has(s) ? "blocked" : "open";
}

function readObjectives(sd: Rec): QuestObjective[] {
  return readArray(sd, ["objectives", "steps", "conditions", "goals"]).map((raw, i): QuestObjective => {
    if (typeof raw === "string") return { id: `obj-${i}`, slug: slug(raw) === "untitled" ? `objective-${i + 1}` : slug(raw), description: raw, status: "open", meta: null };
    if (!isRecord(raw)) return { id: `obj-${i}`, slug: `objective-${i + 1}`, description: "Untitled objective", status: "open", meta: null };
    const o = raw;
    const description = readString(o, ["description", "text", "title", "name"]) ?? "Untitled objective";
    const status = readString(o, ["status", "state"]) ?? (o["completed"] === true ? "done" : "open");
    return { id: readString(o, ["id"]) ?? `obj-${i}`, slug: readString(o, ["slug"]) ?? (slug(description) === "untitled" ? `objective-${i + 1}` : slug(description)), description, status: objectiveStatus(status), meta: readString(o, ["deadline", "meta", "note"]) };
  });
}

/** RoleCall's urgency (quests.ts:computeUrgency): an explicit 0 to 100, else 30 plus what the status, deadline, type and blocked objectives add. */
function urgencyOf(sd: Rec, status: string, objectives: readonly QuestObjective[]): number {
  const explicit = readNumber(sd, ["urgency", "pressure", "failure_pressure"]);
  if (explicit !== null) return clamp(explicit, 0, 100);
  const s = normalizeStatus(status);
  let score = 30;
  if (BLOCKED.has(s)) score += 20;
  if (FAILED.has(s) || DONE.has(s)) score -= 25;
  if (readString(sd, DEADLINE)) score += 25;
  if (readString(sd, ["type", "quest_type"]) === "main") score += 20;
  if (objectives.some((o) => o.status === "blocked")) score += 10;
  return clamp(score, 0, 100);
}

function questOf(entry: CompendiumEntry): QuestItem {
  const sd = entry.data;
  const status = readString(sd, ["status"]) || "active";
  const objectives = readObjectives(sd);
  const done = objectives.filter((o) => o.status === "done").length;
  return {
    id: entry.id, slug: slug(entry.name), name: entry.name, status, type: readString(sd, ["type", "quest_type", "arc_type"]),
    description: readString(sd, ["description", "summary"]), tagline: readString(sd, ["tagline", "current_progress"]),
    urgency: urgencyOf(sd, status, objectives), deadline: readString(sd, DEADLINE),
    progress: readString(sd, ["current_progress", "progress"]) ?? (objectives.length > 0 ? `${done} / ${objectives.length}` : null),
    characters: readStrings(sd, ["central_characters", "linked_characters", "characters", "participants"]),
    locations: readStrings(sd, ["key_locations", "linked_locations", "locations"]), items: readStrings(sd, ["key_items", "linked_items", "items"]),
    objectives,
  };
}

function objectiveHandles(lines: string[], quest: QuestItem): void {
  const open = quest.objectives.filter((o) => o.status !== "done").slice(0, 4);
  if (open.length > 0) lines.push(`  objectives: ${open.map((o) => `{${o.slug}}=${o.status}`).join(", ")}`);
}

/** The narrator's digest (quests.ts:formatQuestAiContext), RoleCall's lines in RoleCall's order. */
function digest(d: Pick<QuestsDossier, "critical" | "active" | "blocked" | "failed">, profile: ContextProfile): string[] {
  const lines = ["[QUEST BOARD]"];
  if (d.critical.length > 0) {
    lines.push("[CRITICAL]");
    for (const q of d.critical.slice(0, lineLimit(profile, 4))) { lines.push(`- {${q.slug}} ${q.name}: ${q.progress ?? q.status}${q.deadline ? `; deadline ${q.deadline}` : ""}.`); objectiveHandles(lines, q); }
  }
  if (d.active.length > 0) {
    lines.push("[ACTIVE]");
    for (const q of d.active.slice(0, lineLimit(profile, 5))) { lines.push(`- {${q.slug}} ${q.name}: ${q.tagline ?? q.description ?? q.status}.`); if (profile.mode !== "compact") objectiveHandles(lines, q); }
  }
  if (profile.mode !== "compact" && d.blocked.length > 0) {
    lines.push("[BLOCKED]");
    for (const q of d.blocked.slice(0, lineLimit(profile, 4))) lines.push(`- {${q.slug}} ${q.name}: blocked${q.characters.length ? `; linked ${q.characters.slice(0, 3).join(", ")}` : ""}.`);
  }
  if ((profile.mode === "full" || profile.mode === "radius") && d.failed.length > 0) {
    lines.push("[FAILURES]");
    for (const q of d.failed.slice(0, lineLimit(profile, 3))) lines.push(`- {${q.slug}} ${q.name}: ${q.status}.`);
  }
  lines.push("[USE]", "- Keep active goals alive in narration without resolving them for the user.", "- Let missed deadlines and failures create visible consequences.");
  return lines;
}

export function buildQuests(entries: readonly CompendiumEntry[], profile: ContextProfile): QuestsDossier {
  const quests = entriesOfType(entries, "plot").map(questOf).sort((a, b) => b.urgency - a.urgency);
  const critical = quests.filter((q) => q.urgency >= 75 || q.type === "main" || q.type === "urgent");
  const blocked = quests.filter((q) => BLOCKED.has(normalizeStatus(q.status)));
  const completed = quests.filter((q) => DONE.has(normalizeStatus(q.status)));
  const failed = quests.filter((q) => FAILED.has(normalizeStatus(q.status)));
  const active = quests.filter((q) => ACTIVE.has(normalizeStatus(q.status)) && !blocked.includes(q) && !completed.includes(q) && !failed.includes(q));
  const live = quests.filter((q) => !DONE.has(normalizeStatus(q.status)) && !FAILED.has(normalizeStatus(q.status)));
  const sourceOf = (q: QuestItem): Rec => entries.find((e) => e.id === q.id)?.data ?? {};
  const dossier: Omit<QuestsDossier, "ai"> = {
    type: "quests", title: "Quest Board",
    stats: {
      active: active.length + critical.length, blocked: blocked.length, imminentDeadlines: live.filter((q) => q.urgency >= 70).length,
      linkedCharacters: new Set(quests.flatMap((q) => q.characters.map((c) => c.toLowerCase()))).size,
      failurePressure: live.length === 0 ? 0 : Math.round(live.reduce((n, q) => n + q.urgency, 0) / live.length),
      rewardBacklog: completed.filter((q) => readBool(sourceOf(q), ["reward_pending", "unrewarded", "reward_backlog"])).length,
    },
    critical, active, blocked, completed, failed,
  };
  return { ...dossier, ai: aiContext(digest(dossier, profile), profile) };
}
