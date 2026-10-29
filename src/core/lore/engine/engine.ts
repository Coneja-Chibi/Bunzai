/**
 * The lore engine orchestrator: RoleCall's engine.ts process(), restructured as
 * a pure function over canonical books plus Bunzai's four changes (derived timers, seeded rng,
 * sortOrder/priority budgeting, positions returned not placed). Order, faithfully kept from
 * RoleCall: gather (enabled + character filter) -> direct match (sticky, cooldown, constant,
 * delay-until-recursion skip, delay, keyword/special/emotion triggers) -> recursion -> inclusion
 * groups -> priority/sortOrder budget (two stages: per-book, then the caller's global share) ->
 * probability roll on budget survivors only. Direct matching for plain keys runs through key-index.ts's
 * compiled per-book matcher, shared across entries with the
 * same scan-text signature; regex and special triggers are unaffected. RoleCall budgets BEFORE
 * rolling, so an entry that
 * loses its roll after surviving the budget ends up in neither `injected` nor `cut` - kept exactly,
 * see scan.ts / budget.ts docblocks for the other named RoleCall-vs-RoleCall inconsistencies this
 * keeps rather than silently fixes.
 *
 * `explain` (2e) is additive instrumentation of this same pipeline:
 * every entry gets exactly one LoreVerdict, set where its fate is actually decided and overwritten
 * if a later stage (groups, budget, the chance roll) changes it. Disabled and character-filtered
 * entries are recorded in the gather loop, before they ever reach `allEntries`.
 */
import type { LorebookEntry } from "../../../entities/lorebook/schema";
import { numOrNull, presentNum } from "../../guards";
import { passesCharacterFilter } from "./character-filter";
import { evictByTokenBudget, evictPerBook, type BudgetItem } from "./budget";
import { filterByGroupWinners, groupByGroupName, resolveInclusionGroups } from "./groups";
import { applyBoosts } from "./boosting";
import { anyBookWantsRecursion, evaluateWithRecursion, recursionCandidates } from "./recursion";
import { buildScanText, evaluateEntry, type ScanSources } from "./scan";
import { compileBookKeyIndexCached, scanBookKeyIndex, type CompiledBookIndex, type KeyHits } from "./key-index";
import { resolveSideEffects } from "./side-effects";
import { isSpecialTrigger } from "./triggers-special";
import { cooldownRemaining, isDelayBlocked, isOnCooldown, isStickyForced, stickyRemaining, timersFrom } from "./timers";
import {
  entryKey,
  type EntryRef,
  type LoreBookInput,
  type LoreHit,
  type LorePosition,
  type LoreReason,
  type LoreRun,
  type LoreRunOptions,
  type LoreScan,
  type LoreSkip,
  type LoreVerdict,
} from "./types";

interface Fired {
  ref: EntryRef;
  matchedKeywords: string[];
  probability: number;
  reason: LoreReason;
  /** false only for a sticky reinjection: it does not start a new sticky/cooldown window */
  fresh: boolean;
  /** recursion depth it fired at; 0 for a direct/sticky/constant match */
  loop: number;
}

function toLorePosition(entry: LorebookEntry): LorePosition {
  if (entry.position === "depth") return { kind: "depth", depth: entry.depth, role: entry.role };
  if (entry.position === "append") return { kind: "append", depth: entry.depth };
  return { kind: entry.position };
}

