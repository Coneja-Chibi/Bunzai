/**
 * Anti-Slop's attached sets (RoleCall's AttachedSetsPicker, PostProductionPanel.tsx:864-1471): a search across the attached banks'
 * names, rules and banned entries (pin an entry to always send it), each attached set as a card that opens to its banks (switch a bank,
 * see what it catches and what depth sends of it, pick a depth for it alone), Enable all and Disable all, reorder, Detach, and
 * "+ Attach another set". Copy is RoleCall's; its arrows and ticks are icons here.
 */
import { useMemo, useState, type JSX } from "react";
import { BANKS, BANK_DEPTH, SETS, bankIdsInSet, depthFor, getBank, getSet, resolveBankId, resolveSetId, stripMd, type Bank, type BankDepth } from "../../../../core/final-cut/banks";
import type { FinalCutPass } from "../../../../core/final-cut/pass";
import { Ic } from "../../../_shared/ic";
import { Button, Chip, Disclosure, IconButton, ListRow, Segmented } from "../../../components/button";
import { searchBanks } from "./fc-core";
import type { Change } from "./fc-pass-chrome";

type Edit = (change: (current: FinalCutPass) => Partial<FinalCutPass>) => void;

/** Switches one bank; switching it off also drops its pins. */
export const toggleBank = (bankId: string) => (c: FinalCutPass): Partial<FinalCutPass> => {
  const on = (c.enabledBanks ?? []).some((b) => resolveBankId(b) === bankId);
  const pins = { ...c.pinnedBankExamples };
  if (on) delete pins[bankId];
  return { enabledBanks: on ? (c.enabledBanks ?? []).filter((b) => resolveBankId(b) !== bankId) : [...(c.enabledBanks ?? []), bankId], pinnedBankExamples: pins };
};

/** Pins or unpins one catalog entry; pinning switches its bank on. */
const togglePin = (bankId: string, entry: string) => (c: FinalCutPass): Partial<FinalCutPass> => {
  const pins = { ...c.pinnedBankExamples };
  const have = pins[bankId] ?? [];
  if (have.includes(entry)) {
    const rest = have.filter((e) => e !== entry);
    if (rest.length > 0) pins[bankId] = rest;
    else delete pins[bankId];
  } else pins[bankId] = [...have, entry];
  const on = (c.enabledBanks ?? []).some((b) => resolveBankId(b) === bankId);
  return { pinnedBankExamples: pins, enabledBanks: on ? c.enabledBanks ?? [] : [...(c.enabledBanks ?? []), bankId] };
};

export const swap = (list: readonly string[], a: number, b: number): string[] => { const out = [...list]; [out[a], out[b]] = [out[b]!, out[a]!]; return out; };

/** The pass with every bank of the set switched on. */
export const enableSetBanks = (ids: readonly string[]) => (c: FinalCutPass): Partial<FinalCutPass> => ({ enabledBanks: [...new Set([...(c.enabledBanks ?? []), ...ids])] });

/** The pass with the set's banks off and their pins dropped. */
export const disableSetBanks = (ids: readonly string[]) => (c: FinalCutPass): Partial<FinalCutPass> => { const pins = { ...c.pinnedBankExamples }; for (const id of ids) delete pins[id]; return { enabledBanks: (c.enabledBanks ?? []).filter((b) => !ids.includes(resolveBankId(b))), pinnedBankExamples: pins }; };

/** Detaches a set: its banks off, its pins dropped, and it leaves the attached list. */
export const detachSet = (raw: string, ids: readonly string[]) => (c: FinalCutPass): Partial<FinalCutPass> => ({ ...disableSetBanks(ids)(c), attachedSets: (c.attachedSets ?? []).filter((s) => s !== raw) });

/** Attaches a set at the end and switches its first three banks on. */
export const attachSet = (id: string) => (c: FinalCutPass): Partial<FinalCutPass> => ({ attachedSets: [...(c.attachedSets ?? []), id], enabledBanks: [...new Set([...(c.enabledBanks ?? []), ...bankIdsInSet(id).slice(0, 3)])] });

