/**
 * The health check's repairs. Nothing is ever deleted
 * outright: a set-aside row is copied whole into `set_aside` (a table no purge reads) in the same
 * transaction that removes it, a damaged text cell is replaced and its old row kept, and a roll back
 * is a new version through the ContentStore. Every repair is one atomic change that is then
 * re-checked, and a repair that does not clear its finding says so.
 */
import type { ContentStore } from "../../contracts/content-store";
import type { CellCipher } from "../../crypto/cell-cipher";
import { StageDatabaseError, type StageDatabase } from "./database";
import { CELL_COLUMNS, whereOf } from "./health-cells";
import type { CheckLane, RepairLane } from "./health-lane";
import { factsKey, factsOf, StaleRepair } from "./health-move";
import { closureOf, describeMoves, keyColumns, ownersOfParts, refOf, valuesOf, whereKey } from "./health-closure";
import { rollBackTarget } from "./health-roll-target";
import type { Labels } from "./health-labels";
import type { Finding, Repair, RepairResult, RowRef, ScanReport, SetAsidePreview, SnapshotRestorer } from "./health-types";
import { signRow, specOf } from "./row-fingerprints";

export const PLACEHOLDER_TEXT = "This text was damaged and set aside.";

type Row = Record<string, string | number | null>;
/** What happens to one damaged cell: replaced by the placeholder text, or cleared to null. */
type CellPlan = { cells: Readonly<Record<string, "placeholder" | null>> };
type Plan = { readonly row: RowRef; readonly cells: CellPlan["cells"] } | { readonly rows: readonly RowRef[] };

export interface RepairDeps {
  readonly database: StageDatabase;
  readonly cipher: CellCipher;
  readonly labels: Labels;
  readonly content: Pick<ContentStore, "versions" | "readVersion" | "restoreVersion">;
  readonly snapshots?: SnapshotRestorer;
  /** Opens a row's cells on the background lane (health-lane.ts). */
  readonly lane: CheckLane;
  /** Writes a repair on the lane (health-move.ts): a 20 MB cell never passes through the main thread. */
  readonly repairLane: RepairLane;
  readonly clock: () => number;
  /** Re-scans only the named tables (and the structure) to see whether a finding is gone. */
  readonly recheck: (tables?: readonly string[]) => Promise<ScanReport>;
}

/** Text cells that keep their row and show the placeholder; optional cells that are cleared. */
const CELL_PLANS: Readonly<Record<string, Readonly<Record<string, "placeholder" | null>>>> = {
  "chats.title": { title: "placeholder" },
  "chats.previous_cast_json": { previous_cast_json: null },
  "chats.connection_json": { connection_json: null },
  "chats.preset_json": { preset_json: null },
  "chats.lore_json": { lore_json: null },
  "chats.props_json": { props_json: null },
  "chats.opening_json": { opening_json: null },
  "chats.prompting_json": { prompting_json: null },
  "chats.backdrop_json": { backdrop_json: null },
  "chats.compendium_json": { compendium_json: null },
  "chats.participants_json": { participants_json: null },
  "chats.regex_json": { regex_json: null },
  "chats.trackers_json": { trackers_json: null },
  "chats.final_cut_json": { final_cut_json: null },
  "chats.summary_json": { summary_json: null },
  "chats.director_json": { director_json: null },
  "branches.name": { name: "placeholder" },
  "branches.last_request_json": { last_request_json: null },
  "swipes.content": { content: "placeholder" },
  "swipes.generation_json": { generation_json: null },
  "turn_checkpoints.trace_json": { trace_json: null },
  "turn_checkpoints.provider_request_id": { provider_request_id: null },
  "scene_folders.name": { name: "placeholder" },
  "document_summaries.summary_cell": { summary_cell: null, revision_cell: null, derived_version: null },
  "document_summaries.revision_cell": { summary_cell: null, revision_cell: null, derived_version: null },
  "grave_summaries.summary_cell": { summary_cell: null, revision_cell: null, derived_version: null },
  "grave_summaries.revision_cell": { summary_cell: null, revision_cell: null, derived_version: null },
};

