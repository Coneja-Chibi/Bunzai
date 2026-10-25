/** Error-message proof: nonempty Error text wins, then the caller fallback, then String(value). */
import { expect, test } from "bun:test";
import { toErrorMessage } from "./error-message";

test("prefers a nonempty Error message and otherwise uses the fallback or String", () => {
  expect(toErrorMessage(new Error("broken"), "fallback")).toBe("broken");
  expect(toErrorMessage(new Error(""), "fallback")).toBe("fallback");
  expect(toErrorMessage("broken")).toBe("broken");
  expect(toErrorMessage(new Error(""))).toBe("Error");
});
