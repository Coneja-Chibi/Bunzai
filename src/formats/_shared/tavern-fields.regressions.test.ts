/**
 * Regression: a SillyTavern card's creation_date must survive a read into the canonical body and a
 * write back out unchanged, so re-exporting an imported card never loses its original timestamp.
 */
import { expect, test } from "bun:test";
import { applyBodyToData, dataToBody, type TavernData } from "./tavern-fields";

const raw: TavernData = { name: "Vera", description: "", personality: "", scenario: "", first_mes: "", mes_example: "", creation_date: 1_700_000_000 };

test("ST creation_date round-trips through attribution.createdAt both ways", () => {
  const body = dataToBody(raw);
  expect(body.attribution.createdAt).toBe(1_700_000_000);

  const writtenBack = applyBodyToData({ ...raw }, body);
  expect(writtenBack.creation_date).toBe(1_700_000_000);
});
