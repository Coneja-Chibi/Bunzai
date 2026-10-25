/**
 * What a run of Final Cut keeps with the reply it ran on (the swipe's trace `finalCut`, ChatStore rule 15; turn-loop rule 20) and how
 * the page reads it back. The page gets it from JSON over HTTP, so `readTrace` checks it once and answers a known shape or null; a
 * run the page cannot read is "no run", never a half-drawn dialog. Also the one place the badge's words are made: the worst status of
 * the passes, the tooltip sentence (RoleCall PostProdActivityBadge.tsx:196-253) and a pass's status and description (:120-144).
 */
import { isRecord, numOrNull } from "../guards";
import { plural } from "../text";
import type { DiffSegment } from "./diff";
import type { ChangelogItem, RuleReviewEntry } from "./parse";
import { PASS_TYPES, type PassType } from "./pass";

export interface PassTrace {
  id: string;
  type: PassType;
  label?: string;
  status: "applied" | "skipped" | "failed";
  changed: boolean;
  ms: number;
  model?: string;
  changelog: ChangelogItem[];
  warnings: string[];
  ruleReview?: RuleReviewEntry[];
  reflected?: true;
  diff?: DiffSegment[];
  raw?: string;
}

/** A re-run the person applied to a saved reply (rule 46): the text it replaced, the text it left, and what each pass did. */
export interface RerunEntry { at: number; ms: number; before: string; after: string; passes: PassTrace[] }
/** A reply keeps at most this many applied re-runs. */
export const MAX_RERUNS = 20;

export interface FinalCutTrace {
  v: 1;
  at: number;
  ms: number;
  /** The reply as the model wrote it, kept only when the passes changed it. */
  original?: string;
  stopped?: "cancelled" | "timed_out";
  passes: PassTrace[];
  /** The re-runs the person applied afterwards, oldest first. */
  reruns?: RerunEntry[];
}

const list = <T>(v: unknown, each: (x: unknown) => T | null): T[] | null => {
  if (!Array.isArray(v)) return null;
  const out = v.map(each);
  return out.every((x) => x !== null) ? (out as T[]) : null;
};
const num = numOrNull;
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function readPass(v: unknown): PassTrace | null {
  if (!isRecord(v)) return null;
  const type = PASS_TYPES.find((t) => t === v["type"]);
  const status = v["status"] === "applied" || v["status"] === "skipped" || v["status"] === "failed" ? v["status"] : null;
  const changelog = list(v["changelog"], (c) => (isRecord(c) && str(c["rule"]) !== null && str(c["description"]) !== null ? { rule: c["rule"] as string, description: c["description"] as string } : null));
  const warnings = list(v["warnings"], str);
  const id = str(v["id"]);
  const ms = num(v["ms"]);
  if (!type || !status || !changelog || !warnings || id === null || ms === null || typeof v["changed"] !== "boolean") return null;
  const review = list(v["ruleReview"], (r) => (isRecord(r) && str(r["rule"]) !== null && str(r["reasoning"]) !== null && ["clean", "minor", "ignored", "applied"].includes(r["verdict"] as string) ? (r as unknown as RuleReviewEntry) : null));
  const diff = list(v["diff"], (d) => (isRecord(d) && str(d["text"]) !== null && ["equal", "added", "removed"].includes(d["type"] as string) ? (d as unknown as DiffSegment) : null));
  return {
    id, type, status, changed: v["changed"], ms, changelog, warnings,
    ...(str(v["label"]) ? { label: v["label"] as string } : {}), ...(str(v["model"]) ? { model: v["model"] as string } : {}),
    ...(review ? { ruleReview: review } : {}), ...(v["reflected"] === true ? { reflected: true as const } : {}), ...(diff ? { diff } : {}), ...(str(v["raw"]) !== null ? { raw: v["raw"] as string } : {}),
  };
}