export function createRepairs(deps: RepairDeps) {
  const { database, cipher, clock } = deps;
  const { statement } = database;
  const rowAt = (ref: RowRef): Row | null =>
    (statement(`SELECT * FROM ${ref.table} WHERE ${whereKey(ref.table)}`).get(...valuesOf(ref)) as Row | null) ?? null;

  /** What a damaged content part takes with it: a live part, its whole piece or chat; a closed one, only the history that saw it. */
  const planOfPart = (part: Row): RowRef[] => {
    const own = closureOf(statement, cipher, refOf("piece_parts", Number(part.id)));
    if (part.to_version !== null) {
      const seeing = statement(
        `SELECT json_array(kind, id, version) AS rk, 'document_versions' AS t FROM document_versions WHERE kind = ?1 AND id = ?2 AND version >= ?3 AND version < ?4
         UNION ALL SELECT json_array(v.grave_id, v.version), 'grave_versions' FROM grave_versions v JOIN document_graves g ON g.grave_id = v.grave_id
          WHERE g.kind = ?1 AND g.id = ?2 AND v.version >= ?3 AND v.version < ?4`,
      ).all(String(part.kind), String(part.doc), Number(part.from_version), Number(part.to_version)) as { rk: string; t: string }[];
      return dedupe([...seeing.map((s) => ({ table: s.t, key: s.rk })), ...own]);
    }
    const owners = ownersOfParts(statement, cipher, [{ kind: String(part.kind), doc: String(part.doc) }]);
    return dedupe([...owners.flatMap((o) => closureOf(statement, cipher, o)), ...own]);
  };

  const planOf = (finding: Finding): Plan => {
    const row = refOf(finding.row.table, ...valuesOf(finding.row));
    if (finding.code === "cell-unreadable" && finding.column) {
      const cells = CELL_PLANS[`${finding.row.table}.${finding.column}`];
      if (cells) return { row, cells };
    }
    if (row.table === "piece_parts") {
      const part = rowAt(row);
      if (part) return { rows: planOfPart(part) };
    }
    if (row.table === "blobs") {
      const using = statement("SELECT p.* FROM blob_refs r JOIN piece_parts p ON p.id = r.part_id WHERE r.blob = ?").all(String(valuesOf(row)[0])) as Row[];
      return { rows: dedupe([...using.flatMap(planOfPart), ...closureOf(statement, cipher, row)]) };
    }
    return { rows: closureOf(statement, cipher, row) };
  };

  const dedupe = (refs: readonly RowRef[]): RowRef[] => [...new Map(refs.map((r) => [`${r.table}|${r.key}`, r])).values()];

  const keep = (group: string, ref: RowRef, row: Row, reason: string) =>
    statement("INSERT INTO set_aside (group_id, at, tbl, row_key, row_json, reason) VALUES (?, ?, ?, ?, ?, ?)").run(
      group, clock(), ref.table, ref.key, JSON.stringify(row), reason,
    );

  /** The facts the check saw for each row of a plan, taken before the re-check so a write in between shows as a difference. */
  const factsFor = (refs: readonly RowRef[]): Record<string, string> =>
    Object.fromEntries(refs.flatMap((r) => { const f = factsOf(statement, r); return f === null ? [] : [[factsKey(r), f] as const]; }));

  /** Moves rows into `set_aside`, children first, in one transaction on the lane. Returns how many moved. */
  const moveRows = async (refs: readonly RowRef[], reason: string, expect: Record<string, string> = {}): Promise<number> => {
    const moved = await deps.repairLane({ move: { refs, group: crypto.randomUUID(), at: clock(), reason, expect } });
    await database.sealNow(); // the lane's writes queued their rows; sign them here, under the library's key
    return moved;
  };

  async function replaceCells(ref: RowRef, cells: CellPlan["cells"], reason: string, expect: Record<string, string>): Promise<void> {
    const mapped = Object.fromEntries(
      Object.entries(cells).map(([column, how]) => {
        if (how === null) return [column, null] as const;
        const spec = (CELL_COLUMNS[ref.table] ?? []).find((c) => c.column === column);
        return [column, { where: spec ? whereOf(ref.table, spec) : `${ref.table}.${column}`, text: PLACEHOLDER_TEXT }] as const;
      }),
    );
    await deps.repairLane({ cells: { ref, cells: mapped, group: crypto.randomUUID(), at: clock(), reason, expect } });
    await database.sealNow();
  }

  const preview = (finding: Finding): SetAsidePreview => {
    const plan = planOf(finding);
    if ("cells" in plan) {
      const text = Object.values(plan.cells).includes("placeholder");
      return { rows: { [plan.row.table]: 1 }, summary: text ? "the damaged text will be replaced and the original kept aside" : "the damaged setting will be cleared and the original kept aside" };
    }
    return describeMoves(plan.rows);
  };

  const reasonOf = (f: Finding) => `${f.cause} (${f.code})`;

  async function rollBack(finding: Finding, wanted: string | null): Promise<string | null> {
    const row = rowAt(finding.row);
    const target = row ? rollBackTarget(statement, deps.labels, finding.row.table, row) : null;
    if (!target) return "there is no earlier version to return to";
    if (target.kind === "swipe") {
      const history = statement("SELECT n, content FROM swipe_history WHERE message_id = ? AND swipe_id = ? ORDER BY n DESC").all(target.messageId, target.swipeId) as { n: number; content: string }[];
      for (const h of history) {
        let text: string;
        try {
          text = cipher.open("swipe_history.content", h.content);
        } catch {
          continue;
        }
        await database.patiently(() =>
          database.transaction(() => {
            if (wanted !== null && factsOf(statement, finding.row) !== wanted) throw new StaleRepair();
            keep(crypto.randomUUID(), finding.row, row!, reasonOf(finding));
            statement("UPDATE swipes SET content = ? WHERE message_id = ? AND swipe_id = ?").run(cipher.seal("swipes.content", text), target.messageId, target.swipeId);
          }),
        );
        return null;
      }
      return "none of this reply's earlier texts would open either";
    }
    for (const piece of target.pieces) {
      const { versions, quarantined } = await deps.content.versions(piece.kind as never, piece.id);
      let rolled = false;
      for (const v of [...versions].reverse()) {
        if (quarantined.includes(v.version)) continue;
        try {
          if (!(await deps.content.readVersion(piece.kind as never, piece.id, v.version))) continue;
        } catch {
          continue;
        }
        await deps.content.restoreVersion(piece.kind as never, piece.id, v.version);
        rolled = true;
        break;
      }
      if (!rolled) return `no earlier version of "${piece.id}" would read`;
    }
    return null;
  }

  /** The finding is only acted on while a fresh check still reports it. */
  const stillReported = async (finding: Finding): Promise<boolean> => (await deps.recheck([finding.row.table])).findings.some((f) => f.id === finding.id);
  const alreadyFine: RepairResult = { cleared: true, summary: "it checks clean now, so nothing was changed" };

  async function repair(request: Repair): Promise<RepairResult> {
    try {
      return await repairNow(request);
    } catch (error) {
      if (error instanceof StaleRepair) return { cleared: false, summary: `nothing was changed: ${error.message}` };
      throw error;
    }
  }

  async function repairNow(request: Repair): Promise<RepairResult> {
    const { finding } = request;
    let said: string;
    switch (request.kind) {
      case "restore-snapshot": {
        if (!deps.snapshots) return { cleared: false, summary: "no snapshot store is available to restore from" };
        if (!deps.snapshots.list().some((s) => s.id === request.snapshotId)) return { cleared: false, summary: "that snapshot is no longer there" };
        try {
          await deps.snapshots.restore(request.snapshotId);
        } catch (error) {
          // The store's own refusals (no room, another library, locked) are plain sentences and changed nothing.
          if (error instanceof StageDatabaseError) return { cleared: false, summary: `nothing was restored: ${error.message}` };
          throw error;
        }
        // Re-checked like every repair (rule 13): the snapshot may hold the same damage.
        const after = await deps.recheck(finding.row.table === "(file)" ? undefined : [finding.row.table]);
        const still = after.findings.find((f) => f.id === finding.id);
        const kept = "a copy of how it was before is kept, so this can be undone";
        return still
          ? { cleared: false, summary: `the library was restored from the snapshot (${kept}), but it is still reported: ${still.cause}` }
          : { cleared: true, summary: `the library was restored from the snapshot; the item checks clean (${kept})` };
      }
      case "roll-back": {
        const wanted = factsOf(statement, finding.row);
        if (!(await stillReported(finding))) return alreadyFine;
        const problem = await rollBack(finding, wanted);
        if (problem) return { cleared: false, summary: `nothing was changed: ${problem}` };
        said = "rolled back to the newest earlier version that reads";
        if (finding.row.table === "piece_parts" || finding.row.table === "blobs") {
          // The damaged part now belongs only to history; the versions that need it go aside with it.
          const again = await deps.recheck([finding.row.table]);
          const plan = again.findings.some((f) => f.id === finding.id) ? planOf(finding) : null;
          if (plan && "rows" in plan) {
            await moveRows(plan.rows, reasonOf(finding));
            said += ", and the older versions that depended on the damaged part were set aside";
          }
        }
        break;
      }
      case "re-sign": {
        const spec = specOf(finding.row.table);
        if (!spec) return { cleared: false, summary: "this kind of row has no fingerprint to replace" };
        const wanted = factsOf(statement, finding.row);
        const { rows } = await deps.lane({ table: finding.row.table, keys: [finding.row.key] });
        if (rows.some((r) => r.bad.length > 0)) return { cleared: false, summary: "nothing was changed: the row still has text that will not open" };
        await database.patiently(() =>
          database.transaction(() => {
            if (wanted !== null && factsOf(statement, finding.row) !== wanted) throw new StaleRepair(); // changed since it was looked at: never bless it
            signRow(statement, cipher, spec, finding.row.key);
          }),
        );
        said = "the row was accepted as it is";
        break;
      }
      case "set-aside": {
        const plan = planOf(finding);
        const expect = factsFor("cells" in plan ? [plan.row] : plan.rows);
        if (!(await stillReported(finding))) return alreadyFine;
        if ("cells" in plan) await replaceCells(plan.row, plan.cells, reasonOf(finding), expect);
        else await moveRows(plan.rows, reasonOf(finding), expect);
        said = "the damaged item was set aside, not deleted";
        break;
      }
    }
    const tables = new Set([finding.row.table, ...(request.kind === "set-aside" ? tablesOf(planOf(finding)) : [])]);
    const after = await deps.recheck([...tables]);
    const left = after.findings.filter((f) => f.row.table === finding.row.table && f.row.key === finding.row.key);
    return left.length === 0
      ? { cleared: true, summary: `${said}; the item checks clean` }
      : { cleared: false, summary: `${said}, but it is still reported: ${left[0]!.cause}` };
  }
  const tablesOf = (plan: Plan): string[] => ("cells" in plan ? [plan.row.table] : [...new Set(plan.rows.map((r) => r.table))]);

  return { preview, repair };
}
