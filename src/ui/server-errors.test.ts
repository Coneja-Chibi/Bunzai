/**
 * Storage errors as the scene routes answer them: a library busy in another window is 503 with its
 * plain message ("Before the turn loop" item 3), matched by name because
 * the UI does not reach into the storage backend (D18).
 */
import { expect, test } from "bun:test";
import { StageBusyError } from "../stage/store/sqlite/database";
import { studioErr } from "./server-security";

test("a busy library is 503 with its own message, never a raw error or a 500", async () => {
  const busy = new StageBusyError();
  expect(busy.name).toBe("StageDatabaseError");
  const res = studioErr(busy);
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: "the library is busy in another window; try again in a moment" });
});

test("a storage error naming a path is still 503, with the path kept out of the answer", async () => {
  const pathy = Object.assign(new Error("could not open C:\\Users\\chi\\library.db"), { name: "StageDatabaseError" });
  const res = studioErr(pathy);
  expect([res.status, await res.json()]).toEqual([503, { error: "internal error" }]);
});
