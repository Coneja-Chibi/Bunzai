/**
 * Reading a pass's answer: the tagged form ([CHANGELOG] and [REFINED] or [TRANSLATED] sections, RoleCall lib/post-gen-actions/parser.ts)
 * and the tool-call form (the arguments of the one tool the pass was forced to call, with the JSON pulled out of the reply's text when a
 * model wrote it there, service.ts:1167-1269). A marker counts only when it sits alone on its line, so a bracketed word inside the body
 * never cuts a section short. RoleCall's rescue of Python-call and prose-envelope shapes is not carried: a model that answers in one of
 * those fails the pass and the failure mode decides.
 */
import { isRecord } from "../guards";
import { escapeRegex } from "../regex/escape";

export interface ChangelogItem { rule: string; description: string }
export interface RuleReviewEntry { rule: string; verdict: "clean" | "minor" | "ignored" | "applied"; reasoning: string }
export interface ParsedTagged { text: string; changelog: ChangelogItem[]; warnings: string[] }

const MARKERS = ["CHANGELOG", "REFINED", "TRANSLATED", "NO_CHANGES_NEEDED", "ALREADY_IN_TARGET"] as const;
export type MarkerName = (typeof MARKERS)[number];

/** One regex for every marker line: any case, decorated with #, *, _, =, dashes, brackets of several kinds, a colon, spaces, or an underscore written as a space, dash or dot. */
function markerLine(): RegExp {
  const names = MARKERS.map((name) => {
    const chunks = name.split("_").map(escapeRegex);
    return chunks.length === 1 ? chunks[0]! : `(?:${chunks.join("[_\\-.\\s]+")})`;
  }).join("|");
  return new RegExp(`^[ \\t]*(?:[#*_=\\-\u2014\u2013]+[ \\t]*)?[\\[\u3010\u300c<]?[ \\t]*(${names})[ \\t]*[\\]\u3011\u300d>\\/]{0,2}[ \\t]*[#*_=\\-\u2014\u2013:]*[ \\t]*$`, "gimu");
}

interface Hit { name: MarkerName; lineStart: number; contentStart: number }

function hitsIn(raw: string): Hit[] {
  const hits: Hit[] = [];
  for (const m of raw.matchAll(markerLine())) {
    if (m.index === undefined) continue;
    const captured = m[1]!.toUpperCase().replace(/[_\-.\s]/g, "");
    const name = MARKERS.find((n) => n.replace(/_/g, "") === captured);
    if (!name) continue;
    let contentStart = m.index + m[0].length;
    if (raw[contentStart] === "\r") contentStart++;
    if (raw[contentStart] === "\n") contentStart++;
    hits.push({ name, lineStart: m.index, contentStart });
  }
  return hits;
}

/** Whether a line of the answer is this marker, however it is decorated. */
export const detectMarker = (raw: string, name: MarkerName): boolean => hitsIn(raw).some((h) => h.name === name);

/** When the whole answer is one code fence with a marker line inside, the fence is the model's decoration: take it off. */
function unwrapFence(raw: string): string {
  const m = raw.trim().match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return m && hitsIn(m[1]!).length > 0 ? m[1]! : raw;
}

function changelogOf(block: string): ChangelogItem[] {
  return block.split(/\r?\n/).map((l) => l.trim().replace(/^[-*]\s*/, "")).filter(Boolean).map((line) => {
    const m = line.match(/^([^:]{1,60}):\s*(.+)$/);
    return m ? { rule: m[1]!.trim(), description: m[2]!.trim() } : { rule: "General", description: line };
  });
}

export function parseTagged(raw: string, tag: "REFINED" | "TRANSLATED"): ParsedTagged {
  const text0 = unwrapFence(raw);
  const hits = hitsIn(text0);
  const section = (name: MarkerName): string => {
    const i = hits.findIndex((h) => h.name === name);
    if (i < 0) return "";
    return text0.slice(hits[i]!.contentStart, hits[i + 1]?.lineStart ?? text0.length).trim();
  };
  const body = section(tag);
  const warnings: string[] = [];
  let text = "";
  if (body) text = body;
  else if (hits.length === 0) {
    text = text0.trim();
    warnings.push(`Model did not include [${tag}]; treating raw response as the body.`);
  } else warnings.push(`Model emitted [${hits.map((h) => h.name).join("][")}] but no [${tag}] section; falling back to original input.`);
  return { text, changelog: changelogOf(section("CHANGELOG")), warnings };
}

/**
 * The JSON object a model wrote in its reply instead of calling the tool: any ```json fence is dropped and the first balanced
 * `{...}` is read. It must hold the body field, a changelog or `no_changes_needed`, so a stray object is not mistaken for the call.
 */
export function toolArgsFromText(content: string | undefined, bodyField: string): Record<string, unknown> | null {
  if (!content) return null;
  let text = content.trim();
  if (text.startsWith("```")) {
    const after = text.slice(3);
    const nl = after.indexOf("\n");
    text = (nl >= 0 && nl <= 30 ? after.slice(nl + 1) : after).trim();
  }
  text = text.replace(/\n?```\s*$/, "").trim();
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escaped) { escaped = false; continue; }
    if (inString) { if (ch === "\\") escaped = true; else if (ch === "\"") inString = false; continue; }
    if (ch === "\"") inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try {
        const o = JSON.parse(text.slice(start, i + 1)) as unknown;
        if (!isRecord(o)) return null;
        return typeof o[bodyField] === "string" || Array.isArray(o["changelog"]) || o["no_changes_needed"] === true ? o : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** The arguments string of a tool call as an object; null when it does not hold one. */
export function toolArgs(raw: unknown): Record<string, unknown> | null {
  if (isRecord(raw)) return raw;
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const VERDICTS = new Set(["clean", "minor", "ignored", "applied"]);

/** The model's per-rule review, with any entry that is not rule + verdict + reasoning dropped; undefined when none is left. */
export function ruleReviewOf(raw: unknown): RuleReviewEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: RuleReviewEntry[] = [];
  for (const e of raw) {
    const o = e as Record<string, unknown> | null;
    if (o && typeof o["rule"] === "string" && typeof o["reasoning"] === "string" && typeof o["verdict"] === "string" && VERDICTS.has(o["verdict"])) {
      out.push({ rule: o["rule"], verdict: o["verdict"] as RuleReviewEntry["verdict"], reasoning: o["reasoning"] });
    }
  }
  return out.length > 0 ? out : undefined;
}

/** A tool call's changelog as {rule, description}: anti-slop writes {bank, change}, every other pass {rule, description}. */
export function changelogFromTool(raw: unknown, shape: "rule-description" | "bank-change"): ChangelogItem[] {
  if (!Array.isArray(raw)) return [];
  const [a, b] = shape === "bank-change" ? ["bank", "change"] : ["rule", "description"];
  return raw.flatMap((e: unknown) => {
    const o = e as Record<string, unknown> | null;
    return o && typeof o[a!] === "string" && typeof o[b!] === "string" ? [{ rule: o[a!] as string, description: o[b!] as string }] : [];
  });
}
