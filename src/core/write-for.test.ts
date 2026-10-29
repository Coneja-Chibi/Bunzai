/** Write-for profile tests pin the shared labels, ordering, and parser behavior. */
import { describe, expect, test } from "bun:test";
import { makePlatformOwns, makeWriteForProfiles } from "./write-for";

const LABELS = { full: "Bunzai", sillytavern: "SillyTavern", risu: "Risu" } as const;

describe("makeWriteForProfiles", () => {
  test("the profile list follows the labels object's own key order", () => {
    const { profiles } = makeWriteForProfiles(LABELS);
    expect(profiles).toEqual(["full", "sillytavern", "risu"]);
  });

  test("isProfile narrows to a known profile only", () => {
    const { isProfile } = makeWriteForProfiles(LABELS);
    expect(isProfile("risu")).toBe(true);
    expect(isProfile("agnai")).toBe(false);
    expect(isProfile(42)).toBe(false);
  });

  test("parse falls back to full for anything unknown, never throws", () => {
    const { parse } = makeWriteForProfiles(LABELS);
    expect(parse("sillytavern")).toBe("sillytavern");
    expect(parse("not-a-real-platform")).toBe("full");
    expect(parse(undefined)).toBe("full");
    expect(parse(null)).toBe("full");
  });
});

describe("makePlatformOwns", () => {
  const owns = makePlatformOwns(["name"], {
    full: [],
    sillytavern: ["tags"],
    risu: [],
  } as Record<"full" | "sillytavern" | "risu", readonly ("name" | "tags" | "mood")[]>);

  test("core keys belong to every profile", () => {
    for (const p of ["full", "sillytavern", "risu"] as const) expect(owns(p, "name")).toBe(true);
  });
  test("the full union owns everything", () => {
    expect(owns("full", "mood")).toBe(true);
  });
  test("any other profile owns only its listed extras", () => {
    expect(owns("sillytavern", "tags")).toBe(true);
    expect(owns("risu", "tags")).toBe(false);
    expect(owns("sillytavern", "mood")).toBe(false);
  });
  test("an unknown profile string owns the core keys and nothing else, never throws", () => {
    const loose = owns as (profile: string, key: "name" | "tags" | "mood") => boolean;
    expect(loose("agnai", "name")).toBe(true);
    expect(loose("agnai", "tags")).toBe(false);
  });
});
