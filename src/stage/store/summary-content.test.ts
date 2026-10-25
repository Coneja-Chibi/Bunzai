/**
 * summary-content.ts: every field it stamps matches what summaryOfPiece
 * (studio/store-listing.ts) and piece-facts.ts compute from the body, per kind, and survives the
 * JSON round trip the backend stores it through. `fullSurfaceEntities` (entities/
 * runtime-schema.full-surface.fixtures.ts) gives one fully populated, schema-valid piece per kind;
 * the property tests mutate copies of those so every run stays a valid canonical entity.
 */
import { describe, expect, test } from "bun:test";
import { slowRuleCount } from "../../core/regex";
import { roughTokenCount } from "../../core/tokens/estimate";
import { mulberry32 as prng } from "../../core/lore/rng";
import type { LorebookBody } from "../../entities/lorebook/schema";
import type { PersonaBody } from "../../entities/persona/schema";
import type { RegexSetBody } from "../../entities/regex/schema";
import {
  fullCharacter,
  fullLorebook,
  fullPack,
  fullPersona,
  fullPreset,
  fullRegex,
} from "../../entities/runtime-schema.full-surface.fixtures";
import type { ParsedCanonicalEntity } from "../../entities/runtime-schema";
import {
  doesWhatForSet,
  filledCardFields,
  loreFacts,
  personaFacts,
  presetFacts,
  writtenChars,
} from "../../studio/piece-facts";
import { summaryOfPiece } from "../../studio/store-listing";
import { buildSummary, DERIVED_VERSION, summaryContentOf, type PieceSummaryContent } from "./summary-content";

/** The reference computation: summaryOfPiece + piece-facts, called directly, per kind. */
function reference(entity: ParsedCanonicalEntity): PieceSummaryContent {
  const { name, importedAt, hasPortrait, accent, sourceFormat, sourceVariant, tags } = summaryOfPiece(
    entity.kind,
    entity.id,
    entity,
  );
  const body = entity.body as unknown as Record<string, unknown>;
  const identity = (body.identity ?? {}) as Record<string, unknown>;
  const tagline = typeof identity.tagline === "string" ? identity.tagline : undefined;
  const rawDescription =
    entity.kind === "character"
      ? typeof identity.description === "string" ? identity.description : undefined
      : typeof body.description === "string" ? body.description : undefined;
  const description = rawDescription && rawDescription.length > 400 ? `${rawDescription.slice(0, 400)}…` : rawDescription;
  const extra: Record<string, unknown> = {};
  if (entity.kind === "character") extra.filled = filledCardFields(body);
  if (entity.kind === "preset") Object.assign(extra, presetFacts(body));
  if (entity.kind === "regex") {
    const rules = (body as unknown as RegexSetBody).rules ?? [];
    extra.regex = {
      enabled: body.enabled !== false,
      ruleCount: rules.length,
      enabledRuleCount: rules.filter((r) => r.enabled !== false).length,
      doesWhat: doesWhatForSet(body as unknown as RegexSetBody),
      slowCount: slowRuleCount(body as unknown as RegexSetBody),
    };
  }
  if (entity.kind === "lorebook") {
    extra.lore = { enabled: body.enabled !== false, ...loreFacts(body as unknown as LorebookBody) };
  }
  if (entity.kind === "persona") extra.persona = personaFacts(body as unknown as PersonaBody);
  return {
    name,
    ...(importedAt ? { importedAt } : {}),
    ...(hasPortrait ? { hasPortrait } : {}),
    ...(accent ? { accent } : {}),
    ...(sourceFormat ? { sourceFormat } : {}),
    ...(sourceVariant ? { sourceVariant } : {}),
    ...(tags ? { tags } : {}),
    ...(tagline ? { tagline } : {}),
    ...(description ? { description } : {}),
    tokens: roughTokenCount(writtenChars(body)),
    ...extra,
  };
}

