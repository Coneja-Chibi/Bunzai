/** One bounded, cancellable cold-fill lane per opened SQLite library. */
import type { KeyLease } from "../crypto/keyring-lifecycle";
import type { StageDatabase } from "./sqlite/database";
import { foldId } from "../contracts/content-store";
import { startLaneWorker, reusableLane } from "../worker-lane";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import type { PartRecord } from "../../entities/piece-parts";
import { DamagedDataError } from "../damaged-data-error";
import { StudioBusyError, StudioReadError, type StudioDamageReason } from "../../studio/errors";
import { COLD_READ_LIMIT, coldReadCharge } from "./cold-read-budget";

const WAITING = 2;
const MAX_PARTS = 20_000;
const MAX_REFS = 100_000;
const COLD_WORKER_IDLE_MS = 30_000;
type Filled = { entity: ParsedCanonicalEntity; parts: PartRecord[]; usedCharge: number };
type ColdFill = { writeId: number; filled: Filled; valid(): boolean; release(): void } | { status: "missing" | "stale" };
type Job = { kind: string; id: string; docKey: string; writeId: number; hold: boolean; charge: number; generation: number; resolve(value: ColdFill): void; reject(error: Error): void };
type WorkerReply = { ok: true; value: { writeId: number; snapshotCharge: number; filled: Filled } | null } | { ok: false; error: { kind: "damaged"; where: string; reason: string } | { kind: "damage"; reason: StudioDamageReason } | { kind: "read"; reason: string } };

