/** Effective-appearance reads: a re-read of the same theme paints nothing; an invalidation or a failure paints again. */
import { expect, test } from "bun:test";
import { createAppearanceRequests } from "./appearance-requests";
import { CORE_THEME_APPEARANCE } from "./theme";

const THEME = JSON.parse(JSON.stringify(CORE_THEME_APPEARANCE)) as unknown;

test("the same theme read again paints nothing; after an invalidation it paints once more", async () => {
  let response: unknown = THEME;
  const requests = createAppearanceRequests(async () => undefined, async () => response);
  const painted: unknown[] = [];
  const accept = (appearance: unknown) => { painted.push(appearance); };
  await requests.refresh(accept);
  await requests.refresh(accept); // a return to the window: same answer
  expect(painted).toHaveLength(1);
  requests.invalidate();
  await requests.refresh(accept);
  expect(painted).toHaveLength(2);
  response = { broken: true }; // a failed read falls back to the core theme
  await requests.refresh(accept);
  expect(painted).toHaveLength(3);
  expect((painted[2] as { fallbackReason?: string }).fallbackReason).toBe("invalid-state");
  response = THEME; // and the next good read paints the theme again
  await requests.refresh(accept);
  expect(painted).toHaveLength(4);
});
