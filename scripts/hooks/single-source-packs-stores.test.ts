/** Each pack/store rule needs a copy it catches, the home it allows, and look-alikes it leaves alone. */
import { describe, expect, test } from "bun:test";
import {
  hiddenFlagCheckOutsideHome,
  packPictureRuleOutsideHome,
  swipeSqlOutsideHome,
  wholeNumberCheckInStoreRulesOutsideHome,
  windowsDeviceNameCopyOutsideHome,
} from "./single-source-packs-stores";
import { sharedHomeDeclarationOutsideHome } from "./single-source-core";

describe("packPictureRuleOutsideHome", () => {
  test("flags a hand-written junk rule or picture extension set", () => {
    expect(packPictureRuleOutsideHome("src/formats/a.ts", 'path.startsWith("__MACOSX/")')).toContain("pack-picture");
    expect(packPictureRuleOutsideHome("src/ui/a.ts", 'name.toLowerCase() === "thumbs.db"')).toContain("pack-picture");
    expect(packPictureRuleOutsideHome("src/ui/a.ts", "const PICTURE = /\\.(png|jpe?g|gif|webp)$/i;")).toContain("pack-picture");
    expect(packPictureRuleOutsideHome("src/core/a.ts", 'new Set(["png", "jpg", "jpeg", "gif", "webp"])')).toContain("pack-picture");
  });
  test("allows the homes, tests, comments and unrelated sets", () => {
    expect(packPictureRuleOutsideHome("src/core/media/pack-picture.ts", 'new Set(["png", "jpg", "jpeg", "gif", "webp"])')).toBeNull();
    expect(packPictureRuleOutsideHome("src/formats/lumiverse-archive/source.ts", 'split("/").includes("__MACOSX")')).toBeNull();
    expect(packPictureRuleOutsideHome("src/core/media/pack-picture.test.ts", '"__MACOSX/x.png"')).toBeNull();
    expect(packPictureRuleOutsideHome("src/ui/a.ts", "// skip __MACOSX")).toBeNull();
    expect(packPictureRuleOutsideHome("src/ui/a.ts", 'new Set(["png", "webp"])')).toBeNull();
  });
});

describe("windowsDeviceNameCopyOutsideHome", () => {
  test("flags a second device-name regex and allows its homes", () => {
    const copy = "const R = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;";
    expect(windowsDeviceNameCopyOutsideHome("src/ui/a.ts", copy)).toContain("sanitizeDownloadBase");
    expect(windowsDeviceNameCopyOutsideHome("src/core/download-name.ts", copy)).toBeNull();
    expect(windowsDeviceNameCopyOutsideHome("src/ui/a.test.ts", copy)).toBeNull();
    expect(windowsDeviceNameCopyOutsideHome("src/ui/a.ts", "const R = /^(contact|prnt)$/;")).toBeNull();
  });
});

describe("single-home names added for the pack fold", () => {
  test("a second declaration is flagged, the home is not", () => {
    for (const [name, where] of [
      ["sanitizeDownloadBase", "src/core/download-name.ts"],
      ["isPackPictureName", "src/core/media/pack-picture.ts"],
      ["isPackPictureJunk", "src/core/media/pack-picture.ts"],
      ["PACK_PICTURE_EXTENSIONS", "src/core/media/pack-picture.ts"],
    ] as const) {
      const decl = `export const ${name} = () => 1;`;
      expect(sharedHomeDeclarationOutsideHome("src/ui/x.ts", decl)).toContain(where);
      expect(sharedHomeDeclarationOutsideHome(where, decl)).toBeNull();
    }
  });
});

