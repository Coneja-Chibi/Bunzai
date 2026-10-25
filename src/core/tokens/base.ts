/**
 * The token meter's base counter ("Base counter"): one cheap, consistent
 * count of the exact text sent, which the calibrator maps onto each model's real count. It does not
 * have to be right for any model, only the same every time, so it is gpt-tokenizer's `o200k_base`
 * (MIT, pure JS; about 3.4 MB in the compiled binary, measured 2026-09-27).
 *
 * Special-token text such as `<|endoftext|>` is counted as ordinary text: the library throws on it by
 * default, and anything a person types or a card holds can contain it.
 *
 * Each message is also split by content class, because tokenizers disagree most on exactly these:
 * code, JSON (tool schemas, structured cards), and CJK text. The split feeds the per-class fit
 * (token-meter "Accuracy extras").
 *
 * Both the raw count and its class split use the shared derived-result owner. The owner supplies a
 * bounded memory cache and Stage's sealed adaptive persistence while this module stays synchronous
 * and Node-compatible.
 */
import { countTokens } from "gpt-tokenizer/encoding/o200k_base";
import { clearDerivedFamily, defineDerivePolicy, derive, derivedFamilyBytes, derivedFamilySize, setDeriveGate, setDeriveInsertHook, trimDerivedFamily } from "../derive/derive";

const TEXT_FAMILY = "tokens.count.text";
const MESSAGE_FAMILY = "tokens.count.message";
const VERSION = "o200k-v1";
const textPolicy = defineDerivePolicy<number>(TEXT_FAMILY, {
  version: VERSION, persist: "adaptive", maxBytes: 64 * 1024, memoryBytes: (text) => text.length * 2 + 120,
  encode: String, decode: (value) => { const count = Number(value); if (!Number.isSafeInteger(count) || count < 0) throw new Error("bad token count"); return count; },
});
const messagePolicy = defineDerivePolicy<BaseCount>(MESSAGE_FAMILY, {
  version: "classes-v1", persist: "adaptive", maxBytes: 256, memoryBytes: (text) => text.length * 2 + 160,
  encode: JSON.stringify, decode: (value) => {
    const row = JSON.parse(value) as BaseCount;
    if (![row.total, row.prose, row.code, row.json, row.cjk].every((n) => Number.isSafeInteger(n) && n >= 0)) throw new Error("bad token classes");
    return row;
  },
});
let realEncodes = 0;

/** Where a message's tokens went, by content class. The four always sum to `total`. */
export interface ClassCounts {
  prose: number;
  code: number;
  json: number;
  cjk: number;
}

export interface BaseCount extends ClassCounts {
  total: number;
}

export const CONTENT_CLASSES = ["prose", "code", "json", "cjk"] as const satisfies readonly (keyof ClassCounts)[];

const NO_SPECIALS = { disallowedSpecial: new Set<string>() };

/**
 * Registers what decides whether `countText`/`countMessage` may read or write their caches right
 * now. `src/stage/crypto/keyring.ts` registers `() => dataKey !== null` once, so the gate tracks THIS
 * process's live lock state with no separate flag to fall out of sync.
 *
 * WHY A GATE, NOT ONLY `clearTokenCaches` ON LOCK. Clearing on lock closes the cache's PAST: whatever
 * a turn already cached before the lock. It does not stop a turn already in flight when the lock
 * lands from writing NEW plaintext into the cache moments later - `scene-turn.ts`'s `runTurn` decrypts
 * the scene, then calls `assemble()` (which calls `countText` synchronously) after that decrypt, and
 * nothing stops an explicit "Lock now" from landing in the gap between them. A gate checked at the top
 * of every call closes that window: while it answers false, a count still runs (the caller still gets
 * a number), but nothing it computes is ever stored, and nothing already in the cache is read - so a
 * lock mid-turn can never leave decrypted text sitting in memory a moment after the key was zeroed.
 */
export function setTokenCacheGate(gate: () => boolean): void {
  setDeriveGate(gate, TEXT_FAMILY, MESSAGE_FAMILY);
}

/** Called once after a real cache write (never a hit) finishes inserting and evicting, so the cache
 * registry (src/stage/caches.ts, src/ui/_shared/caches.ts) can sample memory pressure right after
 * this module's own state actually changed. Open (a no-op) by default: nothing but the registry ever
 * calls setTokenCacheInsertHook, so every existing caller and test sees no change. */
export function setTokenCacheInsertHook(hook: () => void): void {
  setDeriveInsertHook(hook, TEXT_FAMILY, MESSAGE_FAMILY);
}

/** The token families' estimated UTF-16 input bytes and per-entry bookkeeping. */
export function tokenCacheBytes(): number {
  return derivedFamilyBytes(`${TEXT_FAMILY}@${VERSION}`) + derivedFamilyBytes(`${MESSAGE_FAMILY}@classes-v1`);
}

/** Trims the raw-count family first, then the class-count family, to the registry's byte budget. */
export function trimTokenCache(targetBytes: number): void {
  while (tokenCacheBytes() > targetBytes && derivedFamilyBytes(`${TEXT_FAMILY}@${VERSION}`) > 0) {
    trimDerivedFamily(`${TEXT_FAMILY}@${VERSION}`, Math.max(0, targetBytes - derivedFamilyBytes(`${MESSAGE_FAMILY}@classes-v1`)));
    // loop condition re-checks tokenCacheBytes() each pass
  }
  while (tokenCacheBytes() > targetBytes && derivedFamilyBytes(`${MESSAGE_FAMILY}@classes-v1`) > 0) {
    trimDerivedFamily(`${MESSAGE_FAMILY}@classes-v1`, Math.max(0, targetBytes - derivedFamilyBytes(`${TEXT_FAMILY}@${VERSION}`)));
    // loop condition re-checks tokenCacheBytes() each pass
  }
}

