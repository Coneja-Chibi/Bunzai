/** One shell-injected cache for immutable per-piece summary snapshots and membership. */
import type { PieceChangeEvent } from "../../stage/contracts/content-store";
import type { StudioEntitySummary } from "../app-contract";

export interface PieceSnapshot {
  readonly summary: StudioEntitySummary;
  readonly version: number;
  readonly writeId: number;
  readonly revision: string;
}

export interface PieceStreamState {
  readonly seeded: boolean;
  readonly watching: boolean;
  readonly kinds: readonly string[];
  readonly externalVersion: number;
  readonly lockEvent: { readonly state: "locked" | "unlocked"; readonly seq: number } | null;
  /** The last "trackers changed" push for a scene (plan 16): which chat, what became of each tracker, and a counter so a repeat is seen. */
  readonly sceneTrackers: { readonly chatId: string; readonly modules: readonly { readonly module: string; readonly outcome: string }[]; readonly seq: number } | null;
}

export class PieceStore {
  private readonly entries = new Map<string, PieceSnapshot>();
  private readonly positions = new Map<string, number>();
  private readonly tombstones = new Map<string, { version: number; writeId: number }>();
  private readonly pendingReads = new Map<string, { generation: number; count: number }>();
  private initialFlight: Promise<unknown> | null = null;
  private initialValue: unknown;
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly listListeners = new Set<() => void>();
  private list: readonly StudioEntitySummary[] = [];
  private epoch = 0;
  private sequence = 0;
  private generation = 0;
  private seeded = false;
  private watching = false;
  private kinds: readonly string[] = [];
  private externalVersion = 0;
  private readonly localWrites = new Set<string>();
  private readonly externalNotices = new Set<string>();
  private externalNoticeIdentity: string | null = null;
  private lifetime = 0;
  private locked = false;
  private lockEvent: { readonly state: "locked" | "unlocked"; readonly seq: number } | null = null;
  private sceneTrackers: PieceStreamState["sceneTrackers"] = null;
  private publishedStream: PieceStreamState = { seeded: false, watching: false, kinds: this.kinds, externalVersion: 0, lockEvent: this.lockEvent, sceneTrackers: null };

  snapshot(kind: string, id: string): PieceSnapshot | undefined { return this.entries.get(`${kind}\0${id}`); }
  listSnapshot(): readonly StudioEntitySummary[] { return this.list; }
  lastSequence(): number { return this.sequence; }
  markSequence(sequence: number): void { if (Number.isSafeInteger(sequence) && sequence >= 0) this.sequence = Math.max(this.sequence, sequence); }
  getGeneration(): number { return this.generation; }
  captureLifetime(): number { return this.lifetime; }
  isCurrentLifetime(lifetime: number): boolean { return !this.locked && lifetime === this.lifetime; }
  isLocked(): boolean { return this.locked; }
  isSeeded(): boolean { return this.seeded; }
  streamState(): PieceStreamState { return this.publishedStream; }

  reloadInitial<T>(read: () => Promise<T>, rows: (value: T) => readonly StudioEntitySummary[]): Promise<T> {
    if (this.locked) return Promise.reject(new Error("piece store is locked"));
    this.initialValue = undefined;
    this.epoch++;
    return this.loadInitial(read, rows);
  }

