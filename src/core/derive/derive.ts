/** One synchronous, Node-compatible owner for rebuildable derived results. Persistence is an
 * injected Stage seam; callers provide a content revision, never a database or platform effect. */
import { createBudgetedLru } from "../caches/budgeted-lru";
import { hashHex } from "../sha256";

export type DerivePolicy<T> = {
  version: string;
  persist: "never" | "adaptive" | "always";
  maxBytes?: number;
  memoryBytes(input: string, value: T): number;
  encode?: (value: T) => string;
  decode?: (value: string) => T;
};

export type DerivedRow = { value: string; bytes: number; costMs: number; hits: number; lastUsed: number };
export interface DerivedPersistence {
  generation(): number;
  get(family: string, version: string, inputRevision: string, maxBytes: number): DerivedRow | null;
  reconcile(families: readonly (readonly [string, string])[]): void;
  set(family: string, version: string, inputRevision: string, row: Omit<DerivedRow, "lastUsed">, generation: number): boolean;
  delete(family: string, version: string, inputRevision: string): void;
  stats(): { family: string; rows: number; bytes: number; meanCostMs: number }[];
  clear(): number;
  lock(): void;
  close(): void;
}

type Entry = { family: string; input: string; value: unknown; bytes: number; costMs: number; calls: number; firstAt: number; lastAt: number; persisted: boolean; persistAttempted: boolean };
type FamilyStats = { hits: number; misses: number; runs: number; costMs: number };
export type DerivedStats = { family: string; hits: number; misses: number; persistedRows: number; bytes: number; meanCostMs: number };

const MEMORY_BUDGET = 64 * 1024 * 1024;
const ADAPTIVE_WINDOW = 24 * 60 * 60 * 1000;
const store = createBudgetedLru<string, Entry>({ maxEntries: 20_000, maxWeightBytes: MEMORY_BUDGET, weightOf: (_key, entry) => entry.bytes });
const families = new Map<string, FamilyStats>();
let gate: () => boolean = () => true;
const familyGates = new Map<string, () => boolean>();
const familyEpochs = new Map<string, number>();
let lifecycle = 0;
const insertHooks = new Map<string, (family: string) => void>();
let persistence: DerivedPersistence | null = null;
const attachments = new Map<symbol, { adapter: DerivedPersistence; ready: () => boolean }>();
const policies = new Map<string, string>();

const familyKey = (name: string, version: string, revision: string): string => `${name}\0${version}\0${hashHex(revision)}`;
const statsFor = (family: string): FamilyStats => {
  let stats = families.get(family);
  if (!stats) { stats = { hits: 0, misses: 0, runs: 0, costMs: 0 }; families.set(family, stats); }
  return stats;
};

function changeAttachment(): void {
  lifecycle++;
  for (const { adapter } of attachments.values()) adapter.lock();
  store.clear();
  families.clear();
  persistence = attachments.size === 1 ? attachments.values().next().value!.adapter : null;
  persistence?.reconcile([...policies]);
}

/** Persistence is usable only with one live library; a removal lease closes only its own adapter. */
export function attachDerivedPersistence(adapter: DerivedPersistence, ready: () => boolean): () => void {
  const owner = Symbol();
  attachments.set(owner, { adapter, ready });
  changeAttachment();
  return () => {
    if (!attachments.delete(owner)) return;
    adapter.close();
    changeAttachment();
  };
}

/** Family ownership is declared alongside its codec, before library startup reconciliation. */
export function defineDerivePolicy<T>(family: string, policy: DerivePolicy<T>): DerivePolicy<T> {
  policies.set(family, policy.version);
  persistence?.reconcile([...policies]);
  return policy;
}

export function setDeriveGate(next: () => boolean, ...families: string[]): void {
  if (!families.length) gate = next;
  else for (const family of families) familyGates.set(family, next);
}
export function setDeriveInsertHook(next: (family: string) => void, ...families: string[]): void {
  for (const family of families.length ? families : ["*"]) insertHooks.set(family, next);
}
export const derivedCacheBytes = (): number => store.bytes();
export const derivedCacheSize = (): number => store.size;

export function derivedFamilySize(family: string): number {
  let size = 0;
  for (const [, entry] of store.entries()) if (entry.family === family) size++;
  return size;
}

export function derivedFamilyBytes(family: string): number {
  let bytes = 0;
  for (const [, entry] of store.entries()) if (entry.family === family) bytes += entry.bytes;
  return bytes;
}

export function clearDerivedFamily(family: string): void {
  familyEpochs.set(family, (familyEpochs.get(family) ?? 0) + 1);
  for (const [key, entry] of store.entries()) if (entry.family === family) store.delete(key);
}

export function trimDerivedFamily(family: string, targetBytes: number): void {
  let bytes = derivedFamilyBytes(family);
  for (const [key, entry] of store.entries()) {
    if (bytes <= targetBytes) break;
    if (entry.family === family && store.delete(key)) bytes -= entry.bytes;
  }
}

export function trimDerivedCache(targetBytes: number): void {
  while (store.bytes() > targetBytes) {
    const oldest = store.entries().next().value as [string, Entry] | undefined;
    if (!oldest || !store.delete(oldest[0])) return;
  }
}

export function clearDerivedCache(): void {
  lifecycle++;
  store.clear();
  persistence?.lock();
}

/** Global in-memory lock funnel: gates first, then clears memory, observations, and pending writes. */
export function lockDerived(): void { families.clear(); clearDerivedCache(); }

