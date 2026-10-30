/**
 * Exports land on disk, one fresh folder per export: `POST /api/export-folder` ({ label }) creates
 * `<studio>/Export/<YYYY-MM-DD HH-MM-SS> <label>/` (studio/exports.ts makes it), and
 * `POST /api/export-folder/file?folder=&name=` streams one file into it, create-only, under a name the
 * server mints (`exportRunFileName`) and checks (`resolveStudioExportRunPath`, both in path-policy.ts),
 * so nothing lands outside the run. Host-only (server-remote.ts): a remote device wants the file on
 * itself, so it keeps the browser download.
 */
import { existsSync } from "node:fs";
import { LVBAK_ARCHIVE_BOUNDS } from "../formats/lumiverse-archive";
import { createExportRun } from "../studio/exports";
import { exportRunFileName, resolveStudioExportRunPath } from "../studio/path-policy";
import { contentTypeIs, err, json, readJsonObject, streamBodyToFile, studioErr } from "./server-security";

/** One printed file (a Sprite pack zip can be large): the most the server accepts in one request. */
const EXPORT_FILE_MAX_BYTES = LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes;

export async function handleExportFolderRoute(p: string, url: URL, req: Request, studioDir: string): Promise<Response | null> {
  if (req.method !== "POST") return null;
  try {
    if (p === "/api/export-folder") {
      const parsed = await readJsonObject(req, 4096);
      if (!parsed.ok) return parsed.response;
      if (typeof parsed.value.label !== "string" || Object.keys(parsed.value).some((key) => key !== "label")) return err("expected an export label", 400);
      return json(await createExportRun(studioDir, parsed.value.label));
    }
    if (p !== "/api/export-folder/file") return null;
    if (!contentTypeIs(req, "application/octet-stream")) return err("unsupported media type", 415);
    const folder = url.searchParams.get("folder") ?? "";
    if (!existsSync(resolveStudioExportRunPath(studioDir, folder))) return err("no such export folder", 404);
    const requested = url.searchParams.get("name") ?? "";
    // Create-only ("wx"): a name already in the run (a twin piece, or one differing only in case on
    // Windows and macOS) moves on to "<name> (2)", and nothing ever truncates a finished file.
    for (let attempt = 1; attempt <= 100; attempt++) {
      const name = exportRunFileName(requested, attempt);
      const path = resolveStudioExportRunPath(studioDir, folder, name);
      let written: Awaited<ReturnType<typeof streamBodyToFile>>;
      try {
        written = await streamBodyToFile(req, path, EXPORT_FILE_MAX_BYTES, { mode: 0o644, flags: "wx" });
      } catch (e) {
        if ((e as { code?: string }).code === "EEXIST") continue;
        throw e;
      }
      if (!written.ok) return written.response;
      return json({ name, bytes: written.bytes });
    }
    return err("too many files with that name in this export", 409);
  } catch (e) {
    return studioErr(e);
  }
}
