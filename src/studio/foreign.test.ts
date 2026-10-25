/** Foreign filename id stability and caller-bounded collision resolution. */
import { expect, test } from "bun:test";
import { foreignId, uniqueForeignId } from "./foreign";

test("foreign ids slug safely and resolve ordinary collisions with the shared suffix strategy", () => {
  expect(foreignId("Aegir Main.json")).toBe("aegir-main");
  expect(uniqueForeignId("aegir-main", new Set())).toBe("aegir-main");
  expect(uniqueForeignId("aegir-main", new Set(["aegir-main", "aegir-main-2"]))).toBe("aegir-main-3");
});
