/** The one rule for which zip or folder entries are pack pictures. */
import { describe, expect, test } from "bun:test";
import { isPackPictureJunk, isPackPictureName } from "./pack-picture";

describe("isPackPictureName", () => {
  test("accepts the five picture types in any case, with or without a folder", () => {
    for (const name of ["a.png", "A.PNG", "x/y.jpg", "x\\y.JPEG", "b.gif", "c.webp"]) expect(isPackPictureName(name)).toBe(true);
  });
  test("refuses other types and names with no real extension", () => {
    for (const name of ["a.svg", "a.txt", "png", "a.png.exe", "dir.png/cover"]) expect(isPackPictureName(name)).toBe(false);
  });
  test("refuses archiver litter that looks like a picture", () => {
    for (const name of ["__MACOSX/x.png", "a/__MACOSX/b.png", "__MACOSX\\b.png", "._x.png", "dir/.hidden.png", "Thumbs.db", "thumbs.DB", "folder/"]) {
      expect(isPackPictureName(name)).toBe(false);
    }
  });
});

describe("isPackPictureJunk", () => {
  test("a hidden file, a sidecar tree, a thumbnail cache and a folder marker are junk; a picture is not", () => {
    expect(isPackPictureJunk(".DS_Store")).toBe(true);
    expect(isPackPictureJunk("__MACOSX/x.png")).toBe(true);
    expect(isPackPictureJunk("sub/Thumbs.db")).toBe(true);
    expect(isPackPictureJunk("sub/")).toBe(true);
    expect(isPackPictureJunk("sub/a.png")).toBe(false);
  });
});
