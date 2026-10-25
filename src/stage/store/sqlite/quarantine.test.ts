/** The one decode-error predicate shared by the two SQLite row-quarantine paths. */
import { expect, test } from "bun:test";
import { DamagedDataError } from "../../crypto/crypto";
import { isQuarantinableDecodeError } from "./quarantine";

test("only a damaged cell or malformed JSON is quarantinable", () => {
  expect(isQuarantinableDecodeError(new DamagedDataError("cell", "bad tag"))).toBe(true);
  expect(isQuarantinableDecodeError(new SyntaxError("bad JSON"))).toBe(true);
  expect(isQuarantinableDecodeError(new Error("locked"))).toBe(false);
  expect(isQuarantinableDecodeError(new TypeError("bug"))).toBe(false);
});