/**
 * The base count of one text, without its class split. The shared derive owner compares the original
 * revision after its hashed lookup, so a key collision cannot return a count for different text.
 */
export function countText(text: string): number {
  if (!text) return 0;
  return derive(TEXT_FAMILY, text, () => { realEncodes++; return countTokens(text, NO_SPECIALS); }, textPolicy);
}

/**
 * Test-only introspection for the `countText` family (mirrors `src/ui/_shared/new-id.ts`'s
 * `__resetNewUiIdSeqForTests` convention). `realEncodes` counts actual calls into gpt-tokenizer since
 * the last reset - the M1 perf gate's proof that a second, identical turn does zero of them. Never
 * read by production code.
 */
export function __tokenCacheStatsForTests(): { realEncodes: number; cacheSize: number; cacheChars: number } {
  return { realEncodes, cacheSize: derivedFamilySize(`${TEXT_FAMILY}@${VERSION}`), cacheChars: Math.max(0, (derivedFamilyBytes(`${TEXT_FAMILY}@${VERSION}`) - derivedFamilySize(`${TEXT_FAMILY}@${VERSION}`) * 120) / 2) };
}

/** Empties both token-derived families of
 * whatever decrypted text they hold, without touching the encode counter (a production concern, not
 * a test one). Shared by `clearTokenCaches` and `__resetTokenCacheForTests` below, so the two can
 * never drift into clearing different things. */
function clearCaches(): void {
  clearDerivedFamily(`${TEXT_FAMILY}@${VERSION}`);
  clearDerivedFamily(`${MESSAGE_FAMILY}@classes-v1`);
}

/**
 * Clears every cache in this module that can hold decrypted user text, because the library just
 * locked ("Locked, unlocked, and lost"): `countText`'s content cache and
 * the `countMessage` family. A cache surviving a lock would let a card's or a message's plaintext
 * be recovered from this process's memory - browser tab or server - through nothing but its token
 * count, even though the key that decrypted it was just zeroed. Called by the browser's registered-
 * cache lock listener (`src/ui/_shared/caches.ts`, on `LIBRARY_LOCKED_EVENT`) and by the server's
 * keyring the moment it actually locks (`src/stage/crypto/keyring.ts`'s `zero()`, through the server
 * registry's `lockAll()` - the one function every lock path funnels through).
 */
export function clearTokenCaches(): void {
  clearCaches();
}

/** Test-only: clears both caches, the encode counter, and any gate a test (or a keyring it exercised)
 * registered, back to open. Never called by production code. */
export function __resetTokenCacheForTests(): void {
  clearCaches();
  realEncodes = 0;
  setTokenCacheGate(() => true);
}

/** Han, Hiragana, Katakana, Hangul, and CJK punctuation and full-width forms. */
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/g;
const FENCE = /```[\s\S]*?(?:```|$)/g;

/** Is the whole text one JSON value? Cheap first check before parsing. */
function isJson(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || !((t[0] === "{" && t.endsWith("}")) || (t[0] === "[" && t.endsWith("]")))) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

/**
 * The base count of one message's text, split by class. Fenced code blocks count as code; a message
 * that is wholly JSON counts as JSON; the rest is split between prose and CJK by their share of the
 * remaining characters (a tokenizer's cost for CJK runs several times that of English per character,
 * so a per-class coefficient catches what one ratio would blur).
 */
export function countMessage(text: string): BaseCount {
  const result = derive(MESSAGE_FAMILY, text, () => {
    const total = countText(text);
    if (total === 0) return { total: 0, prose: 0, code: 0, json: 0, cjk: 0 };
    if (isJson(text)) return { total, prose: 0, code: 0, json: total, cjk: 0 };
    const fences = text.match(FENCE) ?? [];
    const code = Math.min(total, fences.reduce((n, block) => n + countText(block), 0));
    const rest = fences.length ? text.replace(FENCE, "") : text;
    const cjkChars = (rest.match(CJK) ?? []).length;
    const share = rest.length ? cjkChars / rest.length : 0;
    const cjk = Math.round((total - code) * share);
    return { total, prose: total - code - cjk, code, json: 0, cjk };
  }, messagePolicy);
  return { ...result };
}

/**
 * Tokens a chat template spends on each message's role and framing, whatever its text: the same
 * allowance RoleCall budgets (+4 per message). Without it, a prompt of many short messages starts
 * under the truth before the meter has learned the model.
 */
export const MESSAGE_OVERHEAD = 4;

/**
 * One message's base count as a part of a prompt: its text plus its framing, exactly what
 * countPrompt adds for it. Budgets that estimate history message by message use this, never
 * countMessage, so each message carries the framing the fit learned with.
 */
export function countFramed(text: string): BaseCount {
  const c = countMessage(text);
  return { ...c, total: c.total + MESSAGE_OVERHEAD, prose: c.prose + MESSAGE_OVERHEAD };
}

/** The base count of a whole prompt: every message's text plus its framing, summed by class. */
export function countPrompt(texts: readonly string[]): BaseCount {
  const out: BaseCount = { total: 0, prose: 0, code: 0, json: 0, cjk: 0 };
  for (const text of texts) {
    const c = countMessage(text);
    out.total += c.total + MESSAGE_OVERHEAD;
    out.prose += c.prose + MESSAGE_OVERHEAD;
    out.code += c.code;
    out.json += c.json;
    out.cjk += c.cjk;
  }
  return out;
}