  async loadInitial<T>(read: () => Promise<T>, rows: (value: T) => readonly StudioEntitySummary[]): Promise<T> {
    if (this.locked) throw new Error("piece store is locked");
    if (this.initialValue !== undefined) return this.initialValue as T;
    if (this.initialFlight) return this.initialFlight as Promise<T>;
    const lifetime = this.captureLifetime();
    const flight = (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!this.isCurrentLifetime(lifetime)) throw new Error("piece store lifetime changed");
        const token = this.epoch;
        const value = await read();
        if (!this.isCurrentLifetime(lifetime)) throw new Error("piece store lifetime changed");
        if (this.seed(rows(value), token)) { this.initialValue = value; return value; }
      }
      throw new Error("piece list changed while its initial snapshot was loading");
    })();
    this.initialFlight = flight;
    try { return await flight; }
    finally { if (this.initialFlight === flight) this.initialFlight = null; }
  }

  seed(rows: readonly StudioEntitySummary[], token: number): boolean {
    if (this.locked || this.epoch !== token) return false;
    const found = new Set<string>();
    const next: StudioEntitySummary[] = [];
    const changed = new Set<string>();
    for (const row of rows) {
      const key = `${row.kind}\0${row.id}`;
      found.add(key);
      const old = this.entries.get(key);
      const version = row.version ?? 0;
      const writeId = row.writeId ?? 0;
      const tombstone = this.tombstones.get(key);
      if (tombstone && !isNewer(writeId, version, row.revision ?? "", tombstone.writeId, tombstone.version, "")) {
        if (old) next.push(old.summary);
        continue;
      }
      if (tombstone) this.tombstones.delete(key);
      if (old && !isNewer(writeId, version, row.revision ?? "", old.writeId, old.version, old.revision)) { next.push(old.summary); continue; }
      const snapshot = Object.freeze({ summary: Object.freeze({ ...row }), version, writeId, revision: row.revision ?? old?.revision ?? "" });
      if (old && old.writeId === writeId && old.version === version && old.revision === snapshot.revision) next.push(old.summary);
      else { this.entries.set(key, snapshot); next.push(snapshot.summary); changed.add(key); }
    }
    for (const [key, snapshot] of this.entries) {
      if (!found.has(key)) {
        this.entries.delete(key);
        this.rememberTombstone(key, snapshot.version, snapshot.writeId);
        changed.add(key);
      }
    }
    const firstSeed = !this.seeded;
    const membershipChanged = next.length !== this.list.length || next.some((row, index) => row !== this.list[index]);
    this.seeded = true;
    this.list = next;
    this.positions.clear();
    this.list.forEach((row, index) => this.positions.set(`${row.kind}\0${row.id}`, index));
    if (changed.size) {
      this.epoch++;
      this.generation += changed.size;
      for (const key of changed) { this.mutateKey(key); this.emit(key); }
    }
    if (membershipChanged && !changed.size) { this.epoch++; this.generation++; }
    if (changed.size || firstSeed || membershipChanged) this.emitList();
    return true;
  }

  replace(rows: readonly StudioEntitySummary[]): void { this.seed(rows, this.epoch); }

  subscribe(kind: string, id: string, listener: () => void): () => void {
    const key = `${kind}\0${id}`;
    const group = this.listeners.get(key) ?? new Set<() => void>();
    group.add(listener);
    this.listeners.set(key, group);
    return () => { group.delete(listener); if (!group.size) this.listeners.delete(key); };
  }

  subscribeList(listener: () => void): () => void { this.listListeners.add(listener); return () => this.listListeners.delete(listener); }
  setWatching(watching: boolean): void { if (this.watching !== watching) { this.watching = watching; this.emitList(); } }
  /** The studio-events stream said a scene's trackers changed. */
  setSceneTrackers(event: { chatId: string; modules: readonly { module: string; outcome: string }[] }): void {
    this.sceneTrackers = { ...event, seq: (this.sceneTrackers?.seq ?? 0) + 1 };
    this.emitList();
  }
  setLock(state: "locked" | "unlocked"): void {
    const transition = (state === "locked") !== this.locked;
    if (transition) { this.lifetime++; this.locked = state === "locked"; this.kinds = []; this.localWrites.clear(); this.externalNotices.clear(); this.externalNoticeIdentity = null; }
    if (transition && state === "locked") {
      this.sequence = 0;
      this.initialValue = undefined;
      this.initialFlight = null;
      this.seeded = false;
      this.externalVersion = 0;
      this.epoch++;
      for (const pending of this.pendingReads.values()) pending.generation++;
      const keys = new Set([...this.entries.keys(), ...this.listeners.keys()]);
      this.entries.clear();
      this.positions.clear();
      this.tombstones.clear();
      this.list = [];
      this.generation++;
      for (const key of keys) { this.mutateKey(key); this.emit(key); }
    }
    this.lockEvent = { state, seq: (this.lockEvent?.seq ?? 0) + 1 };
    this.emitList();
  }

  accept(summary: StudioEntitySummary, lifetime = this.lifetime, source: "local" | "stream" = "local"): void {
    if (!this.isCurrentLifetime(lifetime)) return;
    const key = `${summary.kind}\0${summary.id}`;
    const old = this.entries.get(key);
    const version = summary.version ?? 0;
    const writeId = summary.writeId ?? 0;
    if (source === "local" && writeId > 0) {
      this.rememberLocalWrite(key, writeId, version, summary.revision ?? "");
      this.clearExternalIdentity(key, writeId, version, summary.revision ?? "");
    }
    const tombstone = this.tombstones.get(key);
    if (old && !isNewer(writeId, version, summary.revision ?? "", old.writeId, old.version, old.revision)) return;
    if (tombstone && !isNewer(writeId, version, summary.revision ?? "", tombstone.writeId, tombstone.version, "")) return;
    this.tombstones.delete(key);
    const snapshot = Object.freeze({ summary: Object.freeze({ ...summary }), version, writeId, revision: summary.revision ?? old?.revision ?? "" });
    if (old && old.writeId === snapshot.writeId && old.version === snapshot.version && old.revision === snapshot.revision) return;
    this.mutateKey(key);
    this.epoch++;
    this.generation++;
    this.entries.set(key, snapshot);
    const prior = this.positions.get(key);
    if (prior === undefined) { this.positions.set(key, this.list.length); this.list = [...this.list, snapshot.summary]; }
    else if (this.list[prior] !== snapshot.summary) {
      const next = [...this.list];
      next[prior] = snapshot.summary;
      this.list = next;
    }
    this.emit(key);
    this.emitList();
  }

  removeReceipt(kind: string, id: string, version: number, writeId: number, lifetime = this.lifetime, source: "local" | "stream" = "local", revision = ""): void {
    if (!this.isCurrentLifetime(lifetime)) return;
    const key = `${kind}\0${id}`;
    if (source === "local" && writeId > 0) {
      this.rememberLocalWrite(key, writeId, version, revision);
      this.clearExternalIdentity(key, writeId, version, revision);
    }
    const old = this.entries.get(key);
    const tombstone = this.tombstones.get(key);
    if (old && !isNewer(writeId, version, "", old.writeId, old.version, "") || tombstone && !isNewer(writeId, version, "", tombstone.writeId, tombstone.version, "")) return;
    this.rememberTombstone(key, version, writeId);
    if (this.entries.has(key)) this.remove(kind, id);
    else {
      this.epoch++;
      this.generation++;
      this.mutateKey(key);
      this.emit(key);
      this.emitList();
    }
  }

  restoreReceipt(summary: StudioEntitySummary, lifetime = this.lifetime): void { this.accept(summary, lifetime); }

  async apply(event: PieceChangeEvent, read: (kind: string, id: string) => Promise<StudioEntitySummary | null>): Promise<void> {
    if (this.locked) throw new Error("piece store is locked");
    const lifetime = this.captureLifetime();
    if (!isPieceChangeEvent(event)) throw new Error("piece change event is malformed");
    if (event.sequence <= this.sequence) return;
    if (event.sequence !== this.sequence + 1) throw new Error("piece change sequence has a gap");
    const key = `${event.kind}\0${event.id}`;
    const old = this.entries.get(key);
    const tombstone = this.tombstones.get(key);
    if (old && old.writeId > event.writeId || tombstone && tombstone.writeId > event.writeId) { this.sequence = event.sequence; return; }
    this.mutateKey(key);
    if (event.action === "delete") {
      if (!this.isCurrentLifetime(lifetime)) return;
      this.removeReceipt(event.kind, event.id, event.version, event.writeId, lifetime, "stream", event.revision);
      this.sequence = event.sequence;
      this.noteExternal(event, key);
      return;
    }
    const pending = this.beginRead(key);
    try {
      const summary = await read(event.kind, event.id);
      if (!this.isCurrentLifetime(lifetime)) return;
      if (pending.generation !== pending.state.generation) {
        const current = this.entries.get(key);
        if (!current || current.writeId < event.writeId) throw new Error("piece changed while its summary was loading");
      } else if (!summary) this.removeReceipt(event.kind, event.id, event.version, event.writeId, lifetime, "stream", event.revision);
      else {
        const writeId = summary.writeId ?? 0;
        if (writeId < event.writeId || writeId === event.writeId && summary.revision !== event.revision) throw new Error("piece summary does not match its committed event");
        this.tombstones.delete(key);
        this.accept(summary, lifetime, "stream");
      }
      this.sequence = event.sequence;
      this.noteExternal(event, key);
    } finally { this.endRead(key, pending.state); }
  }

  private remove(kind: string, id: string): void {
    const key = `${kind}\0${id}`;
    const prior = this.positions.get(key);
    if (!this.entries.delete(key)) return;
    this.mutateKey(key);
    this.epoch++;
    this.generation++;
    if (prior !== undefined) {
      this.list = this.list.filter((row) => row.kind !== kind || row.id !== id);
      this.positions.clear();
      this.list.forEach((row, index) => this.positions.set(`${row.kind}\0${row.id}`, index));
    }
    this.emit(key);
    this.emitList();
  }

  private emit(key: string): void { for (const listener of this.listeners.get(key) ?? []) listener(); }
  private beginRead(key: string): { state: { generation: number; count: number }; generation: number } {
    const state = this.pendingReads.get(key) ?? { generation: 0, count: 0 };
    state.count++;
    this.pendingReads.set(key, state);
    return { state, generation: state.generation };
  }
  private endRead(key: string, state: { generation: number; count: number }): void {
    if (--state.count === 0) this.pendingReads.delete(key);
  }
  private mutateKey(key: string): void { const state = this.pendingReads.get(key); if (state) state.generation++; }
  private rememberTombstone(key: string, version: number, writeId: number): void {
    this.tombstones.delete(key);
    this.tombstones.set(key, { version, writeId });
    if (this.tombstones.size > 4096) this.tombstones.delete(this.tombstones.keys().next().value!);
  }
  private emitList(): void {
    this.publishedStream = { seeded: this.seeded, watching: this.watching, kinds: this.kinds, externalVersion: this.externalVersion, lockEvent: this.lockEvent, sceneTrackers: this.sceneTrackers };
    for (const listener of this.listListeners) listener();
  }
  private noteExternal(event: PieceChangeEvent, key: string): void {
    const identity = `${key}\0${event.writeId}\0${event.version}\0${event.revision}`;
    if (this.localWrites.delete(identity) || this.externalNotices.has(identity)) return;
    this.externalNotices.add(identity);
    if (this.externalNotices.size > 256) this.externalNotices.delete(this.externalNotices.values().next().value!);
    this.kinds = [event.kind];
    this.externalNoticeIdentity = identity;
    this.externalVersion++;
    this.emitList();
  }
  private rememberLocalWrite(key: string, writeId: number, version: number, revision: string): void {
    const identity = `${key}\0${writeId}\0${version}\0${revision}`;
    this.localWrites.delete(identity);
    this.localWrites.add(identity);
    if (this.localWrites.size > 256) this.localWrites.delete(this.localWrites.values().next().value!);
  }
  private clearExternalIdentity(key: string, writeId: number, version: number, revision: string): void {
    const prefix = `${key}\0${writeId}\0${version}\0`;
    for (const identity of this.externalNotices) if (identity.startsWith(prefix) && (!revision || identity === `${prefix}${revision}`)) this.externalNotices.delete(identity);
    if (this.externalNoticeIdentity?.startsWith(prefix) && (!revision || this.externalNoticeIdentity === `${prefix}${revision}`)) {
      this.externalNoticeIdentity = null;
      this.kinds = [];
      this.emitList();
    }
  }
}

function isPieceChangeEvent(value: unknown): value is PieceChangeEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<PieceChangeEvent>;
  return typeof event.kind === "string" && event.kind.length > 0 && typeof event.id === "string" && event.id.length > 0 && typeof event.revision === "string" &&
    Number.isSafeInteger(event.version) && event.version! >= 0 && Number.isSafeInteger(event.writeId) && event.writeId! >= 1 && Number.isSafeInteger(event.sequence) && event.sequence! > 0 &&
    (event.action === "upsert" || event.action === "delete");
}

function isNewer(nextWriteId: number, nextVersion: number, nextRevision: string, currentWriteId: number, currentVersion: number, currentRevision: string): boolean {
  if (nextWriteId !== currentWriteId && (nextWriteId > 0 || currentWriteId > 0)) return nextWriteId > currentWriteId;
  if (nextVersion !== currentVersion) return nextVersion > currentVersion;
  return nextRevision !== currentRevision && nextRevision !== "";
}
