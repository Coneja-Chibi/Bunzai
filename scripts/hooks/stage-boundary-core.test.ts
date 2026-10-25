/** Tests the D18 boundary lint: store backends stay dumb, nobody reaches around an interface, and test stand-ins stay in tests. */
import { describe, expect, test } from "bun:test";
import { stageBoundaryViolations } from "./stage-boundary-core";

const BACKEND = "src/stage/store/sqlite/documents.ts";

describe("rule 1: a store backend imports no engine, entity, or format code", () => {
  test("a value import from entities is a violation", () => {
    const src = `import { parseCanonicalEntity } from "../../../entities/runtime-schema";\n`;
    expect(stageBoundaryViolations(BACKEND, src)).toHaveLength(1);
  });

  test("a type-only import from entities is allowed, because types erase at build", () => {
    const src = `import type { CanonicalCharacter } from "../../../entities/character/schema";\n`;
    expect(stageBoundaryViolations(BACKEND, src)).toEqual([]);
  });

  test("core and formats are covered as well as entities", () => {
    const src = [
      `import { renderPreset } from "../../../core/preset/render";`,
      `import { detect } from "../../../formats/registry";`,
    ].join("\n");
    expect(stageBoundaryViolations(BACKEND, src)).toHaveLength(2);
  });

  test("a mixed import carrying one value binding is a value import", () => {
    const src = `import { type Schema, parse } from "../../../entities/runtime-schema";\n`;
    expect(stageBoundaryViolations(BACKEND, src)).toHaveLength(1);
  });

  test("a re-export and a dynamic import both count", () => {
    const src = [
      `export { entityRevision } from "../../../entities/canonical-revision";`,
      `const m = await import("../../../formats/risu/charx");`,
    ].join("\n");
    expect(stageBoundaryViolations(BACKEND, src)).toHaveLength(2);
  });

  test("the contracts, sibling backend files, and packages are fine", () => {
    const src = [
      `import type { ContentStore } from "../../contracts/content-store";`,
      `import { openDb } from "./open";`,
      `import { Database } from "bun:sqlite";`,
    ].join("\n");
    expect(stageBoundaryViolations(BACKEND, src)).toEqual([]);
  });

  test("import text inside a comment is not an import", () => {
    const src = `/* was: import { x } from "../../../core/y"; */\n// import { z } from "../../../formats/w";\nexport {};\n`;
    expect(stageBoundaryViolations(BACKEND, src)).toEqual([]);
  });

  test("a backend's own test may import whatever it needs to build fixtures", () => {
    const src = `import { parseCanonicalEntity } from "../../../entities/runtime-schema";\n`;
    expect(stageBoundaryViolations("src/stage/store/sqlite/documents.test.ts", src)).toEqual([]);
  });

  test("windows separators are normalised before the path is judged", () => {
    const src = `import { parse } from "../../../entities/runtime-schema";\n`;
    expect(stageBoundaryViolations("src\\stage\\store\\sqlite\\documents.ts", src)).toHaveLength(1);
  });
});

describe("rule 2: nobody imports a store backend except through its interface", () => {
  test("stage code outside the store may not import a backend", () => {
    const src = `import { SqliteContentStore } from "../store/sqlite/content";\n`;
    expect(stageBoundaryViolations("src/stage/pipeline/assemble.ts", src)).toHaveLength(1);
  });

  test("code anywhere else in src may not import a backend either", () => {
    const src = `import { SqliteContentStore } from "../stage/store/sqlite/content";\n`;
    expect(stageBoundaryViolations("src/ui/server.ts", src)).toHaveLength(1);
  });

  test("one backend may not reach into another", () => {
    const src = `import { SqliteContentStore } from "../sqlite/content";\n`;
    expect(stageBoundaryViolations("src/stage/store/folder/export.ts", src)).toHaveLength(1);
  });

  test("an interface module directly under store/ may name a backend", () => {
    const src = `import { SqliteContentStore } from "./sqlite/content";\n`;
    expect(stageBoundaryViolations("src/stage/store/content-store.ts", src)).toEqual([]);
  });

  test("a declared composition root may wire a backend in", () => {
    const src = `import { SqliteContentStore } from "../stage/store/sqlite/content";\n`;
    expect(stageBoundaryViolations("src/ui/server.ts", src, ["src/ui/server.ts"])).toEqual([]);
  });

  test("a type-only import of a backend is allowed, it reaches nothing at runtime", () => {
    const src = `import type { SqliteOptions } from "../store/sqlite/content";\n`;
    expect(stageBoundaryViolations("src/stage/pipeline/assemble.ts", src)).toEqual([]);
  });

  test("tests outside the store may import a backend to exercise it", () => {
    const src = `import { MemoryContentStore } from "../store/memory/content";\n`;
    expect(stageBoundaryViolations("src/stage/pipeline/assemble.test.ts", src)).toEqual([]);
  });

  test("files outside src/stage importing entities are not this rule's business", () => {
    const src = `import { parseCanonicalEntity } from "../entities/runtime-schema";\n`;
    expect(stageBoundaryViolations("src/studio/store.ts", src)).toEqual([]);
  });
});

describe("rule 3: test stand-ins stay in tests", () => {
  const FAKE = `import { fastPasswords } from "./fake-password-lock";\n`;

  test("app code value-importing a stand-in is a violation", () => {
    expect(stageBoundaryViolations("src/stage/crypto/keyring.ts", FAKE)).toHaveLength(1);
    expect(stageBoundaryViolations("src/ui/app.tsx", `import { fakeComputer } from "../stage/crypto/fake-device-vault";\n`)).toHaveLength(1);
  });

  test("tests, other stand-ins, and type-only imports are fine", () => {
    expect(stageBoundaryViolations("src/stage/crypto/keyring.test.ts", FAKE)).toEqual([]);
    expect(stageBoundaryViolations("src/stage/crypto/fake-other.ts", FAKE)).toEqual([]);
    expect(stageBoundaryViolations("src/stage/crypto/keyring.ts", `import type { FakeComputerOptions } from "./fake-device-vault";\n`)).toEqual([]);
  });

  test("a module whose name only contains 'fake' is not a stand-in", () => {
    expect(stageBoundaryViolations("src/stage/crypto/keyring.ts", `import { x } from "./not-fake-at-all";\n`)).toEqual([]);
  });
});
