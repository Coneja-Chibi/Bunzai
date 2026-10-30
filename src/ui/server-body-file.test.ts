/** The public bounded file stream preserves every byte across short writes and removes only its own incomplete exclusive file. */
import { expect, test } from "bun:test";
import { access, open, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tempDir } from "../studio/test-temp-dir";
import { streamBodyToFile } from "./server-security";

type Write = (...args: unknown[]) => Promise<unknown>;

test("a short filesystem write cannot produce a successful but truncated streamed export", async () => {
  const root = await tempDir("export-short-write-");
  const path = join(root, "complete.png");
  const probe = await open(join(root, ".probe"), "w");
  const prototype = Object.getPrototypeOf(probe) as { write: Write };
  const original = prototype.write;
  await probe.close();
  prototype.write = function (this: unknown, ...args: unknown[]) {
    const bytes = args[0];
    return original.apply(this, bytes instanceof Uint8Array ? [bytes.subarray(0, 3)] : args);
  };
  const bytes = Uint8Array.from({ length: 97 }, (_, i) => i * 7 % 256);
  try {
    const response = await streamBodyToFile(new Request("http://fixture/upload", { method: "POST", body: bytes }), path, 1024, { flags: "wx" });
    expect(response).toEqual({ ok: true, bytes: bytes.length });
    expect(new Uint8Array(await readFile(path))).toEqual(bytes);
  } finally {
    prototype.write = original;
  }
});

test("a stream failure removes the exclusive file created by that request", async () => {
  const path = join(await tempDir("export-stream-failure-"), "partial.png");
  let chunks = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunks++ === 0) controller.enqueue(new Uint8Array([1, 2, 3]));
      else controller.error(new Error("fixture stream failed"));
    },
  });
  const response = await streamBodyToFile(new Request("http://fixture/upload", { method: "POST", body }), path, 1024, { flags: "wx" });
  expect(response.ok).toBe(false);
  expect(await access(path).then(() => true, () => false)).toBe(false);
});
