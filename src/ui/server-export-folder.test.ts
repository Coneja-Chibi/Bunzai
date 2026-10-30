/**
 * The Export folder routes: every export gets its own new folder under <studio>/Export, names cannot
 * escape it or carry an unexpected file type, files are never overwritten, and through the real
 * handler the routes need the session token and refuse a remote device before any byte is written.
 */
import { afterEach, expect, test, setSystemTime } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StudioStore } from "../studio/store";
import { SettingsStore } from "../studio/settings";
import { createHandler } from "./server";
import { apiReq, filledSec } from "./server-test-rig";
import { handleExportFolderRoute } from "./server-export-folder";
import { exportStamp } from "../studio/exports";
import { LVBAK_ARCHIVE_BOUNDS } from "../formats/lumiverse-archive";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const studio = (): string => {
  const d = mkdtempSync(join(tmpdir(), "export-folder-"));
  dirs.push(d);
  return d;
};

const call = (dir: string, path: string, body: BodyInit, type: string): Promise<Response | null> => {
  const url = new URL(`http://127.0.0.1${path}`);
  return handleExportFolderRoute(url.pathname, url, new Request(url, { method: "POST", headers: { "content-type": type }, body }), dir);
};
const createRun = async (dir: string, label: string) =>
  await (await call(dir, "/api/export-folder", JSON.stringify({ label }), "application/json"))!.json() as { dir: string; folder: string };
const putFile = (dir: string, folder: string, name: string, body = "bytes") =>
  call(dir, `/api/export-folder/file?folder=${encodeURIComponent(folder)}&name=${encodeURIComponent(name)}`, body, "application/octet-stream");

test("a declared-length refusal never removes an existing completed export", async () => {
  const dir = studio();
  const run = await createRun(dir, "Preserve finished file");
  expect((await putFile(dir, run.folder, "finished.json", "keep these bytes"))!.status).toBe(200);
  const url = new URL(`http://127.0.0.1/api/export-folder/file?folder=${encodeURIComponent(run.folder)}&name=finished.json`);
  const response = await handleExportFolderRoute(url.pathname, url, new Request(url, {
    method: "POST", body: "tiny",
    headers: { "content-type": "application/octet-stream", "content-length": String(LVBAK_ARCHIVE_BOUNDS.maxArchiveBytes + 1) },
  }), dir);
  expect(response!.status).toBe(413);
  expect(readFileSync(join(run.dir, "finished.json"), "utf8")).toBe("keep these bytes");
});

test("malformed labels and unknown creation fields are rejected before any folder exists", async () => {
  const dir = studio();
  for (const body of [{}, { label: 1 }, { label: "x", path: "elsewhere" }]) {
    expect((await call(dir, "/api/export-folder", JSON.stringify(body), "application/json"))!.status).toBe(400);
  }
  expect(existsSync(join(dir, "Export"))).toBe(false);
});

test("an already-cancelled empty upload never creates a successful artifact", async () => {
  const dir = studio();
  const { folder } = await createRun(dir, "Cancelled upload");
  const url = new URL(`http://127.0.0.1/api/export-folder/file?folder=${encodeURIComponent(folder)}&name=cancelled.json`);
  const response = await handleExportFolderRoute(url.pathname, url, new Request(url, {
    method: "POST", headers: { "content-type": "application/octet-stream" }, signal: AbortSignal.abort(),
  }), dir);
  expect(response!.ok).toBe(false);
  expect(readdirSync(join(dir, "Export", folder))).toEqual([]);
});

test("a crowded timestamp has a bounded refusal and leaves previous runs alone", async () => {
  const dir = studio();
  setSystemTime(new Date(2026, 9, 24, 9, 5, 7));
  try {
    const base = `${exportStamp(new Date())} Same label`;
    for (let i = 1; i <= 100; i++) mkdirSync(join(dir, "Export", i === 1 ? base : `${base} (${i})`), { recursive: true });
    const response = await call(dir, "/api/export-folder", JSON.stringify({ label: "Same label" }), "application/json");
    expect(response!.ok).toBe(false);
    expect(readdirSync(join(dir, "Export"))).toHaveLength(100);
  } finally {
    setSystemTime();
  }
});

test("a run gets a new stamped folder under Export and its files stream into it", async () => {
  const dir = studio();
  const run = await createRun(dir, "JanitorAI");
  expect(run.dir).toBe(join(dir, "Export", run.folder));
  expect(run.folder).toMatch(/^\d{4}-\d\d-\d\d \d\d-\d\d-\d\d JanitorAI$/);
  expect((await putFile(dir, run.folder, "Vera.png", "png bytes"))!.status).toBe(200);
  expect((await putFile(dir, run.folder, "Lore.json", "{}"))!.status).toBe(200);
  expect(readdirSync(run.dir).sort()).toEqual(["Lore.json", "Vera.png"]);
  expect(readFileSync(join(run.dir, "Vera.png"), "utf8")).toBe("png bytes");
});