export function createColdReadService(input: {
  database: StageDatabase; path: string; cipher: { index(value: string): string; ready(): void };
  keyring: { leaseKeys(): KeyLease; onDropKeys(listener: () => void): () => void };
}) {
  const queue: Job[] = [];
  /** One warm worker for the run of reads a bulk import makes: Bun does not give a terminated worker's memory back. */
  const lane = reusableLane<{ path: string; kind: string; id: string; docKey: string; writeId: number; hold: boolean; maxCharge: number; content: Uint8Array; index: Uint8Array }, WorkerReply>(
    () => startLaneWorker(() => new Worker("./stage/store/cold-read-worker.ts"), new URL("./cold-read-worker.ts", import.meta.url).href),
    COLD_WORKER_IDLE_MS,
  );
  let active: Job | null = null;
  let activeCancel: (() => void) | null = null;
  let reservedBytes = 0;
  /** the part of the running job's reservation that is only headroom (its ceiling minus its own charge); new arrivals may queue behind it */
  let activeSlack = 0;
  let generation = 0;
  let closed = false;
  const cancel = (): void => {
    generation++;
    for (const job of queue.splice(0)) { reservedBytes -= job.charge; job.reject(new Error("cold read cancelled because the library key or service closed")); }
    activeCancel?.();
    lane.close();
  };
  const unsubscribe = input.keyring.onDropKeys(cancel);

  const runNext = (): void => {
    if (active || closed) return;
    const job = queue.shift();
    if (!job) return;
    active = job;
    const maxCharge = COLD_READ_LIMIT - (reservedBytes - job.charge);
    if (!Number.isSafeInteger(maxCharge) || maxCharge < job.charge) {
      job.reject(new StudioBusyError());
      reservedBytes -= job.charge;
      active = null;
      runNext();
      return;
    }
    activeSlack = maxCharge - job.charge;
    reservedBytes += activeSlack;
    job.charge = maxCharge;
    let lease: KeyLease | null = null;
    let reader: { close(): void } | null = null;
    let handedOff = false;
    const controller = new AbortController();
    activeCancel = () => controller.abort();
    try {
      input.cipher.ready();
      lease = input.keyring.leaseKeys();
      const outer = controller;
      lease.signal.addEventListener("abort", () => outer.abort(), { once: true });
      if (!lease.valid()) throw new Error("the library locked before the cold read started");
      reader = input.database.openWorkerReader("cold piece fill", () => controller.abort());
      const result = lane.run(
        { path: input.path, kind: job.kind, id: job.id, docKey: job.docKey, writeId: job.writeId, hold: job.hold, maxCharge, content: lease.content, index: lease.index },
        30_000,
        [lease.content.buffer as ArrayBuffer, lease.index.buffer as ArrayBuffer],
        controller.signal,
      );
      void result.then((reply) => {
        if ("reason" in reply) {
          if (lease?.signal.aborted) throw new Error("cold read cancelled because the library key was dropped");
          throw new Error(reply.reason);
        }
        if ("ok" in reply && reply.ok === false) {
          if (reply.error.kind === "damaged") {
            const prefix = `damaged data in ${reply.error.where}: `;
            throw new DamagedDataError(reply.error.where, reply.error.reason.startsWith(prefix) ? reply.error.reason.slice(prefix.length) : reply.error.reason);
          }
          if (reply.error.kind === "damage") throw new StudioReadError(`${job.kind} ${job.id} is damaged`, reply.error.reason);
          throw new Error(reply.error.reason);
        }
        if (reply && "ok" in reply && reply.ok && !lease?.valid()) throw new Error("cold read cancelled because the library key was dropped");
        if (reply && "ok" in reply && reply.ok && closed) throw new Error("the library closed while opening the piece");
        const value = reply && "ok" in reply ? reply.value : null;
        if (value && value.writeId !== job.writeId) throw new Error("cold read returned a stale write identity");
        if (value) {
          const totalCharge = value.snapshotCharge + value.filled.usedCharge;
          if (!Number.isSafeInteger(value.snapshotCharge) || value.snapshotCharge < 0 || !Number.isSafeInteger(value.filled.usedCharge) || value.filled.usedCharge < 0 ||
              !Number.isSafeInteger(totalCharge) || totalCharge > maxCharge || reservedBytes - job.charge + totalCharge > COLD_READ_LIMIT) {
            throw new Error("the opened piece exceeds the bounded cold-read memory limit");
          }
          reservedBytes -= job.charge - totalCharge;
          activeSlack = 0;
          job.charge = totalCharge;
          handedOff = true;
          let released = false;
          job.resolve({ ...value, valid: () => !closed && generation === job.generation, release: () => {
            if (released) return;
            released = true;
            reservedBytes -= job.charge;
          } });
        } else job.resolve({ status: "stale" });
      }).catch((error: unknown) => job.reject(error instanceof Error ? error : new Error("cold read failed")))
        .finally(() => { lease?.release(); reader?.close(); if (!handedOff) reservedBytes -= job.charge; activeSlack = 0; active = null; activeCancel = null; runNext(); });
    } catch (error) {
      lease?.release(); reader?.close();
      job.reject(error instanceof Error ? error : new Error("cold read failed"));
      reservedBytes -= job.charge; activeSlack = 0; active = null; activeCancel = null; runNext();
    }
  };

  return {
    /** `hold`: open the piece for a patch, its pictures kept as references instead of expanded (the worker opens only the blobs a part needs read). */
    async fill(kind: string, id: string, writeId: number, mode?: "hold"): Promise<ColdFill> {
      const hold = mode === "hold";
      if (closed || input.path === ":memory:") throw new Error("cold worker unavailable for this library");
      const admittedGeneration = generation;
      input.cipher.ready();
      const docKey = input.cipher.index(`${kind}\u0000${foldId(id)}`);
      const size = await input.database.patiently(() => {
        const parts = input.database.statement(`SELECT count(*) AS rows, coalesce(sum(octet_length(cell)), 0) AS bytes FROM piece_parts WHERE kind = ? AND doc = ? AND to_version IS NULL`).get(kind, docKey) as { rows: number; bytes: number };
        const refs = input.database.statement(`SELECT count(*) AS rows, coalesce(sum(octet_length(b.cell)), 0) AS bytes FROM blob_refs r JOIN piece_parts p ON p.id = r.part_id JOIN blobs b ON b.key = r.blob WHERE p.kind = ? AND p.doc = ? AND p.to_version IS NULL`).get(kind, docKey) as { rows: number; bytes: number };
        return { parts, refs };
      });
      if (closed || generation !== admittedGeneration) throw new Error("cold read cancelled because the library key or service changed");
      if (size.parts.rows === 0) return { status: "missing" };
      // A held fill never opens a picture's cell, so its bytes are not part of the admission; the worker
      // charges the text blobs it does open against the same ceiling.
      const charge = coldReadCharge(size.parts.bytes + (hold ? 0 : size.refs.bytes), size.parts.rows, size.refs.rows);
      if (size.parts.rows > MAX_PARTS || size.refs.rows > MAX_REFS || !Number.isSafeInteger(charge) || charge > COLD_READ_LIMIT) throw new Error("this piece exceeds the bounded cold-read memory limit");
      if (active && queue.length >= WAITING) throw new StudioBusyError();
      if (reservedBytes - activeSlack + charge > COLD_READ_LIMIT) throw new StudioBusyError();
      reservedBytes += charge;
      return new Promise<ColdFill>((resolve, reject) => { queue.push({ kind, id, docKey, writeId, hold, charge, generation: admittedGeneration, resolve, reject }); runNext(); });
    },
    close(): void { if (closed) return; closed = true; cancel(); unsubscribe(); },
  };
}
