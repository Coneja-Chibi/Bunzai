/** whileBusy: a busy refusal is retried to success, gives up at the cap with the last error, and nothing else is retried. */
import { expect, test } from "bun:test";
import { ApiHttpError } from "./api-fetch";
import { BUSY_TRIES, whileBusy } from "./while-busy";

const busy = (): ApiHttpError => new ApiHttpError(503, "busy", "studio_busy");

test("a retry reaches the 200", async () => {
  let calls = 0;
  const waits: number[] = [];
  const value = await whileBusy(async () => { if (++calls < 3) throw busy(); return "piece"; }, async (ms) => { waits.push(ms); });
  expect(value).toBe("piece");
  expect(waits).toEqual([250, 500]);
});

test("it gives up after the cap, within the time budget, and throws the busy error", async () => {
  let calls = 0;
  const waits: number[] = [];
  const failure = await whileBusy(async () => { calls++; throw busy(); }, async (ms) => { waits.push(ms); }).then(() => null, (e: unknown) => e);
  expect(calls).toBe(BUSY_TRIES);
  expect(failure).toBeInstanceOf(ApiHttpError);
  expect((failure as ApiHttpError).code).toBe("studio_busy");
  expect(waits.reduce((a, b) => a + b, 0)).toBeLessThan(5000);
});

test("other failures are not retried", async () => {
  for (const error of [new ApiHttpError(500, "boom"), new ApiHttpError(503, "other", "something_else"), new Error("x")]) {
    let calls = 0;
    await whileBusy(async () => { calls++; throw error; }, async () => undefined).catch(() => undefined);
    expect(calls).toBe(1);
  }
});
