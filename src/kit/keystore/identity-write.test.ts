/** Exclusive identity-file writes leave no partial key and never remove an existing file. */
import { expect, test } from "bun:test";
import { writeIdentityFile } from "./backends/identity-write";

const bytes = Buffer.from("identity bytes");
const failure = async (task: Promise<void>): Promise<unknown> => await task.then(() => null, (error) => error);

test("removes a partial file created by a write that fails", async () => {
  let data: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let removed = false;
  const writer = {
    open: async () => ({
      writeFile: async (value: Buffer) => { data = value.subarray(0, 3); throw new Error("injected write failure"); },
      sync: async () => undefined,
      chmod: async () => undefined,
      stat: async () => ({ dev: 1, ino: 2 }),
      close: async () => undefined,
    }),
    stat: async () => ({ dev: 1, ino: 2 }),
    unlink: async () => { removed = true; data = Buffer.alloc(0); },
  };
  expect(await failure(writeIdentityFile("scratch", bytes, writer))).toBeInstanceOf(Error);
  expect(removed).toBe(true);
  expect(data).toEqual(Buffer.alloc(0));
});

test("an exclusive-create refusal never unlinks an existing file", async () => {
  let removed = false;
  const writer = {
    open: async () => { throw new Error("EEXIST"); },
    stat: async () => ({ dev: 1, ino: 2 }),
    unlink: async () => { removed = true; },
  };
  expect(String(await failure(writeIdentityFile("scratch", bytes, writer)))).toContain("EEXIST");
  expect(removed).toBe(false);
});

test("does not unlink the path if it no longer names this attempt's file", async () => {
  let removed = false;
  const writer = {
    open: async () => ({
      writeFile: async () => { throw new Error("injected write failure"); },
      sync: async () => undefined,
      chmod: async () => undefined,
      stat: async () => ({ dev: 1, ino: 2 }),
      close: async () => undefined,
    }),
    stat: async () => ({ dev: 1, ino: 3 }),
    unlink: async () => { removed = true; },
  };
  expect(String(await failure(writeIdentityFile("scratch", bytes, writer)))).toContain("injected write failure");
  expect(removed).toBe(false);
});