/** A re-run entry, strictly: exactly its five fields. */
export function readRerun(v: unknown): RerunEntry | null {
  if (!isRecord(v) || Object.keys(v).some((k) => !["at", "ms", "before", "after", "passes"].includes(k))) return null;
  const passes = list(v["passes"], readPass);
  const at = num(v["at"]);
  const ms = num(v["ms"]);
  const before = str(v["before"]);
  const after = str(v["after"]);
  return passes && at !== null && ms !== null && before !== null && after !== null ? { at, ms, before, after, passes } : null;
}

export function readTrace(value: unknown): FinalCutTrace | null {
  if (!isRecord(value) || value["v"] !== 1) return null;
  const passes = list(value["passes"], readPass);
  const at = num(value["at"]);
  const ms = num(value["ms"]);
  if (!passes || at === null || ms === null) return null;
  return {
    v: 1, at, ms, passes,
    ...(typeof value["original"] === "string" ? { original: value["original"] } : {}),
    ...(Array.isArray(value["reruns"]) ? { reruns: value["reruns"].map(readRerun).filter((r): r is RerunEntry => r !== null) } : {}),
    ...(value["stopped"] === "cancelled" || value["stopped"] === "timed_out" ? { stopped: value["stopped"] } : {}),
  };
}

export type EffectiveStatus = "applied" | "no-op" | "skipped" | "failed";
export const effectiveStatus = (p: PassTrace): EffectiveStatus => (p.status === "applied" && !p.changed ? "no-op" : p.status);

export const STATUS_LABEL: Readonly<Record<EffectiveStatus, string>> = { applied: "Applied", "no-op": "Ran (no change)", skipped: "Skipped (fallback)", failed: "Failed" };
export const STATUS_DESCRIPTION: Readonly<Record<EffectiveStatus, string>> = {
  applied: "This pass produced a different output than its input. Changes were kept.",
  "no-op": "This pass ran successfully but the model returned the same text it received. No edits applied.",
  skipped: "This pass was skipped (typically: protected syntax was missing from the output, so the original was preserved per the failureMode setting).",
  failed: "This pass errored out. The original text was preserved.",
};
export const PASS_TYPE_LABEL: Readonly<Record<PassType, string>> = { editor: "Editor", "anti-slop": "Anti-Slop", translator: "Translator", "custom-agent": "Custom Agent", validator: "Safety Check" };

/** The passes that ask a model; the safety check is its own thing and is not a "did it run" signal. */
export const modelPasses = (trace: FinalCutTrace): PassTrace[] => trace.passes.filter((p) => p.type !== "validator");

/** The worst status wins the icon: a failure, then a skip, then a pass that changed the text, else nothing changed. */
export function worstStatus(trace: FinalCutTrace): EffectiveStatus {
  const all = modelPasses(trace).map(effectiveStatus);
  return all.includes("failed") ? "failed" : all.includes("skipped") ? "skipped" : all.includes("applied") ? "applied" : "no-op";
}

/** The badge's tooltip (RoleCall's summaryTitle). */
export function summaryTitle(trace: FinalCutTrace): string {
  const all = modelPasses(trace).map(effectiveStatus);
  const count = (s: EffectiveStatus): number => all.filter((x) => x === s).length;
  if (count("failed") > 0) return `${plural(count("failed"), "pass", "passes")} failed, saved as original`;
  if (count("skipped") > 0) return `${plural(count("skipped"), "pass", "passes")} skipped, original preserved`;
  if (count("applied") > 0) return `${plural(count("applied"), "pass", "passes")} applied changes`;
  return "All passes ran, none changed the text";
}

/** "840ms" under a second, "4.2s" above; null for a time that is missing or not a time. */
export function formatDuration(ms: number | undefined): string | null {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  return ms < 1_000 ? `${Math.round(ms)}ms` : `${(ms / 1_000).toFixed(1)}s`;
}

/** The scissors button's name on a reply, from the summary the swipe's generation keeps (no need to load the run to draw it). */
export function badgeLabel(f: { passes: number; changed: boolean; failed: number }): string {
  if (f.failed > 0) return `Final Cut: ${plural(f.failed, "pass", "passes")} failed, original saved`;
  return `Final Cut: ${plural(f.passes, "pass", "passes")} ran, ${f.changed ? "text changed" : "no change"}`;
}