describe("hiddenFlagCheckOutsideHome", () => {
  test("flags a hand-written hidden test in the stage, allows scalar-rules and tests", () => {
    expect(hiddenFlagCheckOutsideHome("src/stage/store/x.ts", 'if (typeof hidden !== "boolean") throw new TypeError("no");')).toContain("checkHidden");
    expect(hiddenFlagCheckOutsideHome("src/stage/store/x.ts", 'typeof raw["hidden"] !== "boolean"')).toContain("checkHidden");
    expect(hiddenFlagCheckOutsideHome("src/stage/store/scalar-rules.ts", 'typeof value !== "boolean"')).toBeNull();
    expect(hiddenFlagCheckOutsideHome("src/stage/store/x.test.ts", 'typeof hidden !== "boolean"')).toBeNull();
    expect(hiddenFlagCheckOutsideHome("src/stage/store/x.ts", 'typeof pinned !== "boolean"')).toBeNull();
  });
});

describe("wholeNumberCheckInStoreRulesOutsideHome", () => {
  test("flags Number.isInteger and Number.isSafeInteger in a rules module, not scalar-rules or other files", () => {
    expect(wholeNumberCheckInStoreRulesOutsideHome("src/stage/store/cast-rules.ts", "Number.isInteger(n)")).toContain("isWhole");
    expect(wholeNumberCheckInStoreRulesOutsideHome("src/stage/store/opening-rules.ts", "!Number.isSafeInteger(n)")).toContain("isWhole");
    expect(wholeNumberCheckInStoreRulesOutsideHome("src/stage/store/scalar-rules.ts", "Number.isSafeInteger(n)")).toBeNull();
    expect(wholeNumberCheckInStoreRulesOutsideHome("src/stage/store/sqlite/chat-store.ts", "Number.isInteger(n)")).toBeNull();
    expect(wholeNumberCheckInStoreRulesOutsideHome("src/stage/store/cast-rules.ts", "// Number.isInteger(n)")).toBeNull();
  });
});

describe("swipeSqlOutsideHome", () => {
  test("flags each hand-written swipe statement, allows swipe-sql.ts, tests and comments", () => {
    expect(swipeSqlOutsideHome("src/stage/store/sqlite/chat-store.ts", 'one("SELECT * FROM swipes WHERE cut_at IS NULL")')).toContain("swipe-sql");
    expect(swipeSqlOutsideHome("src/stage/store/sqlite/chat-store-turns.ts", 'one("SELECT coalesce(max(position) + 1, 0) AS n FROM swipes")')).toContain("swipe-sql");
    expect(swipeSqlOutsideHome("src/stage/store/sqlite/chat-store.ts", 'run("UPDATE messages SET current_swipe = ? WHERE id = ?")')).toContain("swipe-sql");
    expect(swipeSqlOutsideHome("src/stage/store/sqlite/swipe-sql.ts", 'const LIVE = "cut_at IS NULL";')).toBeNull();
    expect(swipeSqlOutsideHome("src/stage/store/sqlite/chat-store.sqlite.test.ts", "cut_at IS NULL")).toBeNull();
    expect(swipeSqlOutsideHome("src/stage/store/sqlite/chat-store.ts", "// WHERE cut_at IS NULL")).toBeNull();
    expect(swipeSqlOutsideHome("src/stage/store/memory/chat-records.ts", "cut_at IS NULL")).toBeNull();
  });
});

describe("single-home names added for the store fold", () => {
  test("a second declaration is flagged, the home is not", () => {
    for (const [name, where] of [
      ["isWhole", "src/stage/store/scalar-rules.ts"],
      ["checkWhole", "src/stage/store/scalar-rules.ts"],
      ["checkHidden", "src/stage/store/scalar-rules.ts"],
      ["personaDaysOf", "src/stage/store/persona-stats-rules.ts"],
      ["appendSwipe", "src/stage/store/sqlite/swipe-sql.ts"],
      ["setCurrentSwipe", "src/stage/store/sqlite/swipe-sql.ts"],
      ["nextPosition", "src/stage/store/sqlite/swipe-sql.ts"],
    ] as const) {
      const decl = `export const ${name} = () => 1;`;
      expect(sharedHomeDeclarationOutsideHome("src/ui/x.ts", decl)).toContain(where);
      expect(sharedHomeDeclarationOutsideHome(where, decl)).toBeNull();
    }
  });
});
