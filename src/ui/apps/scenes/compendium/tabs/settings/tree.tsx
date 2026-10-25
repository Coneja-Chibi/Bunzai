/**
 * "Tree building" and "Tree and entry constraints" under Advanced (RoleCall `CompendiumSettings.tsx:960-1050, 1195-1255`). Tree building
 * is how the Compendium's model sorts a book when Repair tree from entries runs: Granularity, Entry detail level, and under an
 * Advanced disclosure the Placement mode; every row writes the field the build resolves (`treeBuild`). "Refine entries during build" (RoleCall
 * `CompendiumSettings.tsx:1229-1234`) is the one that changes the book: the build then splits and merges the classic entries of each branch
 * (`studio/compendium-refine.ts`). The constraints list shows every branch and entry the person locked, forbade, flagged to reorganize or
 * moved, with an X that clears them; the book is the one open in the Compendium.
 */
import { useMemo, type JSX } from "react";
import { clearConstraints, constrainedIds, flagsOf, withLabels } from "../../../../../../core/compendium";
import { Ic } from "../../../../../_shared/ic";
import { useCompendiumBook } from "../../use-compendium-book";
import { useCompendiumTree } from "../../use-compendium-tree";
import { SettingsField, SettingsSection, SettingsToggle } from "./parts";
import type { SectionProps } from "./deps";

const GRANULARITY = [
  [0, "Auto - scales with lorebook size"], [1, "Minimal - 3-5 categories, max 20/node"], [2, "Moderate - 5-8 categories, max 12/node"],
  [3, "Detailed - 8-15 categories, max 8/node"], [4, "Extensive - 12-20 categories, max 5/node"],
] as const;
const DETAIL = [["names", "Names only"], ["lite", "Lite - name + keywords (default)"], ["full", "Full - name + keywords + content preview"]] as const;
const PLACEMENT = [["auto", "Auto (default)"], ["sequential", "Sequential"], ["parallel", "Parallel"]] as const;

export function TreeBuildSection({ compendium, set }: SectionProps): JSX.Element {
  const t = compendium.resolved.treeBuild;
  return (
    <SettingsSection id="tree" title="Tree building" blurb="How the AI categorizes entries into the hierarchy when you build or rebuild the tree." dot="var(--bk-role-ok)">
      <SettingsField label="Granularity" hint="How aggressively the LLM splits entries into sub-categories.">
        <select className="cps-sel" aria-label="Granularity" value={t.granularity} onChange={(e) => void set({ treeBuild: { granularity: Number(e.target.value) as 0 | 1 | 2 | 3 | 4 } })}>
          {GRANULARITY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </SettingsField>
      <SettingsField label="Entry detail level" hint="How much entry info the LLM sees during categorization.">
        <select className="cps-sel" aria-label="Entry detail level" value={t.detail} onChange={(e) => void set({ treeBuild: { detail: e.target.value as typeof t.detail } })}>
          {DETAIL.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </SettingsField>
      <SettingsToggle label="Refine entries during build" on={t.refine} onChange={(on) => void set({ treeBuild: { refine: on } })}
        hint="The model splits multi-topic entries into focused pieces and merges duplicates after categorization. Slower build, better organization." />
      <details className="cps-more">
        <summary>Advanced</summary>
        <SettingsField label="Placement mode" hint="How the builder schedules placement passes on a book too big for one call. Auto lets it decide; sequential runs one pass at a time; parallel runs up to three together.">
          <select className="cps-sel" aria-label="Placement mode" value={t.placement} onChange={(e) => void set({ treeBuild: { placement: e.target.value as typeof t.placement } })}>
            {PLACEMENT.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </SettingsField>
      </details>
    </SettingsSection>
  );
}

const CHIPS = [["locked", "Locked", "lucide:lock"], ["forbidden", "Forbidden", "lucide:ban"], ["reorganize", "Reorganize Pending", "lucide:rotate-ccw"]] as const;

export function ConstraintsSection({ ctx, chat, bookId, set }: SectionProps): JSX.Element {
  const read = useCompendiumBook(ctx, bookId ?? null);
  const store = useCompendiumTree(ctx, chat.id, bookId ?? null);
  const constraints = bookId ? chat.compendium?.books?.[bookId]?.tree : undefined;
  const labels = useMemo(() => (read.state === "ready" && store.loaded ? withLabels(read.model.entries, read.model.categories, store.layout, constraints?.pins) : new Map<string, { label: string; entry: boolean }>()), [read, store.loaded, store.layout, constraints?.pins]);
  if (!bookId) return <SettingsSection id="constraints" title="Tree and entry constraints" blurb="Open a book in the Compendium to see the branches and entries you locked, forbade or moved in it." dot="var(--bk-role-select)"><span /></SettingsSection>;
  const ids = constrainedIds(constraints);
  const rows = ids.map((id) => ({ id, ...(labels.get(id) ?? { label: id, entry: !id.includes(":") }) }));
  const nodes = rows.filter((r) => !r.entry);
  const entries = rows.filter((r) => r.entry);
  const clear = (id: string) => void set({ books: { [bookId]: { tree: clearConstraints(constraints, id) } } });
  const list = (title: string, items: typeof rows): JSX.Element | null => items.length === 0 ? null : (
    <div key={title}>
      <div className="cps-lab">{title} ({items.length})</div>
      <div className="cps-cons">
        {items.map((r) => {
          const f = flagsOf(constraints, r.id);
          const target = constraints?.pins?.[r.id];
          return (
            <div key={r.id} className="row">
              <div><b>{r.label}</b>
                <span className="chips">
                  {CHIPS.filter(([kind]) => f[kind]).map(([kind, text, icon]) => <em key={kind} className={kind}><Ic name={icon} size={12} /> {text}</em>)}
                  {f.pinned && <em className="pinned"><Ic name="lucide:pin" size={12} /> Pinned under {labels.get(target ?? "")?.label ?? target}</em>}
                </span>
              </div>
              <button type="button" title="Clear all flags on this item" aria-label={`Clear every choice on ${r.label}`} onClick={() => clear(r.id)}><Ic name="lucide:x" size={14} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
  return (
    <SettingsSection id="constraints" title="Tree and entry constraints" blurb="User-set flags on tree branches and on individual entries that survive rebuilds. Lock to keep the AI's hands off. Forbid to never let it exist (the AI must redistribute). Reorganize fires once on the next rebuild and then clears. Set new ones by right-clicking branches (in the TV Tree sub-tab) or entries (in the By Type sub-tab) in the Browse tab." dot="var(--bk-role-select)">
      {ids.length === 0
        ? <p className="cps-empty">No constraints set. Right-click a tree node or an entry in Browse to lock, forbid, or schedule it for reorganization.</p>
        : [list("Branches", nodes), list("Entries", entries)]}
    </SettingsSection>
  );
}