/** One bank's own depth, or (null) back to the pass default. */
export const setBankDepth = (bankId: string, d: BankDepth | null) => (c: FinalCutPass): Partial<FinalCutPass> => { const next = { ...c.bankDepthOverrides }; if (d) next[bankId] = d; else delete next[bankId]; return { bankDepthOverrides: next }; };

function BankRow({ bankId, bank, pass, open, onOpen, edit }: { bankId: string; bank: Bank; pass: FinalCutPass; open: boolean; onOpen(): void; edit: Edit }): JSX.Element {
  const enabled = new Set((pass.enabledBanks ?? []).map(resolveBankId));
  const on = enabled.has(bankId);
  const overrides = pass.bankDepthOverrides ?? {};
  const defaultDepth = pass.defaultDepth ?? "standard";
  const depth = depthFor(bankId, defaultDepth, overrides);
  const cap = BANK_DEPTH[depth];
  const sent = Math.min(bank.examples.length, cap.examples === Number.POSITIVE_INFINITY ? bank.examples.length : cap.examples);
  const conflicts = on ? (bank.conflictsWith ?? []).filter((c) => enabled.has(c)) : [];
  const setDepth = (d: BankDepth | null): void => edit(setBankDepth(bankId, d));
  return (
    <div className={`fc-bank${on ? " on" : ""}${open ? " open" : ""}`}>
      <div className="head">
        <ListRow variant="option" wrap selected={on} aria-pressed={on} onClick={() => edit(toggleBank(bankId))} label={
          <span className="fc-bank-body">
            <span className="row">
              <b>{bank.label}</b><span className={`fc-kind k-${bank.kind}`}>{bank.kind}</span>
              {bank.family && <span className="fc-tag" title={`Part of the "${bank.family}" family: sibling banks guarding the same failure.`}>{bank.family}</span>}
              {bank.extends && <span className="fc-tag" title={`Layers on ${getBank(bank.extends)?.label ?? bank.extends}. Shared entries dedupe automatically when both are enabled.`}>extends {getBank(bank.extends)?.label ?? bank.extends}</span>}
              {conflicts.length > 0 && <span className="fc-tag warn" title={`Gives opposing rewrite guidance to: ${conflicts.map((c) => getBank(c)?.label ?? c).join(", ")}. Both still run; the rewriter follows whichever fits the sentence.`}><Ic name="lucide:circle-alert" size={12} />conflicting</span>}
            </span>
            <span className="why">{stripMd(bank.why ?? bank.pattern)}</span>
            {bank.examples.length > 0 && (
              <span className="bans">
                <i>{bank.kind === "wordbank" || bank.kind === "lexical" ? "Bans" : "Catches"}:</i>
                {bank.examples.slice(0, 6).map((e, i) => <em key={i}>{stripMd(e)}</em>)}
                {bank.examples.length > 6 && <em>+{bank.examples.length - 6}</em>}
                <small>{on ? `sends ${sent}/${bank.examples.length} · ${cap.label}` : "off"}</small>
              </span>
            )}
          </span>
        } />
        <IconButton size="sm" variant="quiet" icon={open ? "lucide:minus" : "lucide:circle-question-mark"} label={open ? "Hide examples" : "Show examples & replacement guidance"} aria-expanded={open} onClick={onOpen} />
      </div>
      {open && (
        <div className="detail">
          <div className="fc-depth">
            <b>Depth in prompt</b>
            <div className="opts">
              <Segmented<"default" | BankDepth> label="Depth for this bank" size="sm" value={overrides[bankId] ?? "default"} onChange={(v) => setDepth(v === "default" ? null : v)}
                items={[
                  { value: "default", label: <><b>Use default</b><span>({BANK_DEPTH[defaultDepth].label.toLowerCase()})</span></> },
                  ...(Object.keys(BANK_DEPTH) as BankDepth[]).map((k) => ({ value: k, label: <><b>{BANK_DEPTH[k].label}</b><span>{BANK_DEPTH[k].hint}</span></> })),
                ]} />
            </div>
            <small>In prompt at this depth: pattern{cap.action ? " + action" : ""}, {sent}/{bank.examples.length} examples{cap.replace ? ", replacement guidance" : ", no replacement"}</small>
          </div>
          {bank.examples.length > 0 && (
            <div className="block">
              <div className="bh"><span>{bank.kind === "wordbank" ? `Banned entries · ${bank.examples.length} total` : "Examples · what the agent watches for"}</span><span>{sent}/{bank.examples.length} in prompt</span></div>
              {bank.kind === "wordbank"
                ? <div className="words">{bank.examples.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (e, i) => <span key={i} className={i < sent ? "in" : "out"} title={i < sent ? "In prompt at current depth" : "Skipped at current depth"}>{e}</span>)}</div>
                : <ul>{bank.examples.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (e, i) => <li key={i} className={i < sent ? "in" : "out"}>{e}</li>)}</ul>}
            </div>
          )}
          {bank.replace && (
            <div className={`block${cap.replace ? "" : " skipped"}`}>
              <div className="bh"><span>Replacement guidance · what the agent rewrites toward</span><span>{cap.replace ? "in prompt" : "skipped at current depth"}</span></div>
              <p>{bank.replace}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Results({ pass, query, onOpen, edit }: { pass: FinalCutPass; query: string; onOpen(setId: string, bankId: string): void; edit: Edit }): JSX.Element {
  const found = useMemo(() => searchBanks(pass.attachedSets ?? [], query), [pass.attachedSets, query]);
  if (found.length === 0) return <div className="fc-note" role="status">No attached Slopism banks or banned entries match "{query.trim()}".</div>;
  const entries = found.reduce((n, r) => n + r.matching.length, 0);
  const enabled = new Set((pass.enabledBanks ?? []).map(resolveBankId));
  return (
    <div className="fc-results">
      <div className="sum" role="status">{found.length} matching {found.length === 1 ? "bank" : "banks"} · {entries} matching {entries === 1 ? "entry" : "entries"}</div>
      {found.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (r) => {
        const bank = BANKS[r.bankId]!;
        const pins = pass.pinnedBankExamples?.[r.bankId] ?? [];
        const on = enabled.has(r.bankId);
        return (
          <article key={r.bankId} className={on ? "on" : undefined}>
            <div className="head"><div><b>{bank.label}</b><small>{r.setLabel} · {bank.kind}</small></div>
              <Chip pressed={on} onClick={() => edit(toggleBank(r.bankId))}>{on ? "Enabled" : "Enable bank"}</Chip></div>
            <p>{stripMd(bank.why ?? bank.pattern)}</p>
            {r.matching.length > 0
              ? <div className="hits" aria-label={`Matching entries in ${bank.label}`}>{r.matching.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (e, i) => (
                <div key={i}><span>{e}</span>
                  <Chip pressed={pins.includes(e)} aria-label={`${pins.includes(e) ? "Unpin" : "Pin"} "${stripMd(e)}" ${pins.includes(e) ? "from" : "to"} the prompt`} onClick={() => edit(togglePin(r.bankId, e))}>{pins.includes(e) ? "Pinned" : "Pin entry"}</Chip></div>))}</div>
              : <small>The bank's name, rule, or replacement guidance matches this search.</small>}
            <Button variant="quiet" size="sm" onClick={() => onOpen(r.setId, r.bankId)}>Open full bank</Button>
          </article>
        );
      })}
    </div>
  );
}

export function BankPicker({ pass, onChange }: { pass: FinalCutPass; onChange: Change }): JSX.Element {
  const attached = pass.attachedSets ?? [];
  const [openSets, setOpenSets] = useState<ReadonlySet<string>>(() => new Set(attached.slice(0, 1)));
  const [openBanks, setOpenBanks] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const edit: Edit = (change) => onChange(change(pass));
  const resolved = attached.map(resolveSetId);
  const unattached = SETS.filter((s) => !resolved.includes(s.id));
  const enabled = new Set((pass.enabledBanks ?? []).map(resolveBankId));
  const flip = (set: ReadonlySet<string>, id: string): Set<string> => { const next = new Set(set); if (!next.delete(id)) next.add(id); return next; };
  return (
    <div className="fc-sets" data-part="scene.finalcut.sets">
      <div className="fc-sec"><h4>Attached slopism sets</h4><span>Click a set to expand and pick which banks run.</span></div>
      <label className="fc-search"><span>Find a bank, rule, or banned phrase</span>
        <span className="box">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try &ldquo;breath hitched&rdquo;, &ldquo;filter words&rdquo;, or a bank name..." aria-label="Search slopism banks and banned entries" autoComplete="off" />
          {query && <Button size="sm" onClick={() => setQuery("")} aria-label="Clear Slopism search">Clear</Button>}
        </span>
      </label>
      {query.trim() ? (
        <Results pass={pass} query={query} edit={edit} onOpen={(setId, bankId) => { setQuery(""); setOpenSets((s) => new Set(s).add(setId)); setOpenBanks((b) => new Set(b).add(bankId)); }} />
      ) : attached.length === 0 ? (
        <div className="fc-note">No sets attached. Pick one below to start filtering.</div>
      ) : (
        <div className="fc-setlist">
          {attached.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (raw, idx) => {
            const set = getSet(raw);
            if (!set) return null;
            const ids = bankIdsInSet(raw);
            const on = ids.filter((id) => enabled.has(id)).length;
            const open = openSets.has(raw);
            return (
              <div key={raw} className={`fc-set${open ? " open" : ""}`}>
                <Disclosure open={open} onClick={() => setOpenSets(flip(openSets, raw))}
                  label={<span className="id"><b>{set.label}</b><small>{set.description}</small></span>}
                  trailing={<span className={`count${on === 0 ? " zero" : on === ids.length ? " full" : ""}`}>{on}/{ids.length} on</span>} />
                <div className="acts">
                  <Button size="sm" onClick={() => edit(enableSetBanks(ids))}>Enable all</Button>
                  <Button size="sm" onClick={() => edit(disableSetBanks(ids))}>Disable all</Button>
                  {idx > 0 && <Button size="sm" icon="lucide:chevron-up" onClick={() => edit((c) => ({ attachedSets: swap(c.attachedSets ?? [], idx - 1, idx) }))}>Up</Button>}
                  {idx < attached.length - 1 && <Button size="sm" icon="lucide:chevron-down" onClick={() => edit((c) => ({ attachedSets: swap(c.attachedSets ?? [], idx, idx + 1) }))}>Down</Button>}
                  <Button variant="danger" size="sm" onClick={() => edit(detachSet(raw, ids))}>Detach</Button>
                </div>
                {open && <div className="banks">{ids.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (id) => <BankRow key={id} bankId={id} bank={BANKS[id]!} pass={pass} open={openBanks.has(id)} onOpen={() => setOpenBanks(flip(openBanks, id))} edit={edit} />)}</div>}
              </div>
            );
          })}
        </div>
      )}
      {unattached.length > 0 ? (
        <select className="fc-select attach" value="" aria-label="Attach another set" onChange={(e) => {
          const id = e.target.value;
          if (!id) return;
          setOpenSets((s) => new Set(s).add(id));
          edit(attachSet(id));
        }}>
          <option value="">+ Attach another set...</option>
          {unattached.map(/* bounded-ok: pass reports, bank pickers and options: small authored or fixed sets */ (s) => <option key={s.id} value={s.id}>{s.label} ({s.banks.length} banks)</option>)}
        </select>
      ) : <div className="fc-note">All available sets are attached.</div>}
    </div>
  );
}