function reasonForMatch(matchedKeywords: string[], usedSecondary: boolean): LoreReason {
  if (matchedKeywords.some((k) => /^\[emotion:/i.test(k))) return "emotion";
  if (matchedKeywords.some((k) => isSpecialTrigger(k))) return "special";
  if (usedSecondary) return "secondary";
  return "key";
}

/** RoleCall's selection/boosting.ts rollProbability: >=1 always, <=0 never, else a straight roll.
 * `mode` "always"/"never" (LoreRunOptions.chance) force every check without calling `rng`, the way
 * activation.ts's chancePasses did: "always" passes even a 0% entry; "never" still passes a 100%
 * (guaranteed) entry, since that one was never actually a chance at all. */
function rollProbability(
  rng: () => number,
  probability: number,
  mode: "roll" | "always" | "never",
): { ok: boolean; rolled?: number } {
  if (mode === "always") return { ok: true };
  if (mode === "never") return { ok: probability >= 1 };
  if (probability >= 1) return { ok: true };
  if (probability <= 0) return { ok: false, rolled: 0 };
  const rolled = rng();
  return { ok: rolled < probability, rolled };
}

export function runLore(books: readonly LoreBookInput[], scan: LoreScan, options: LoreRunOptions): LoreRun {
  const timers = timersFrom(options.recentFires);
  const chanceMode = options.chance ?? "roll";
  const explain = options.explain === true;
  const verdictById = explain ? new Map<string, LoreVerdict>() : null;

  const setVerdict = (
    book: LoreBookInput,
    entry: LorebookEntry,
    v: Omit<LoreVerdict, "entryKey" | "bookId" | "entryId">,
  ): void => {
    if (!verdictById) return;
    const key = entryKey(book.id, entry.id);
    verdictById.set(key, { entryKey: key, bookId: book.id, entryId: entry.id, ...v });
  };
  const skip = (book: LoreBookInput, entry: LorebookEntry, reason: LoreSkip, loop: number, detail?: LoreVerdict["detail"]): void =>
    setVerdict(book, entry, { fired: false, reason, matched: [], loop, tokens: options.countTokens(entry.content), detail });

  const allEntries: EntryRef[] = [];
  for (const book of books) {
    for (const entry of book.body.entries) {
      if (!entry.enabled) {
        skip(book, entry, "disabled", 0);
        continue;
      }
      if (!passesCharacterFilter(entry.characterFilter, scan.character)) {
        skip(book, entry, "character-filter", 0);
        continue;
      }
      allEntries.push({ book, entry });
    }
  }

  const sources: ScanSources = {
    messages: scan.messages,
    characterDescription: scan.character.description,
    characterPersonality: scan.character.personality,
    userPersona: scan.persona,
    scenario: scan.character.scenario,
  };

  // M3: one compiled matcher per book, cached across turns by
  // (book id, revision) - see key-index.ts. buildScanText's output is a pure function of an
  // entry's scan depth and which optional sources it reads (plus the book and the turn's shared
  // `sources`, both fixed for this whole call), not of the entry itself - so two entries with the
  // same signature get byte-identical scan text. Building it, and running the book's tries over
  // it, happens once per distinct signature actually in play, not once per entry: at 5,000
  // entries sharing the same scan settings (the common case), that is one buildScanText call and
  // one automaton pass instead of 5,000 of each.
  const bookIndexes = new Map<string, CompiledBookIndex>();
  for (const b of books) bookIndexes.set(b.id, compileBookKeyIndexCached(b));
  const scanGroups = new Map<string, { text: string; keyHits: KeyHits }>();
  const scanSignature = (entry: LorebookEntry, book: LoreBookInput): string =>
    `${entry.scanDepth ?? book.body.globalScanDepth}|${+entry.scanCharacterDescription}${+entry.scanCharacterPersonality}${+entry.scanUserPersona}${+entry.scanScenario}|${book.id}`;

  const fired: Fired[] = [];

  for (const ref of allEntries) {
    const { entry, book } = ref;
    const key = entryKey(book.id, entry.id);

    if (isStickyForced(timers, key, entry.sticky)) {
      fired.push({ ref, matchedKeywords: [], probability: 1, reason: "sticky", fresh: false, loop: 0 });
      continue;
    }
    if (isOnCooldown(timers, key, entry.sticky, entry.cooldown)) {
      skip(book, entry, "cooldown", 0, { remaining: cooldownRemaining(timers, key, entry.sticky, entry.cooldown) });
      continue;
    }
    if (entry.constant) {
      fired.push({ ref, matchedKeywords: [], probability: 1, reason: "constant", fresh: true, loop: 0 });
      continue;
    }
    if (entry.delayUntilRecursion > 0) {
      skip(book, entry, "delay-until-recursion", 0, { remaining: entry.delayUntilRecursion });
      continue;
    }
    if (isDelayBlocked(entry.delay, scan.messageCount)) {
      skip(book, entry, "delay", 0, { remaining: entry.delay - scan.messageCount });
      continue;
    }
    if (entry.triggers.length === 0) {
      skip(book, entry, "empty-keys", 0);
      continue;
    }

    const keywordOptions = {
      caseSensitive: entry.caseSensitive ?? book.body.globalCaseSensitive,
      matchWholeWords: entry.matchWholeWords ?? book.body.globalMatchWholeWords,
    };
    const sig = scanSignature(entry, book);
    let group = scanGroups.get(sig);
    if (!group) {
      const text = buildScanText(entry, book.body, sources);
      group = { text, keyHits: scanBookKeyIndex(bookIndexes.get(book.id)!, text) };
      scanGroups.set(sig, group);
    }
    if (!group.text) {
      skip(book, entry, "no-key-match", 0);
      continue;
    }

    const result = evaluateEntry(entry, group.text, keywordOptions, scan, options.rng, timers, "highest", undefined, group.keyHits);
    if (!result.matched) {
      const reason: LoreSkip = result.noMatch?.primaryMatched
        ? "secondary-logic"
        : result.noMatch?.frequencyBlocked
          ? "frequency"
          : "no-key-match";
      skip(book, entry, reason, 0);
      continue;
    }
    fired.push({
      ref,
      matchedKeywords: result.matchedKeywords,
      probability: result.probability,
      reason: reasonForMatch(result.matchedKeywords, result.usedSecondary),
      fresh: true,
      loop: 0,
    });
  }

  // An excludeRecursion entry that didn't match directly will never get a second look from
  // recursion; say so instead of the generic no-key-match, when recursion was actually running
  // for its own book.
  if (verdictById) {
    for (const ref of allEntries) {
      if (!ref.entry.excludeRecursion || !ref.book.body.globalRecursion) continue;
      const key = entryKey(ref.book.id, ref.entry.id);
      const v = verdictById.get(key);
      if (v && !v.fired && v.reason === "no-key-match") verdictById.set(key, { ...v, reason: "exclude-recursion" });
    }
  }

  if (anyBookWantsRecursion(allEntries)) {
    const candidates = recursionCandidates(allEntries, timers, scan.messageCount);
    const recHits = evaluateWithRecursion(candidates, sources, scan, options.rng, timers);
    const firedKeys = new Set(fired.map((f) => entryKey(f.ref.book.id, f.ref.entry.id)));
    for (const hit of recHits) {
      const key = entryKey(hit.ref.book.id, hit.ref.entry.id);
      if (firedKeys.has(key)) continue;
      fired.push({
        ref: hit.ref,
        matchedKeywords: hit.matchedKeywords,
        probability: hit.probability,
        reason: "recursion",
        fresh: true,
        loop: (hit.depth ?? 0) + 1,
      });
      firedKeys.add(key);
    }
  }

  const groups = groupByGroupName(fired);
  const winners = resolveInclusionGroups(groups, options.rng);
  const afterGroups = applyBoosts(filterByGroupWinners(fired, winners));

  if (verdictById) {
    const afterGroupsKeys = new Set(afterGroups.map((f) => entryKey(f.ref.book.id, f.ref.entry.id)));
    for (const f of fired) {
      const key = entryKey(f.ref.book.id, f.ref.entry.id);
      if (afterGroupsKeys.has(key)) continue;
      setVerdict(f.ref.book, f.ref.entry, {
        fired: false,
        reason: "group-lost",
        matched: f.matchedKeywords,
        loop: f.loop,
        tokens: options.countTokens(f.ref.entry.content),
      });
    }
  }

  const budgetItems: (BudgetItem & Fired)[] = afterGroups.map((f) => ({
    ...f,
    tokens: options.countTokens(f.ref.entry.content),
  }));

  const perBook = evictPerBook(budgetItems);
  const global = evictByTokenBudget(perBook.kept, numOrNull(options.budgetTokens));

  if (verdictById) {
    const perBookSpent = new Map<string, number>();
    for (const k of perBook.kept) perBookSpent.set(k.ref.book.id, (perBookSpent.get(k.ref.book.id) ?? 0) + k.tokens);
    for (const item of perBook.cut) {
      const bookBody = item.ref.book.body;
      const limit = bookBody.budgetMode === "token" && bookBody.tokenBudget > 0 ? bookBody.tokenBudget : undefined;
      const left = limit === undefined ? undefined : Math.max(0, limit - (perBookSpent.get(item.ref.book.id) ?? 0));
      setVerdict(item.ref.book, item.ref.entry, {
        fired: false,
        reason: "budget-cut",
        matched: item.matchedKeywords,
        loop: item.loop,
        tokens: item.tokens,
        detail: { cost: item.tokens, left },
      });
    }
    const globalLimit = presentNum(options.budgetTokens);
    for (const item of global.cut) {
      setVerdict(item.ref.book, item.ref.entry, {
        fired: false,
        reason: "budget-cut",
        matched: item.matchedKeywords,
        loop: item.loop,
        tokens: item.tokens,
        detail: { cost: item.tokens, left: globalLimit === undefined ? undefined : Math.max(0, globalLimit - global.spent) },
      });
    }
  }

  const cutHits: LoreHit[] = [...perBook.cut, ...global.cut].map((item) => toHit(item));

  const injected: LoreHit[] = [];
  const injectedRefs: EntryRef[] = [];
  const fires: LoreRun["fires"] = [];
  let totalTokens = 0;

  for (const item of global.kept) {
    const roll = rollProbability(options.rng, item.probability, chanceMode);
    if (!roll.ok) {
      setVerdict(item.ref.book, item.ref.entry, {
        fired: false,
        reason: "chance",
        matched: item.matchedKeywords,
        loop: item.loop,
        tokens: item.tokens,
        detail: {
          rolled: roll.rolled === undefined ? undefined : Math.round(roll.rolled * 100),
          needed: Math.round(item.probability * 100),
        },
      });
      continue;
    }
    injected.push(toHit(item));
    injectedRefs.push(item.ref);
    totalTokens += item.tokens;
    fires.push({ entryKey: entryKey(item.ref.book.id, item.ref.entry.id), fresh: item.fresh, keywords: item.matchedKeywords });
    setVerdict(item.ref.book, item.ref.entry, {
      fired: true,
      reason: item.reason,
      matched: item.matchedKeywords,
      loop: item.loop,
      tokens: item.tokens,
      detail:
        item.reason === "sticky"
          ? { remaining: stickyRemaining(timers, entryKey(item.ref.book.id, item.ref.entry.id), item.ref.entry.sticky) }
          // th-t4-gaps 1: a real chance roll (mode "roll", 0 < probability < 1) records what it rolled
          // and needed even when it passed, the same numbers the failed branch above already records.
          : roll.rolled !== undefined
            ? { rolled: Math.round(roll.rolled * 100), needed: Math.round(item.probability * 100) }
            : undefined,
    });
  }

  const sideEffects = resolveSideEffects(allEntries, injectedRefs, timers);

  let verdicts: LoreVerdict[] | undefined;
  if (verdictById) {
    verdicts = [];
    for (const book of books) {
      for (const entry of book.body.entries) {
        const key = entryKey(book.id, entry.id);
        verdicts.push(
          verdictById.get(key) ?? {
            entryKey: key,
            bookId: book.id,
            entryId: entry.id,
            fired: false,
            reason: "no-key-match",
            matched: [],
            loop: 0,
            tokens: options.countTokens(entry.content),
          },
        );
      }
    }
  }

  return { injected, cut: cutHits, fires, sideEffects, totalTokens, ...(verdicts ? { verdicts } : {}) };
}

function toHit(item: Fired & { tokens: number }): LoreHit {
  const { entry, book } = item.ref;
  return {
    entryKey: entryKey(book.id, entry.id),
    bookId: book.id,
    entryId: entry.id,
    title: entry.title,
    content: entry.content,
    position: toLorePosition(entry),
    tokens: item.tokens,
    reason: item.reason,
    matched: item.matchedKeywords,
  };
}
