/** Storage error recognition has one pure home so browser-capable scene code never imports filesystem writers. */
import { expect, test } from "bun:test";
import { sharedHomeDeclarationOutsideHome } from "./single-source-core";

test("storage error predicates belong to the pure error module and are rejected elsewhere", () => {
  for (const name of ["isStudioWriteError", "isStudioConflictError"]) {
    const source = `export const ${name} = (error: unknown): boolean => false;`;
    expect(sharedHomeDeclarationOutsideHome("src/studio/errors.ts", source)).toBeNull();
    expect(sharedHomeDeclarationOutsideHome("src/studio/atomic-file.ts", source)).toContain("src/studio/errors.ts");
    expect(sharedHomeDeclarationOutsideHome("src/studio/other.ts", source)).toContain("src/studio/errors.ts");
  }
});
