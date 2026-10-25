/** Pins word selection order and one RNG draw for every emitted word. */
import { expect, test } from "bun:test";
import { sampleWords } from "./word-sampler";

test("samples vocabulary in order with one draw per word", () => {
  const draws = [0, 0.5, 0.99];
  let count = 0;
  expect(sampleWords(() => draws[count++]!, ["a", "b", "c"], draws.length)).toEqual(["a", "b", "c"]);
  expect(count).toBe(3);
});
