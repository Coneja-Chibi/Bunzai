/**
 * Stats macros format numbers in `context.locale`, en-US when unset, never the host's locale
 * (RoleCall's bare `toLocaleString()` read it; ADR-012 forbids that).
 */
import { expect, test } from "bun:test";
import { createDefaultContext, processMacros } from "../process";
import type { StatsMacroContext } from "./stats";

const ctx = (locale?: string): StatsMacroContext => ({ ...createDefaultContext(locale ? { locale } : {}), tokenCount: 1234567 });

test("token counts group digits by the context's locale, en-US by default", () => {
  expect(processMacros("{{tokencount}}", ctx()).text).toBe("1,234,567");
  expect(processMacros("{{tokencount}}", ctx("de-DE")).text).toBe("1.234.567");
});
