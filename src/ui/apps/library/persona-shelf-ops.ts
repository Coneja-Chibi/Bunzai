/**
 * Persona shelf ops + meta loader (P4, the regex-shelf-ops pattern): the Library reads each
 * persona body once per listing to compute the card facts (brief, pronouns, section count,
 * lorebook chip). The default persona is the "persona.default" studio pref. The card-facts
 * computation itself lives in src/studio/piece-facts.ts so the store can
 * compute the same facts without importing UI code.
 */
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { PersonaBody } from "../../../entities/persona/schema";
import type { DeckViewContext } from "./view-contract";
import { createAndOpenPersona } from "./new-persona";
import { isRecord } from "../../../core/guards";
import { personaFacts, type PersonaFacts } from "../../../studio/piece-facts";
import { toErrorMessage } from "../../_shared/error-message";

export type PersonaMeta = PersonaFacts;


/**
 * Perf-silly-fast.md R5 step 3.3: a persona's card facts come straight off the list payload's
 * summary (`e.facts.persona`) when present, never a per-piece body fetch. Only a persona whose
 * summary predates this listing falls back to `getEntity`.
 */
export async function loadPersonaMeta(
  ctx: AppContext,
  list: readonly StudioEntitySummary[],
): Promise<Record<string, PersonaMeta>> {
  const personas = list.filter((e) => e.kind === "persona");
  const next: Record<string, PersonaMeta> = {};
  for (const p of personas) {
    if (p.facts?.persona) {
      next[p.id] = p.facts.persona;
      continue;
    }
    try {
      const raw = await ctx.api.getEntity(`kind=persona&id=${encodeURIComponent(p.id)}`);
      const body = isRecord(raw) && isRecord(raw.body) ? (raw.body as unknown as PersonaBody) : null;
      if (!body) continue;
      next[p.id] = personaFacts(body);
    } catch {
      /* skip unreadable */
    }
  }
  return next;
}

export function makePersonaShelf(args: {
  ctx: AppContext;
  personaMeta: Record<string, PersonaMeta>;
  setEntities: (fn: (prev: StudioEntitySummary[]) => StudioEntitySummary[]) => void;
}): NonNullable<DeckViewContext["personaShelf"]> {
  const { ctx, personaMeta, setEntities } = args;
  return {
    briefOf: (e) => personaMeta[e.id]?.brief,
    pronounsOf: (e) => personaMeta[e.id]?.pronouns,
    sectionCountOf: (e) => personaMeta[e.id]?.sectionCount,
    hasLorebookOf: (e) => personaMeta[e.id]?.hasLorebook ?? false,
    defaultId: String(ctx.prefs.get("persona.default") ?? ""),
    onNew: () => {
      void (async () => {
        try {
          const summary = await createAndOpenPersona(ctx);
          setEntities((prev) =>
            prev.some((e) => e.kind === "persona" && e.id === summary.id) ? prev : [...prev, summary],
          );
          ctx.workbench.open(summary);
          ctx.setStatus(`opened persona · ${summary.name}`);
        } catch (err) {
          ctx.setStatus(toErrorMessage(err, "could not create the persona"));
        }
      })();
    },
  };
}
