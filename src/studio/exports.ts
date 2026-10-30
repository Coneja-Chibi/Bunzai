/**
 * The Export folder: where a converted, foreign-format artifact lands, one fresh folder per export,
 * `<studio>/Export/<YYYY-MM-DD HH-MM-SS> <label>/`. The Press and the export dialog fill one through
 * the host's /api/export-folder routes (ui/server-export-folder.ts); Kit's export tool through
 * `StudioExports`. This module is the one place that makes those folders.
 *
 * This is a SEPARATE authority from StudioStore on purpose. StudioStore owns canonical entities and
 * every one of its invariants (revisions, escrow, create-only compare) is about canonical content.
 * An export is not canonical: it is a one-way projection into somebody else's wire format, it has no
 * revision, and re-importing it is a fresh import rather than an update.
 *
 * THE CALLER NEVER SUPPLIES A PATH. Kit supplies an entity id and a bare extension; the file name is
 * minted by `exportRunFileName` and placed by `resolveStudioExportRunPath` (path-policy.ts), which
 * keep every name one plain segment with an extension from a closed set. That is what makes this safe
 * to expose to a model: there is no path argument to point somewhere else.
 *
 * Writes are create-only. An export that silently overwrote an earlier one would destroy a file the
 * user may have already sent somewhere, and unlike a canonical piece there is no revision history to
 * recover it from. A fresh folder per export makes a clash all but impossible anyway.
 */
import { mkdir } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { sanitizeDownloadBase } from "../core/download-name";
import { writeExclusive } from "./atomic-file";
import { exportRunFileName, resolveStudioExportRunPath } from "./path-policy";
import { StudioConflictError, StudioWriteError } from "./errors";

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local time, sortable, and legal in a Windows folder name. */
export const exportStamp = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

/** Create one export's folder, adding " (2)", ... when another export took that name in the same second. */
export async function createExportRun(root: string, label: string): Promise<{ dir: string; folder: string }> {
  const base = `${exportStamp(new Date())} ${sanitizeDownloadBase(Array.from(label).slice(0, 40).join(""), "export")}`;
  for (let i = 1; i <= 100; i++) {
    const folder = i === 1 ? base : `${base} (${i})`;
    const dir = resolveStudioExportRunPath(root, folder);
    await mkdir(dirname(dir), { recursive: true });
    try {
      await mkdir(dir);
      return { dir, folder };
    } catch (e) {
      if ((e as { code?: string }).code !== "EEXIST") throw e;
    }
  }
  throw new StudioWriteError("too many exports with this name; try a different label");
}

export interface ExportReceipt {
  status: "written" | "exists";
  /** Absolute path on disk, for a human to open. */
  path: string;
  /** Path relative to the studio root, safe to show in a terminal without leaking a home directory. */
  relativePath: string;
  bytes: number;
}

export class StudioExports {
  constructor(private readonly root: string) {}

  /**
   * Write one converted artifact into its own `Export/<stamp> Kit <id>/` folder. The folder is new, so
   * `exists` only reports something else creating that file mid-write; it stays an ordinary outcome.
   */
  async write(id: string, extension: string, body: string | Uint8Array): Promise<ExportReceipt> {
    const name = exportRunFileName(`${id}.${extension.replace(/^\./, "")}`);
    const { folder } = await createExportRun(this.root, `Kit ${id}`);
    const path = resolveStudioExportRunPath(this.root, folder, name);
    const relativePath = relative(this.root, path).split("\\").join("/");
    const bytes = typeof body === "string" ? new TextEncoder().encode(body).byteLength : body.byteLength;
    try {
      await writeExclusive(path, body);
      return { status: "written", path, relativePath, bytes };
    } catch (error) {
      if (error instanceof StudioConflictError || (error as { code?: string }).code === "EEXIST") {
        return { status: "exists", path, relativePath, bytes };
      }
      throw error;
    }
  }
}
