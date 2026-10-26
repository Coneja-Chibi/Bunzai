/** Regression coverage for the lumi-expressions.test behavior owned beside this file. */
import { describe, expect, test } from "bun:test";
import {
  lumiExpressionsFromPack,
  packsFromLumiGroups,
  lumiGroupsFromPacks,
} from "./lumi-expressions";
import { packFromExpressionMap } from "../../../core/media";

describe("lumi-expressions", () => {
  test("pack round-trip", () => {
    const pack = packFromExpressionMap({
      enabled: true,
      defaultExpression: "happy",
      mappings: { happy: "data:a", sad: "data:b" },
    });
    expect(pack.items).toHaveLength(2);
    expect(pack.enabled).toBe(true);
    const back = lumiExpressionsFromPack(pack);
    expect(back.mappings?.happy).toBe("data:a");
    expect(back.defaultExpression).toBe("happy");
  });

  test("groups round-trip", () => {
    const packs = packsFromLumiGroups({
      groups: { Alice: { smile: "s1" }, Bob: { frown: "f1" } },
    });
    expect(Object.keys(packs)).toEqual(["Alice", "Bob"]);
    const wire = lumiGroupsFromPacks(packs);
    expect(wire.groups.Alice?.smile).toBe("s1");
  });

  test("groups discard blank labels and trim labels to match flat mappings", () => {
    const packs = packsFromLumiGroups({ groups: { Alice: { "  smile  ": "s1", "   ": "blank" } } });
    expect(packs.Alice?.items.map(({ label }) => label)).toEqual(["smile"]);
    expect(packs.Alice?.items.map(({ ref }) => ref)).toEqual(["s1"]);
  });
});
