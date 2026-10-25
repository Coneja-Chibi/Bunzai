/**
 * studioCount's out-of-order race: use-boot.ts's finishBoot and StatusBar.tsx's studio-changes
 * reload both call listEntities() and apply the result to the same store field. Nothing serialized
 * them before this fix, so a slower, older request landing after a faster, newer one could overwrite
 * a just-confirmed count with a stale one - the same class of bug saveSettings/patchSettings already
 * guard against with settingsMutationVersion, here applied to setStudioCount via a token every caller
 * must request before starting its own request.
 */
import { beforeEach, expect, test } from "bun:test";
import { nextStudioCountRequest, useShellStore } from "./store";

beforeEach(() => {
  useShellStore.setState({ studioCount: null });
});

test("a slower, older request can never overwrite a result a newer one already applied", () => {
  const tokenA = nextStudioCountRequest(); // request A starts first...
  const tokenB = nextStudioCountRequest(); // ...but request B starts before A resolves

  useShellStore.getState().setStudioCount(7, tokenB); // B resolves first (it's the latest)
  expect(useShellStore.getState().studioCount).toBe(7);

  useShellStore.getState().setStudioCount(3, tokenA); // A resolves late, with a stale count
  expect(useShellStore.getState().studioCount).toBe(7); // dropped: A is no longer the latest request
});

test("resolving in request order still applies normally", () => {
  const tokenA = nextStudioCountRequest();
  useShellStore.getState().setStudioCount(1, tokenA);
  expect(useShellStore.getState().studioCount).toBe(1);

  const tokenB = nextStudioCountRequest();
  useShellStore.getState().setStudioCount(2, tokenB);
  expect(useShellStore.getState().studioCount).toBe(2);
});

test("a token from before any request in this run is never mistaken for the latest", () => {
  // Simulates a request that began in an earlier boot/mount (a stale closure holding an old token).
  const staleToken = nextStudioCountRequest();
  nextStudioCountRequest(); // something else starts a newer request meanwhile
  const currentToken = nextStudioCountRequest(); // ...and finishes first
  useShellStore.getState().setStudioCount(5, currentToken);

  useShellStore.getState().setStudioCount(99, staleToken);
  expect(useShellStore.getState().studioCount).toBe(5);
});

test("three overlapping requests, the newest rejecting: the display stays at the last one that SUCCEEDED", () => {
  // A real caller (use-boot.ts, StatusBar.tsx) only ever calls setStudioCount from a `.then` - a
  // rejected request just never calls it at all. That is the whole mechanism; this test proves what
  // it implies for three requests in flight together, not merely two resolving in order.
  const tokenA = nextStudioCountRequest();
  useShellStore.getState().setStudioCount(1, tokenA); // A succeeds while it is still the only request
  expect(useShellStore.getState().studioCount).toBe(1);

  const tokenB = nextStudioCountRequest(); // B and C now start, overlapping each other
  const tokenC = nextStudioCountRequest(); // C is the newest of the three

  // C (newest) rejects: by construction, a caller never calls setStudioCount for a rejection - there
  // is no line to write here, which is the point.

  // B (older than C, but started after A already applied) resolves successfully...
  useShellStore.getState().setStudioCount(2, tokenB);
  // ...but is still dropped: C claimed the "latest" slot the instant it started, and a request that
  // is no longer the latest is discarded regardless of whether the one that superseded it ever
  // delivers a value. The display is left exactly where A's earlier success set it.
  expect(useShellStore.getState().studioCount).toBe(1);
});