describe("summary-content: matches summaryOfPiece + piece-facts", () => {
  for (const fixture of [fullCharacter, fullLorebook, fullPersona, fullPreset, fullRegex, fullPack]) {
    test(`${fixture.kind}: the fixture's summary equals the reference computation`, () => {
      expect(summaryContentOf(fixture)).toEqual(reference(fixture));
      // Survives the JSON round trip the backend stores it through (no `undefined` keys sneak in).
      expect(JSON.parse(buildSummary(fixture).text)).toEqual(reference(fixture));
    });
  }

  test("stamps DERIVED_VERSION, pinned so a shape change below must bump it on purpose", () => {
    // Pinned to a literal, not the exported constant: a bump that forgets this line is a red test,
    // not a silent pass (the exported constant would always equal itself). 2: PersonaFacts gained tagline and emoji.
    expect(DERIVED_VERSION).toBe("2");
    expect(buildSummary(fullCharacter).derivedVersion).toBe("2");
  });

  test("the summary's own shape is pinned: a key added, renamed, or removed without bumping DERIVED_VERSION fails here", () => {
    const keysOf = (v: PieceSummaryContent) => Object.keys(v).sort();
    expect(keysOf(summaryContentOf(fullCharacter))).toEqual(["description", "filled", "hasPortrait", "name", "sourceFormat", "tagline", "tags", "tokens"]);
    expect(keysOf(summaryContentOf(fullLorebook))).toEqual(["description", "lore", "name", "tags", "tokens"]);
    expect(keysOf(summaryContentOf(fullPersona))).toEqual(["name", "persona", "tagline", "tokens"]);
    expect(keysOf(summaryContentOf(fullPreset))).toEqual(["blocks", "description", "name", "samplers", "tokens"]);
    expect(keysOf(summaryContentOf(fullRegex))).toEqual(["description", "name", "regex", "tokens"]);
    expect(keysOf(summaryContentOf(fullPack))).toEqual(["name", "tokens"]);
  });

  test("truncates a long description to about 400 characters and marks the cut", () => {
    const long = "x".repeat(500);
    const entity = { ...fullCharacter, body: { ...fullCharacter.body, identity: { ...fullCharacter.body.identity, description: long } } };
    const summary = summaryContentOf(entity);
    expect(summary.description?.length).toBe(401); // 400 chars + the ellipsis mark
    expect(summary.description?.endsWith("…")).toBe(true);
  });

  test("property: 25 random valid characters and regex sets match the reference, every time", () => {
    const rand = prng(20260929);
    for (let i = 0; i < 25; i++) {
      const nameLen = 1 + Math.floor(rand() * 12);
      const name = Array.from({ length: nameLen }, () => "abcdefghij"[Math.floor(rand() * 10)]).join("");
      const hasTagline = rand() > 0.5;
      const descLen = Math.floor(rand() * 600); // sometimes over the 400-char truncation line
      const description = "d".repeat(descLen);
      const tags = rand() > 0.5 ? [name, "tag-" + Math.floor(rand() * 5)] : [];
      const character: ParsedCanonicalEntity = {
        ...fullCharacter,
        id: `prop-char-${i}`,
        body: {
          ...fullCharacter.body,
          identity: { ...fullCharacter.body.identity, name, description, ...(hasTagline ? { tagline: "t" } : { tagline: undefined }) },
          discovery: { ...fullCharacter.body.discovery, tags },
        },
      };
      expect(summaryContentOf(character)).toEqual(reference(character));

      const ruleCount = Math.floor(rand() * 6);
      const rules = Array.from({ length: ruleCount }, (_, r) => ({
        ...fullRegex.body.rules[0]!,
        id: `r${r}`,
        enabled: rand() > 0.3,
      }));
      const regexSet: ParsedCanonicalEntity = {
        ...fullRegex,
        id: `prop-regex-${i}`,
        body: { ...fullRegex.body, rules, enabled: rand() > 0.2 },
      };
      expect(summaryContentOf(regexSet)).toEqual(reference(regexSet));

      const entryCount = Math.floor(rand() * 5);
      const lorebook: ParsedCanonicalEntity = {
        ...fullLorebook,
        id: `prop-lore-${i}`,
        body: {
          ...fullLorebook.body,
          enabled: rand() > 0.2,
          entries: Array.from({ length: entryCount }, (_, e) => ({ ...fullLorebook.body.entries[0]!, id: `e${e}` })),
        },
      };
      expect(summaryContentOf(lorebook)).toEqual(reference(lorebook));
    }
  });

  test("a 20 MB-class body (the plan's documented worst case) computes well inside the app's 100 ms freeze budget", () => {
    // Measured against a real 409-row library (scripts, not committed): the slowest real
    // row was a 1.73 MB regex set at 37 ms; this synthetic body matches perf-gate-data.ts's own
    // REALISTIC_SNAPSHOT_PORTRAIT_CHARS worst case (a ~20 MB embedded portrait). Canary: if a future
    // change to piece-facts.ts makes this scale badly, this test goes red long before perf:check does.
    const BUDGET_MS = 100; // the app's one enforced freeze budget everywhere else (perf-gate.ts)
    const bigPortrait = `data:image/png;base64,${"A".repeat(20_000_000)}`;
    const entity: ParsedCanonicalEntity = {
      ...fullCharacter,
      id: "worst-case-20mb",
      body: {
        ...fullCharacter.body,
        identity: { ...fullCharacter.body.identity, description: "d".repeat(2_000_000) },
        media: { portrait: { role: "portrait", ref: bigPortrait } },
      },
    };
    const t0 = performance.now();
    const result = buildSummary(entity);
    const ms = performance.now() - t0;
    expect(result.text.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(BUDGET_MS);
  });
});
