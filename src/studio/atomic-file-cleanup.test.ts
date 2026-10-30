/**
 * writeExclusive must not leave a truncated file behind when the write fails AFTER the exclusive
 * open has already created it.
 *
 * Driving that needs a real post-open write error, and no portable filesystem trick summons ENOSPC
 * or EIO on demand. So one FileHandle.writeFile is armed to throw once, through the handle
 * prototype, and always restored in a finally plus afterEach. This lives apart from
 * atomic-file.test.ts so the patch cannot reach the real-filesystem tests there.
 */
import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFile, writeFile, open, access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { writeExclusive } from "./atomic-file";
import { StudioWriteError, StudioConflictError } from "./errors";
import { tempDir } from "./test-temp-dir";
import { StudioExports } from "./exports";

type WriteFileFn = (...args: unknown[]) => Promise<unknown>;

let root: string;
let handleProto: { writeFile: WriteFileFn };
let originalWriteFile: WriteFileFn;

const exists = (p: string): Promise<boolean> =>
  access(p).then(() => true).catch(() => false);

/** Arm exactly one FileHandle.writeFile to fail with ENOSPC, then restore. */
async function withOneFailingWrite<T>(run: () => Promise<T>, failure = Object.assign(new Error("simulated ENOSPC"), { code: "ENOSPC" })): Promise<T> {
  let armed = true;
  handleProto.writeFile = async function (this: unknown, ...args: unknown[]) {
    if (armed) {
      armed = false;
      throw failure;
    }
    return originalWriteFile.apply(this, args);
  };
  try {
    return await run();
  } finally {
    handleProto.writeFile = originalWriteFile;
  }
}

describe("writeExclusive cleanup", () => {
  beforeEach(async () => {
    root = await tempDir("vaude-cleanup-");
    const probe = await open(join(root, ".probe"), "w");
    handleProto = Object.getPrototypeOf(probe) as { writeFile: WriteFileFn };
    originalWriteFile = handleProto.writeFile;
    await probe.close();
  });

  afterEach(async () => {
    handleProto.writeFile = originalWriteFile; // belt and suspenders; the helper restores too
  });

  test("a write that fails after the create leaves no file behind", async () => {
    const p = join(root, "piece.json");
    await withOneFailingWrite(async () => {
      await expect(writeExclusive(p, '{"v":1}')).rejects.toBeInstanceOf(StudioWriteError);
    });
    expect(await exists(p)).toBe(false);
  });

  test("a failed binary export removes its partial artifact through the shared write owner", async () => {
    await withOneFailingWrite(async () => {
      const error = await new StudioExports(root).write("binary", "png", new Uint8Array([137, 80, 78, 71]))
        .then(() => null, (failure: unknown) => failure);
      expect(error).toBeInstanceOf(StudioWriteError);
    });
    const folders = await readdir(join(root, "Export"));
    expect(folders).toHaveLength(1);
    expect(await readdir(join(root, "Export", folders[0]!))).toEqual([]);
  });

  test("the retry after a failed write succeeds instead of hitting a phantom conflict", async () => {
    const p = join(root, "piece.json");
    await withOneFailingWrite(async () => {
      await expect(writeExclusive(p, '{"v":1}')).rejects.toBeInstanceOf(StudioWriteError);
    });
    // Before the fix the orphaned zero-byte file made this throw StudioConflictError forever:
    // the piece could never be saved under its own name again.
    await writeExclusive(p, '{"v":2}');
    expect(JSON.parse(await readFile(p, "utf8"))).toEqual({ v: 2 });
  });

  test("cleanup never removes a file the call did not create", async () => {
    const p = join(root, "existing.json");
    await writeFile(p, '{"mine":true}', "utf8");
    await expect(writeExclusive(p, '{"v":9}')).rejects.toBeInstanceOf(StudioConflictError);
    expect(JSON.parse(await readFile(p, "utf8"))).toEqual({ mine: true });
  });
});
