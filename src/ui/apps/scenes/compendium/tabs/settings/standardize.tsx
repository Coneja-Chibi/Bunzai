/**
 * Settings > Advanced > "Standardization defaults" (RoleCall `CompendiumSettings.tsx:1099-1190`): the batch size, the model source, "Auto-retry
 * failed entries once", "Preserve original content" (always on, shown locked) and "Revert Last Standardization". Each row is drawn
 * because a run reads it: the banner's controls and these rows write the same saved fields (`standardize.batchSize`, `modelSource`,
 * `autoRetry`), and the run resolves them. The model source says which model converts: the Compendium's own (else the scene's), or
 * the narrator's, which is the scene's. The Revert row acts on the book open in the Compendium.
 */
import type { JSX } from "react";
import { ToggleSwitch } from "../../../../../components/toggle-switch";
import { RANGES } from "../../../../../../core/compendium";
import { GLYPH } from "../../compendium-core";
import { useStandardize } from "../../standardize/use-standardize";
import type { SectionProps } from "./deps";
import { SettingsSection, SettingsSegmented, SettingsStepper, SettingsToggle } from "./parts";

export function StandardizeSection({ ctx, chat, compendium, bookId, set }: SectionProps): JSX.Element {
  const s = compendium.resolved.standardize;
  const std = useStandardize(ctx, chat.id);
  const note = bookId ? std.revertNote(bookId) : null;
  const held = bookId ? std.revertable(bookId) : 0;
  return (
    <SettingsSection id="standardize" title="Standardization defaults" dot="var(--bk-role-danger-text)"
      blurb="Used when you click STANDARDIZE on the Dashboard. The workflow converts existing untyped classic entries to typed ones. Your original content is kept in the run's receipts and the change is fully reversible.">
      <SettingsStepper label="Default batch size" step={5} value={s.batchSize} min={RANGES.batchSize[0]} max={RANGES.batchSize[1]} onChange={(n) => void set({ standardize: { batchSize: n } })}
        hint="How many entries the model converts per call. Larger means fewer calls and better dedup (the model sees more context per call), but risks overflowing the model's window on a huge lorebook. Set it to your whole lorebook size to run everything in one batch." />
      <SettingsSegmented label="Default model source" value={s.modelSource} onChange={(modelSource) => void set({ standardize: { modelSource } })}
        hint="Which model runs the conversion. The Compendium model is the one chosen under Model (the scene's own until you pick another); the narrator is the scene's own."
        options={[{ value: "compendium", label: "Compendium model" }, { value: "scene", label: "Narrator" }]} />
      <SettingsToggle on={s.autoRetry} onChange={(autoRetry) => void set({ standardize: { autoRetry } })} label="Auto-retry failed entries once"
        hint="Entries that come back unusable get one more try before they are left as written. Trades a bit of time for a higher success rate on large batches." />
      <div className="cps-tg">
        <ToggleSwitch on onChange={() => undefined} disabled tone="var(--cpa)" aria-label="Preserve original content" />
        <div>
          <span className="cps-lab">Preserve original content</span>
          <p className="cps-hint">Each run keeps the original text of every entry it rewrites in its receipts, so the conversion is fully reversible. Always on.</p>
        </div>
      </div>
      <div data-part="compendium.settings.revert">
        <span className="cps-lab">{GLYPH.revert} Revert Last Standardization</span>
        <p className="cps-hint">Restores every rewritten entry to its original classic content, retires any brand-new split entries the run made, and brings back the entries it consumed. Use this if a run produced duplicates or incorrect typing.</p>
        <button type="button" className="cps-quiet" disabled={!bookId || held === 0 || std.reverting(bookId)} onClick={() => bookId && void std.revert(bookId)}>
          {bookId && std.reverting(bookId) ? "REVERTING..." : `${GLYPH.revert} REVERT LAST RUN`}
        </button>
        {bookId && held === 0 && !note && <p className="cps-hint">Nothing from a Standardize run is waiting to be reverted on this book.</p>}
        {note?.result && <p className="cps-hint">{GLYPH.check} Reverted: {note.result.rewrites} rewrites restored, {note.result.splits} splits retired, {note.result.consumed} consumed restored{note.result.skipped.length > 0 ? `, ${note.result.skipped.length} left as they are because they changed since` : ""}.</p>}
        {note?.error && <p className="cps-hint">{GLYPH.cross} Revert failed: {note.error}</p>}
      </div>
    </SettingsSection>
  );
}