test("two runs never share a folder, even in the same second", async () => {
  const dir = studio();
  const a = await createRun(dir, "Saucepan");
  const b = await createRun(dir, "Saucepan");
  expect(a.dir).not.toBe(b.dir);
  expect(readdirSync(join(dir, "Export"))).toHaveLength(2);
});

test("a hostile label is flattened into one folder name", async () => {
  const dir = studio();
  const run = await createRun(dir, "../../up/and:out");
  expect(run.dir.startsWith(join(dir, "Export"))).toBe(true);
  expect(readdirSync(dir)).toEqual(["Export"]);
});

test("hostile or clashing names are minted into the run, and only a type no export writes is refused", async () => {
  const dir = studio();
  const { folder, dir: run } = await createRun(dir, "x");
  const saved = async (name: string) => (await (await putFile(dir, folder, name))!.json() as { name: string }).name;
  expect(await saved("../evil.json")).toBe("_evil.json");
  expect(await saved("sub/x.json")).toBe("sub_x.json");
  expect(await saved("con.json")).toBe("_con.json");
  expect(await saved("Card.PNG")).toBe("Card.png");
  expect(await saved("Vera.png")).toBe("Vera.png");
  expect(await saved("Vera.png")).toBe("Vera (2).png");
  expect(await saved(`${"b".repeat(79)}\u{1F600}.png`)).toBe(`${"b".repeat(79)}\u{1F600}.png`);
  expect(readdirSync(run).sort()).toEqual(["_evil.json", "Card.png", "Vera (2).png", "Vera.png", `${"b".repeat(79)}\u{1F600}.png`, "_con.json", "sub_x.json"].sort());
  for (const name of ["run.exe", "page.html", "noext", ".json"]) expect((await putFile(dir, folder, name))!.status).toBe(400);
  expect((await putFile(dir, "../..", "x.json"))!.status).toBe(400);
  expect((await putFile(dir, "missing", "x.json"))!.status).toBe(404);
});

test("a finished file is never overwritten; a second one with its name lands beside it", async () => {
  const dir = studio();
  const { folder, dir: run } = await createRun(dir, "x");
  await putFile(dir, folder, "Vera.png", "first");
  await putFile(dir, folder, "Vera.png", "second");
  expect(readFileSync(join(run, "Vera.png"), "utf8")).toBe("first");
  expect(readFileSync(join(run, "Vera (2).png"), "utf8")).toBe("second");
});

test("a label cut at 40 characters never splits an emoji", async () => {
  const run = await createRun(studio(), `JanitorAI ${"a".repeat(29)}\u{1F600}tail`);
  expect(run.folder.endsWith("\u{1F600}")).toBe(true);
  expect(() => encodeURIComponent(run.folder)).not.toThrow();
});

test("through the real handler: no token is refused, a tailed-in device is refused before anything is made", async () => {
  const dir = studio();
  const sec = filledSec();
  const local = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec);
  const tailedIn = createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec, undefined, undefined, undefined, "secret");
  const create = (token: string | null) =>
    apiReq("/api/export-folder", { method: "POST", token, contentType: "application/json", body: JSON.stringify({ label: "x" }) });
  expect((await local(create(null))).status).toBe(403);
  const remote = create(sec.token);
  remote.headers.set("x-bunzai-sidecar-secret", "secret");
  expect((await tailedIn(remote)).status).toBe(403);
  expect(existsSync(join(dir, "Export"))).toBe(false);
  expect((await local(create(sec.token))).status).toBe(200);
  expect(readdirSync(join(dir, "Export"))).toHaveLength(1);
});

test("the stamp sorts by time and is a legal folder name everywhere", () => {
  expect(exportStamp(new Date(2026, 9, 24, 9, 5, 7))).toBe("2026-10-24 09-05-07");
});

test("through a real served request, a file streams onto disk", async () => {
  // A unit-built Request hid it: on a body Bun itself serves, releasing the reader after cancel threw
  // inside Bun, so every streamed upload read its whole body and then answered "failed to read body".
  const dir = studio();
  const sec = filledSec();
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: createHandler(new StudioStore(dir), new SettingsStore(dir), undefined, sec) });
  sec.expectedHost = `127.0.0.1:${server.port}`;
  sec.expectedOrigin = `http://127.0.0.1:${server.port}`;
  const post = (path: string, type: string, body: string) => fetch(`${sec.expectedOrigin}${path}`, {
    method: "POST",
    headers: { origin: sec.expectedOrigin, "x-bunzai-token": sec.token, "content-type": type },
    body,
  });
  try {
    const run = await (await post("/api/export-folder", "application/json", JSON.stringify({ label: "x" }))).json() as { dir: string; folder: string };
    const res = await post(`/api/export-folder/file?folder=${encodeURIComponent(run.folder)}&name=a.json`, "application/octet-stream", "{}");
    expect(res.status).toBe(200);
    expect(readFileSync(join(run.dir, "a.json"), "utf8")).toBe("{}");
  } finally {
    server.stop(true);
  }
});
