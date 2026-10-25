/**
 * Pure regex-set editing session: one focused rule (the binder shows one rule per page), rule CRUD,
 * set-level fields, dirty/reconcile. Patterned on lore/session.ts (same shape, same op names); the
 * regex set is the lorebook's sibling entity, so the editing grammar is identical - one rule owns
 * the page, the TOC lists the rest.
 */
import type { RegexRule, RegexSetBody } from "../../../../entities/regex/schema";
import { newUiId } from "../../../_shared/new-id";
import { isRecord, recOr } from "../../../../core/guards";
import type { EditorTouch, OccurrenceIndex } from "../../../_shared/editor-state";
import { deepEq, reconcileAfterSave } from "../editor-core";
import {
  addRegexRule,
  moveRegexRule,
  patchRegexRule,
  patchRegexSet,
  removeRegexRule,
} from "../../../../entities/regex/operations";

export interface RegexSession {
  body: RegexSetBody;
  /** the rule the page shows; always a member of body.rules (or null on an empty set) */
  focusedId: string | null;
}

/** A blank rule the "+ New rule" flow seeds: no pattern yet, on, running in the two common phases. */
export function emptyRegexRule(id: string): RegexRule {
  return {
    id,
    label: "",
    find: "",
    flags: "g",
    replace: "",
    phases: ["input", "output"],
    enabled: true,
    sortOrder: 0,
  };
}

const hasRule = (body: RegexSetBody, id: string): boolean => body.rules.some((r) => r.id === id);

/** Refocus onto a surviving rule when the focused one is gone. */
function refocus(body: RegexSetBody, focusedId: string | null): string | null {
  if (focusedId !== null && hasRule(body, focusedId)) return focusedId;
  return body.rules[0]?.id ?? null;
}

export function normalizeSession(body: RegexSetBody): RegexSession {
  const rules = Array.isArray(body.rules) ? body.rules : [];
  return {
    body: { ...body, rules: [...rules] },
    focusedId: rules[0]?.id ?? null,
  };
}

/** The rule the page is editing (drives the masthead, the cards, the try-it rail). */
export function focusedRule(session: RegexSession): RegexRule | null {
  if (!session.focusedId) return null;
  return session.body.rules.find((r) => r.id === session.focusedId) ?? null;
}

/** TOC row click / pager flip: the picked rule takes the page. */
export function selectRule(session: RegexSession, id: string): RegexSession {
  if (!hasRule(session.body, id)) return session;
  return { ...session, focusedId: id };
}

export function addRule(session: RegexSession): RegexSession {
  const id = newUiId("rule_");
  const rule = emptyRegexRule(id);
  rule.sortOrder = (session.body.rules.at(-1)?.sortOrder ?? 0) + 10;
  return selectRule({ ...session, body: addRegexRule(session.body, rule) }, id);
}

/** Append a pre-filled rule (a gallery recipe) at the end and focus it (R5, QOL 4). */
export function addRuleFrom(
  session: RegexSession,
  mint: (id: string, sortOrder: number) => RegexRule,
): RegexSession {
  const id = newUiId("rule_");
  const rule = mint(id, (session.body.rules.at(-1)?.sortOrder ?? 0) + 10);
  return selectRule({ ...session, body: addRegexRule(session.body, rule) }, id);
}

export function duplicateRule(session: RegexSession, id: string): RegexSession {
  const src = session.body.rules.find((r) => r.id === id);
  if (!src) return session;
  const copy: RegexRule = {
    ...structuredClone(src),
    id: newUiId("rule_"),
    label: src.label ? `${src.label} (copy)` : "",
    sortOrder: src.sortOrder + 1,
  };
  const idx = session.body.rules.findIndex((r) => r.id === id);
  return selectRule({ ...session, body: addRegexRule(session.body, copy, idx + 1) }, copy.id);
}

export function deleteRule(session: RegexSession, id: string): RegexSession {
  if (!hasRule(session.body, id)) return session;
  const body = removeRegexRule(session.body, id);
  return { ...session, body, focusedId: refocus(body, session.focusedId) };
}

export function reorderRule(session: RegexSession, id: string, toIndex: number): RegexSession {
  if (!hasRule(session.body, id)) return session;
  return { ...session, body: moveRegexRule(session.body, id, toIndex) };
}

export function updateRule(
  session: RegexSession,
  id: string,
  patch: Partial<RegexRule>,
): RegexSession {
  if (!hasRule(session.body, id)) return session;
  return { ...session, body: patchRegexRule(session.body, id, patch) };
}

export function updateSet(
  session: RegexSession,
  patch: Partial<Pick<RegexSetBody, "name" | "description">>,
): RegexSession {
  return { ...session, body: patchRegexSet(session.body, patch) };
}

export function sessionDirty(session: RegexSession, baseline: RegexSetBody): boolean {
  return !deepEq(session.body, baseline);
}

/** After save: adopt submitted body as baseline; keep live if a concurrent edit landed. */
export function reconcileRegexAfterSave(args: {
  live: RegexSetBody;
  submitted: RegexSetBody;
}): { current: RegexSetBody; dirty: boolean } {
  return reconcileAfterSave({ live: args.live, submitted: args.submitted });
}

/** Read a canonical regex set out of the loaded entity, tolerant of a missing/partial body. */
export function bodyFromEntity(entity: unknown): RegexSetBody {
  const e = recOr(entity);
  const b = isRecord(e.body) ? (e.body as unknown as RegexSetBody) : null;
  if (b && typeof b.name === "string" && Array.isArray(b.rules)) return structuredClone(b);
  return { name: "Untitled regex set", rules: [] };
}

/** An edit touch that reads and writes only the rule `id` (every occurrence of it) in the body. */
export function ruleTouch(id: string, index: OccurrenceIndex<RegexRule>): EditorTouch<RegexSetBody> {
  return {
    key: `rule:${id}`,
    read: (body) => index.positions(id).map((at) => body.rules[at]).filter((rule): rule is RegexRule => Boolean(rule)),
    write: (body, value) => {
      const rules = [...body.rules];
      index.positions(id).forEach((at, occurrence) => { if ((value as RegexRule[])[occurrence]) rules[at] = (value as RegexRule[])[occurrence]!; });
      return { ...body, rules };
    },
  };
}

/** Focus the rule one step before (-1) or after (+1) the focused one; stays put at either end. */
export function stepRule(session: RegexSession, dir: -1 | 1): RegexSession {
  const at = session.focusedId !== null ? session.body.rules.findIndex((r) => r.id === session.focusedId) : -1;
  const next = session.body.rules[at + dir];
  return next ? selectRule(session, next.id) : session;
}

/** Append staged rules (already re-ided and re-ordered) and focus the first. */
export function appendRules(session: RegexSession, staged: RegexRule[]): RegexSession {
  if (staged.length === 0) return session;
  return {
    ...session,
    body: { ...session.body, rules: [...session.body.rules, ...staged] },
    focusedId: staged[0]?.id ?? session.focusedId,
  };
}
