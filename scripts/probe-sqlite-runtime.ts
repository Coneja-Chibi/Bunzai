/**
 * Proves the SQLite runtime capabilities the data model depends on, inside whatever artifact is
 * running this code. Decision D4 puts the library and the chat store in one SQLite database, and
 * `bun:sqlite` is a runtime built-in rather than a package, so "it works under `bun run`" says
 * nothing about the compiled single-file binary that users receive (ADR-001, ADR-003).
 *
 * Run interpreted for a fast local signal, or compile it with `bun build --compile` and run the
 * binary to get packaged-artifact proof. The CI matrix does the second on every supported runner.
 */
import { Database } from "bun:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";

/** Generated columns, which the `documents` table uses, landed in SQLite 3.31.0. */
export const MINIMUM_SQLITE_VERSION = [3, 31, 0] as const;

export interface ProbeCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface ProbeResult {
  readonly version: string;
  readonly checks: readonly ProbeCheck[];
  readonly ok: boolean;
}

export function parseVersion(version: string): readonly number[] {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

export function meetsMinimumVersion(version: string): boolean {
  const actual = parseVersion(version);
  for (let i = 0; i < MINIMUM_SQLITE_VERSION.length; i += 1) {
    const got = actual[i] ?? 0;
    const need = MINIMUM_SQLITE_VERSION[i] ?? 0;
    if (got > need) return true;
    if (got < need) return false;
  }
  return true;
}

function check(name: string, run: () => string): ProbeCheck {
  try {
    return { name, ok: true, detail: run() };
  } catch (error) {
    return { name, ok: false, detail: (error as Error)?.message ?? String(error) };
  }
}

/**
 * Exercises every SQLite feature the schema relies on, against a
 * throwaway database file. Leaves nothing behind, including the write-ahead log sidecars.
 *
 * `dbPath` exists so a test can name the file and then assert it and its sidecars are gone.
 */
export function probeSqliteRuntime(dbPath?: string): ProbeResult {
  const path = dbPath ?? join(tmpdir(), `bunraku-probe-${process.pid}-${Date.now()}.db`);
  const cleanup = () => {
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        rmSync(path + suffix);
      } catch {
        // A sidecar that was never created is not a failure.
      }
    }
  };

  try {
    const db = new Database(path, { create: true });
    const version = (db.query("SELECT sqlite_version() AS v").get() as { v: string }).v;
    const checks: ProbeCheck[] = [];

    checks.push({
      name: "version at or above 3.31",
      ok: meetsMinimumVersion(version),
      detail: version,
    });

    checks.push(
      check("write-ahead logging", () => {
        const mode = db.query("PRAGMA journal_mode = WAL").get() as { journal_mode: string };
        if (mode.journal_mode !== "wal") throw new Error(`journal_mode is ${mode.journal_mode}`);
        return "wal";
      }),
    );

    checks.push(
      check("foreign key enforcement", () => {
        db.run("PRAGMA foreign_keys = ON");
        const on = db.query("PRAGMA foreign_keys").get() as { foreign_keys: number };
        if (on.foreign_keys !== 1) throw new Error("foreign keys did not enable");
        return "on";
      }),
    );

    checks.push(
      check("generated columns, stored and virtual", () => {
        db.run(`CREATE TABLE documents (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          name TEXT NOT NULL,
          body_json TEXT NOT NULL,
          deleted_at INTEGER,
          name_lower TEXT GENERATED ALWAYS AS (lower(name)) STORED,
          token_estimate INTEGER GENERATED ALWAYS AS (length(body_json) / 4) VIRTUAL
        )`);
        return "stored and virtual accepted";
      }),
    );

    checks.push(
      check("index over a generated column", () => {
        db.run("CREATE INDEX idx_documents_name_lower ON documents(name_lower)");
        return "created";
      }),
    );

    // Every prepared statement must be finalized before the handle will actually close. See the
    // "close releases the file" check below for why that is a product concern and not bookkeeping.
    const statements: { finalize: () => void }[] = [];

    checks.push(
      check("prepared statements inside a transaction", () => {
        // Deliberately BEGIN and COMMIT by hand rather than using `db.transaction()`. That helper
        // keeps internal statements alive that neither `finalize()` nor `clearQueryCache()` releases,
        // so a database that has ever used it can no longer be closed. See "close releases the file".
        const insert = db.prepare("INSERT INTO documents (id, kind, name, body_json) VALUES (?, ?, ?, ?)");
        statements.push(insert);
        db.run("BEGIN");
        insert.run("a", "character", "Vera Nox", '{"summary":"first"}');
        insert.run("b", "lorebook", "The Gallery", '{"summary":"second"}');
        db.run("COMMIT");
        const count = db.query("SELECT count(*) AS c FROM documents").get() as { c: number };
        if (count.c !== 2) throw new Error(`expected 2 rows, saw ${count.c}`);
        return "2 rows committed";
      }),
    );

    checks.push(
      check("generated values are queryable", () => {
        const row = db.query("SELECT name_lower, token_estimate FROM documents WHERE name_lower = ?").get("vera nox") as
          | { name_lower: string; token_estimate: number }
          | null;
        if (!row) throw new Error("generated column did not match on lookup");
        return `${row.name_lower}, ${row.token_estimate} tokens`;
      }),
    );

    checks.push(
      check("json1 functions", () => {
        const row = db.query("SELECT json_extract(body_json, '$.summary') AS s FROM documents WHERE id = 'a'").get() as {
          s: string;
        };
        if (row.s !== "first") throw new Error(`json_extract returned ${row.s}`);
        return "json_extract";
      }),
    );

    checks.push(
      check("fts5 virtual tables", () => {
        db.run("CREATE VIRTUAL TABLE search USING fts5(body)");
        db.run("INSERT INTO search (body) VALUES ('the gallery of unfinished portraits')");
        const hit = db.query("SELECT count(*) AS c FROM search WHERE search MATCH 'portraits'").get() as { c: number };
        if (hit.c !== 1) throw new Error(`fts5 matched ${hit.c} rows`);
        return "indexed and matched";
      }),
    );

    checks.push(
      check("fts5 name trigram tokenizer", () => {
        db.run("CREATE VIRTUAL TABLE name_search USING fts5(name, tokenize='trigram')");
        db.run("INSERT INTO name_search (name) VALUES ('gallery')");
        const hit = db.query("SELECT count(*) AS c FROM name_search WHERE name_search MATCH 'all'").get() as { c: number };
        if (hit.c !== 1) throw new Error(`trigram matched ${hit.c} rows`);
        return "substring indexed and matched";
      }),
    );

    checks.push(
      check("metadata-only sealed-cell byte counts", () => {
        db.run("CREATE TABLE size_probe (cell TEXT)");
        db.run("INSERT INTO size_probe (cell) VALUES (?)", ["\u00e9"]);
        const row = db.query("SELECT octet_length(cell) AS bytes FROM size_probe").get() as { bytes: number };
        if (row.bytes !== 2) throw new Error(`octet_length returned ${row.bytes}`);
        return "UTF-8 bytes from actual column";
      }),
    );

    checks.push(
      check("rollback leaves no partial write", () => {
        const insert = db.prepare("INSERT INTO documents (id, kind, name, body_json) VALUES (?, ?, ?, ?)");
        statements.push(insert);
        db.run("BEGIN");
        insert.run("c", "character", "Doomed", "{}");
        db.run("ROLLBACK");
        const row = db.query("SELECT count(*) AS c FROM documents WHERE id = 'c'").get() as { c: number };
        if (row.c !== 0) throw new Error("a rolled-back row survived");
        return "clean";
      }),
    );

    checks.push(
      check("close releases the file", () => {
        // Any live prepared statement makes close() fail, and without the throwing form it fails
        // SILENTLY, leaving the file locked: backups cannot copy it cleanly and Windows cannot move
        // or delete it. Two kinds have to go: the ones we prepared, and the ones `db.query()` cached
        // for us. Then close loudly, so a regression here can never be quiet.
        for (const statement of statements) statement.finalize();
        db.clearQueryCache();
        db.close(true);
        return "statements finalized, query cache cleared, closed";
      }),
    );

    checks.push(
      check("data survives close and reopen", () => {
        const reopened = new Database(path, { readonly: true });
        const row = reopened.query("SELECT name FROM documents WHERE id = 'b'").get() as { name: string } | null;
        reopened.close();
        if (row?.name !== "The Gallery") throw new Error("row did not survive reopen");
        return "durable";
      }),
    );

    return { version, checks, ok: checks.every((c) => c.ok) };
  } finally {
    cleanup();
  }
}

export function formatResult(result: ProbeResult): string {
  const lines = [`sqlite ${result.version} on ${process.platform}/${process.arch}`];
  for (const c of result.checks) lines.push(`  ${c.ok ? "ok  " : "FAIL"} ${c.name}: ${c.detail}`);
  lines.push(result.ok ? "probe-sqlite-runtime: all checks passed" : "probe-sqlite-runtime: FAILED");
  return lines.join("\n");
}

if (import.meta.main) {
  const result = probeSqliteRuntime();
  console.log(formatResult(result));
  process.exit(result.ok ? 0 : 1);
}
