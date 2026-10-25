/**
 * The library's care routes: Settings, Backups and the health check report in
 * Settings, Security. Reached only through server-library.ts, so they are
 * host only and every action is a POST that passed the /api gate (Host, Origin, session token). The
 * lists are readable while locked; preview, restore, scan and repair need the library unlocked (the
 * stores refuse, and the front door answers 423).
 *
 * A scan is a job the screen polls (one per open library): it can take seconds, and the person can stop
 * it. Findings stay here; the screen gets words and an id, and names the finding it wants repaired.
 */
import { hasErrorName } from "../core/guards";
import type { OpenedLibrary } from "./library-root";
import { err, json, readJsonObject } from "./server-security";

type ScanReport = Awaited<ReturnType<OpenedLibrary["health"]["scan"]>>;
type Finding = ScanReport["findings"][number];
type RepairKind = Finding["repairs"][number];

/** What the screen is told about one finding: words and an opaque id of this scan, never a row key (a finding's own id holds one). */
export interface FindingView {
  id: string;
  code: Finding["code"];
  item: string;
  cause: string;
  repairs: readonly RepairKind[];
}

type Job =
  | { state: "running"; done: number; total: number; controller: AbortController }
  | { state: "done"; report: ScanReport; adopted: number; at: number }
  | { state: "failed"; error: string };
const jobs = new WeakMap<OpenedLibrary, Job>();
const found = new WeakMap<OpenedLibrary, Map<string, Finding>>();
/** Bumped whenever the library's content or lock changes under a scan: a scan from an older epoch never publishes. */
const epochs = new WeakMap<OpenedLibrary, number>();
const watched = new WeakSet<OpenedLibrary>();
const epochOf = (library: OpenedLibrary): number => epochs.get(library) ?? 0;

const view = (id: string, f: Finding): FindingView => ({ id, code: f.code, item: f.item, cause: f.cause, repairs: f.repairs });

function jobView(library: OpenedLibrary): unknown {
  const job = jobs.get(library);
  if (!job) return { state: "none" };
  if (job.state === "running") return { state: "running", done: job.done, total: job.total };
  if (job.state === "failed") return { state: "failed", error: job.error };
  const r = job.report;
  return {
    state: "done",
    at: job.at,
    complete: r.complete,
    stoppedAt: r.stoppedAt ?? null,
    sealOwed: r.sealOwed,
    adopted: job.adopted,
    checked: r.checked,
    findings: [...(found.get(library) ?? [])].map(([id, f]) => view(id, f)),
  };
}

function startScan(library: OpenedLibrary): void {
  if (jobs.get(library)?.state === "running") return;
  const controller = new AbortController();
  const job: Job = { state: "running", done: 0, total: library.health.tables.length, controller };
  jobs.set(library, job);
  const epoch = epochOf(library);
  // Findings are words from inside the library: they go the moment the keys do.
  if (!watched.has(library)) {
    watched.add(library);
    library.keyring.onDropKeys(() => forget(library));
  }
  void (async () => {
    try {
      const report = await library.health.scan({ signal: controller.signal, onProgress: () => void (job.done = Math.min(job.total, job.done + 1)) });
      // A scan that finished marks the clean rows that predate fingerprints as good (health-check.md rule 10).
      const adopted = report.complete ? await library.health.adoptFingerprints(report) : 0;
      if (epochOf(library) !== epoch) return; // locked or restored meanwhile: this scan describes a library that is gone
      found.set(library, new Map(report.findings.map((f, i) => [`f${i}`, f])));
      jobs.set(library, { state: "done", report, adopted, at: Date.now() });
    } catch (e) {
      if (epochOf(library) !== epoch) return;
      jobs.set(library, { state: "failed", error: hasErrorName(e, "LockedError") ? "the library is locked" : "the check could not run" });
    }
  })();
}

function forget(library: OpenedLibrary): void {
  epochs.set(library, epochOf(library) + 1);
  const job = jobs.get(library);
  if (job?.state === "running") job.controller.abort();
  jobs.delete(library);
  found.delete(library);
}

const take = (body: Record<string, unknown>, key: string): string | null => (typeof body[key] === "string" && body[key] !== "" ? (body[key] as string) : null);

/** Snapshot refusals are plain sentences (a StageDatabaseError, by name); the code lets the screen choose its label. */
function snapshotFailure(e: unknown): Response | null {
  if (!(e instanceof Error) || !hasErrorName(e, "StageDatabaseError")) return null;
  const code = (e as { code?: unknown }).code;
  return json({ error: e.message, code: typeof code === "string" ? code : "failed" }, code === "missing" || code === "foreign" || code === "busy" ? 409 : 503);
}

export async function handleCareRoutes(sub: string, req: Request, library: OpenedLibrary, isUnlocked: () => Promise<boolean>): Promise<Response | null> {
  if (sub === "backups" && req.method === "GET") {
    const status = library.snapshots.status();
    return json({ unlocked: await isUnlocked(), snapshots: library.snapshots.list(), ...status });
  }
  if (sub.startsWith("health/") && !(await isUnlocked())) {
    forget(library);
    return err("the library is locked", 423);
  }
  if (sub === "health/scan" && req.method === "GET") return json(jobView(library));
  if (req.method !== "POST" || !(sub.startsWith("backups/") || sub.startsWith("health/"))) return null;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.value;
  try {
    switch (sub) {
      case "backups/take": {
        return json({ ok: true, snapshot: await library.snapshots.take("manual") });
      }
      case "backups/remove": {
        const id = take(body, "id");
        if (!id) return err("say which copy", 400);
        return json({ ok: true, removed: await library.snapshots.remove(id) });
      }
      case "backups/preview": {
        const id = take(body, "id");
        if (!id) return err("say which copy", 400);
        return json(await library.snapshots.preview(id));
      }
      case "backups/restore": {
        const id = take(body, "id");
        if (!id) return err("say which copy", 400);
        const done = await library.snapshots.restore(id);
        forget(library);
        return json({ ok: true, ...done });
      }
      case "health/scan":
        startScan(library);
        return json(jobView(library));
      case "health/stop": {
        const job = jobs.get(library);
        if (job?.state === "running") job.controller.abort();
        return json({ ok: true });
      }
      case "health/preview": {
        const finding = found.get(library)?.get(take(body, "findingId") ?? "");
        if (!finding) return err("that item is not in the last check; check again", 409);
        return json(library.health.preview(finding));
      }
      case "health/repair": {
        const findingId = take(body, "findingId") ?? "";
        const finding = found.get(library)?.get(findingId);
        const kind = take(body, "kind");
        if (!finding) return err("that item is not in the last check; check again", 409);
        if (!kind || !finding.repairs.includes(kind as RepairKind)) return err("that repair is not offered for this item", 400);
        const snapshotId = take(body, "snapshotId");
        if (kind === "restore-snapshot" && !snapshotId) return err("say which copy", 400);
        const result = await library.health.repair(kind === "restore-snapshot" ? { kind, finding, snapshotId: snapshotId! } : { kind: kind as "roll-back" | "set-aside" | "re-sign", finding });
        if (kind === "restore-snapshot") forget(library); // the whole library changed: the last check no longer describes it
        else if (result.cleared) {
          // The list the person sees is the last scan; a repair that cleared its item takes it off.
          found.get(library)?.delete(findingId);
        }
        return json({ ok: true, ...result });
      }
      default:
        return null;
    }
  } catch (e) {
    const refused = snapshotFailure(e);
    if (refused) return refused;
    throw e;
  }
}
