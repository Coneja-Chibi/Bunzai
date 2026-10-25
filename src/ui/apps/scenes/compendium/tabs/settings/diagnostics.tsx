/**
 * "Diagnostics" under Advanced (RoleCall `CompendiumSettings.tsx:1640-1715`): `Run Diagnostics` reads every book the scene uses and its
 * built tree and lists the checks of `core/compendium/diagnostics.ts` as PASS, WARN and FAIL rows with a category, the check, a message
 * and up to ten detail lines. It only reads; nothing is written, and the results are not kept.
 */
import { useState, type JSX } from "react";
import { TOOL_ROUNDS_DEFAULT } from "../../../../../../core/assembly/tool-rounds";
import { accessOf, runDiagnostics, type Diagnostic, type DiagnosticBook } from "../../../../../../core/compendium";
import { presetWindow, turnWindow } from "../../../../../../core/assembly/request";
import type { LorebookBody } from "../../../../../../entities/lorebook/schema";
import type { PresetBody } from "../../../../../../entities/preset/schema";
import { toErrorMessage } from "../../../../../_shared/error-message";
import { SettingsSection } from "./parts";
import type { SectionProps } from "./deps";

export function DiagnosticsSection({ ctx, chat, compendium, lore }: SectionProps): JSX.Element {
  const [results, setResults] = useState<Diagnostic[] | null>(null);
  const [running, setRunning] = useState(false);
  const run = async (): Promise<void> => {
    setRunning(true);
    try {
      const books = lore.lore.state === "ready" ? lore.lore.books.filter((b) => !b.missing) : [];
      const read = await Promise.all(books.map(async (b): Promise<DiagnosticBook> => {
        const [found, tree] = await Promise.all([ctx.api.getLightEditableEntity(`kind=lorebook&id=${encodeURIComponent(b.id)}`), ctx.api.getCompendiumTree(chat.id, b.id)]);
        return { id: b.id, name: b.name, access: accessOf(chat.compendium, b.id), entries: (found.entity as { body: LorebookBody }).body.entries, layout: tree.tree?.layout ?? null, revision: found.revision };
      }));
      // The window a turn fits into, worked out by the turn's own functions: the model's stated one (else RoleCall's 32,768), shrunk by the preset's Context tokens under the scene's own.
      const listed = chat.connection ? await ctx.api.connectionModels(chat.connection.id).catch(() => null) : null;
      const stated = listed?.models?.find((m) => m.id === chat.connection?.model)?.context;
      const found = chat.preset ? await ctx.api.getLightEditableEntity(`kind=preset&id=${encodeURIComponent(chat.preset.id)}`).catch(() => null) : null;
      const body = found && chat.preset ? { ...(found.entity as { body: PresetBody }).body, samplers: { ...(found.entity as { body: PresetBody }).body.samplers, ...chat.preset.samplers } } : undefined;
      setResults(runDiagnostics(read, compendium.resolved, presetWindow(turnWindow(stated), body).context, { access: chat.prompting?.toolAccess === true, rounds: chat.prompting?.toolRounds ?? TOOL_ROUNDS_DEFAULT }));
    } catch (e) {
      ctx.setStatus(`Could not run diagnostics: ${toErrorMessage(e, "a book could not be read")}`);
    } finally {
      setRunning(false);
    }
  };
  return (
    <SettingsSection id="diagnostics" title="Diagnostics" blurb="Health checks against this compendium: duplicate detection, tree freshness, orphaned recaps, configuration sanity, and so on. Results group by category and severity." dot="var(--stage-mute)">
      <button type="button" className="cps-btn wide" disabled={running} onClick={() => void run()}>{running ? "Running..." : "Run Diagnostics"}</button>
      {results && (
        <div className="cps-diag" aria-label="Diagnostic results">
          {results.map((r, i) => (
            <div key={`${r.check}:${i}`} className={`row ${r.status}`}>
              <div><em>[{r.status.toUpperCase()}]</em> <b>{r.category}</b> <span>{r.check}</span></div>
              <p>{r.message}</p>
              {r.details && <ul>{r.details.slice(0, 10).map((d) => <li key={d}>{d}</li>)}{r.details.length > 10 && <li className="more">...and {r.details.length - 10} more</li>}</ul>}
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
