/** Export library: the words name the folder, the damaged pieces and the missing encryption. */
import { expect, test } from "bun:test";
import { exportedWords } from "./library-export";

test("the words say where it went, what was left out, and that the folder is not encrypted", () => {
  expect(exportedWords({ folder: "C:/x/Library export", pieces: 1, documents: 2, damaged: 0 })).toBe("Exported 1 piece to C:/x/Library export. The folder is not encrypted.");
  expect(exportedWords({ folder: "f", pieces: 3, documents: 0, damaged: 2 })).toContain("2 damaged pieces were left out.");
});
