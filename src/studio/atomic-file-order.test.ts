/** Atomic temp cleanup order proof against the public writer using real filesystem handles. */
import { expect, test } from "bun:test";
import { readdirSync, unlinkSync } from "node:fs";
import { open } from "node:fs/promises";
import { join } from "node:path";
import { StudioWriteError, writeAtomicReplace } from "./atomic-file";
import { withTempDir } from "./test-temp-dir";

test("closes its temporary handle before unlinking it and preserves the write cause", async () => {
  await withTempDir("bunraku-atomic-order-", async (dir) => {
    const probe = await open(join(dir, "probe"), "w");
    const prototype = Object.getPrototypeOf(probe);
    await probe.close();
    unlinkSync(join(dir, "probe"));
    const writeFile = prototype.writeFile;
    const close = prototype.close;
    const failure = new Error("simulated write failure");
    let tempExistedAtClose = false;
    prototype.writeFile = async function () { throw failure; };
    prototype.close = async function (...args: unknown[]) {
      tempExistedAtClose ||= readdirSync(dir).some((name) => name.startsWith(".tmp-"));
      return close.apply(this, args);
    };
    try {
      const error = await writeAtomicReplace(join(dir, "item.json"), "body").then(() => null, (e) => e);
      expect(error).toBeInstanceOf(StudioWriteError);
      expect((error as StudioWriteError).cause).toBe(failure);
      expect(tempExistedAtClose).toBe(true);
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      prototype.writeFile = writeFile;
      prototype.close = close;
    }
  });
});
