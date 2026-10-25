/** The breather (breather.ts): a long loop hands control back, so the app keeps running during it. */
import { expect, test } from "bun:test";
import { breather } from "./breather";

test("a long loop hands control back, so a waiting timer runs before the loop ends", async () => {
  const breathe = breather(10);
  let timerRan = false;
  setTimeout(() => {
    timerRan = true;
  }, 0);
  const end = performance.now() + 120;
  while (performance.now() < end) await breathe();
  expect(timerRan).toBe(true);
});

test("a loop shorter than one slice does not stop to hand back", async () => {
  const breathe = breather(1_000);
  let timerRan = false;
  setTimeout(() => {
    timerRan = true;
  }, 0);
  const end = performance.now() + 30;
  while (performance.now() < end) await breathe();
  expect(timerRan).toBe(false);
});