export function derivedStats(): DerivedStats[] {
  const persisted = new Map((persistence?.stats() ?? []).map((row) => [row.family, row]));
  const names = new Set([...families.keys(), ...persisted.keys()]);
  return [...names].sort().map((family) => {
    const stats = statsFor(family);
    const rows = persisted.get(family);
    return { family, hits: stats.hits, misses: stats.misses, persistedRows: rows?.rows ?? 0, bytes: rows?.bytes ?? 0, meanCostMs: stats.runs ? stats.costMs / stats.runs : rows?.meanCostMs ?? 0 };
  });
}

export function clearDerivedRows(): number {
  clearDerivedCache();
  families.clear();
  return persistence?.clear() ?? 0;
}

function remember<T>(key: string, family: string, input: string, value: T, costMs: number, bytes: number, persisted: boolean): Entry {
  const now = Date.now();
  const entry: Entry = { family, input, value, bytes, costMs, calls: 1, firstAt: now, lastAt: now, persisted, persistAttempted: persisted };
  if (bytes > 0 && bytes <= MEMORY_BUDGET) {
    store.set(key, entry);
    for (const [prefix, hook] of insertHooks) if (prefix === "*" || family.startsWith(prefix)) hook(family);
  }
  return entry;
}

function allowed(family: string): boolean {
  if (attachments.size > 1) return false;
  if (attachments.size === 1) return attachments.values().next().value!.ready();
  if (!gate()) return false;
  for (const [prefix, check] of familyGates) if (family.startsWith(prefix) && !check()) return false;
  return true;
}

function persist<T>(family: string, policy: DerivePolicy<T>, inputRevision: string, entry: Entry, generation: number): void {
  if (!persistence || policy.persist === "never" || !policy.encode || !allowed(`${family}@${policy.version}`) || entry.persisted || entry.persistAttempted) return;
  if (policy.persist === "adaptive" && entry.costMs < 250 && !(entry.costMs >= 25 && entry.calls >= 2 && entry.lastAt - entry.firstAt <= ADAPTIVE_WINDOW)) return;
  entry.persistAttempted = true;
  try {
    const encoded = policy.encode(entry.value as T);
    const bytes = new TextEncoder().encode(encoded).byteLength;
    if (bytes <= (policy.maxBytes ?? 0)) entry.persisted = persistence.set(family, policy.version, inputRevision, { value: encoded, bytes, costMs: entry.costMs, hits: entry.calls }, generation);
  } catch { /* Persistence is optional; a codec or busy backend never invalidates the Core result. */ }
}

function deletePersisted(family: string, version: string, revision: string): void {
  try { persistence?.delete(family, version, revision); } catch { /* A later lookup can still recompute. */ }
}

export function derive<T>(family: string, inputRevision: string, run: () => T, policy: DerivePolicy<T>): T {
  return deriveResult(family, inputRevision, run, policy) as T;
}

export async function deriveAsync<T>(family: string, inputRevision: string, run: () => Promise<T>, policy: DerivePolicy<T>): Promise<T> {
  return deriveResult(family, inputRevision, run, policy);
}

function deriveResult<T>(family: string, inputRevision: string, run: () => T | Promise<T>, policy: DerivePolicy<T>): T | Promise<T> {
  const familyId = `${family}@${policy.version}`;
  const key = familyKey(family, policy.version, inputRevision);
  if (!allowed(familyId)) return run();
  const hit = store.get(key);
  if (hit && hit.input === inputRevision) {
    const now = Date.now();
    hit.calls = now - hit.firstAt <= ADAPTIVE_WINDOW ? hit.calls + 1 : 1;
    if (hit.calls === 1) hit.firstAt = now;
    hit.lastAt = now;
    statsFor(familyId).hits++;
    persist(family, policy, inputRevision, hit, persistence?.generation() ?? 0);
    return hit.value as T;
  }
  if (persistence && policy.persist !== "never" && policy.decode) {
    try {
      const row = persistence.get(family, policy.version, inputRevision, policy.maxBytes ?? 0);
      if (row) {
        try {
          if (row.value.length > (policy.maxBytes ?? 0) || new TextEncoder().encode(row.value).byteLength > (policy.maxBytes ?? 0)) throw new Error("oversized derived value");
          const value = policy.decode(row.value);
          const bytes = Math.max(0, policy.memoryBytes(inputRevision, value));
          const entry = remember(key, familyId, inputRevision, value, row.costMs, bytes, true);
          entry.calls = row.hits;
          statsFor(familyId).hits++;
          return value;
        } catch {
          deletePersisted(family, policy.version, inputRevision);
        }
      }
    } catch {
      deletePersisted(family, policy.version, inputRevision);
    }
  }
  const stats = statsFor(familyId);
  stats.misses++;
  const start = performance.now();
  const generation = persistence?.generation() ?? 0;
  const ownLifecycle = lifecycle;
  const ownFamilyEpoch = familyEpochs.get(familyId) ?? 0;
  const finish = (value: T): T => {
    const costMs = performance.now() - start;
    if (ownLifecycle !== lifecycle || ownFamilyEpoch !== (familyEpochs.get(familyId) ?? 0) || !allowed(familyId)) return value;
    const entry = remember(key, familyId, inputRevision, value, costMs, Math.max(0, policy.memoryBytes(inputRevision, value)), false);
    stats.runs++;
    stats.costMs += costMs;
    if (ownLifecycle === lifecycle && ownFamilyEpoch === (familyEpochs.get(familyId) ?? 0) && persistence?.generation() === generation && allowed(familyId)) persist(family, policy, inputRevision, entry, generation);
    return value;
  };
  const result = run();
  return result instanceof Promise ? result.then(finish) : finish(result);
}
