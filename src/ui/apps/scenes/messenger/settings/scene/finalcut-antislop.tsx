/**
 * The Anti-slop pass's pages (Full Chat's AntiSlopCard and BankPicker, fc-anti-slop.tsx and fc-bank-picker.tsx): the pass's own rows, the sets attached to it (one drill row each, with how many banks are on), the watchlist
 * and replacement guidance; and one page per attached set with Enable all, Disable all, reorder, Detach and a switch and depth for each bank. Every change is one of the pure edits the bank picker exports, written through
 * `useFinalCut.patch`. Searching banks and pinning entries, and writing your own banks, stay in the Final Cut program.
 */
import type { JSX } from "react";
import { BANKS, BANK_DEPTH, SETS, bankIdsInSet, depthFor, getBank, getSet, resolveBankId, resolveSetId, type BankDepth } from "../../../../../../core/final-cut/banks";
import { attachSet, detachSet, disableSetBanks, enableSetBanks, setBankDepth, swap, toggleBank } from "../../../final-cut/fc-bank-picker";
import { DEPTHS } from "../../../final-cut/fc-anti-slop";
import { ActionRow, DrillRow, PairRow, SelectRow, TextAreaRow, ToggleRow, type ChoiceOption } from "../../frames/settings-rows";
import { useSettingsNav } from "../../frames/settings-window";
import type { SceneEnv } from "./env";
import { choicesOf, FAILURE_CHOICES, NOTE, OutputModeRow, PassBody, PassChromeRows, type PassPage } from "./finalcut-kit";

/** The deep page of one attached set. */
export const setPageId = (raw: string): string => `scene.finalcut.set.${raw}`;

function AntiSlopRows({ env, page }: { env: SceneEnv; page: PassPage }): JSX.Element {
  const { pass, change, fc } = page;
  const nav = useSettingsNav();
  const edit = (fn: Parameters<typeof fc.patch>[1]): void => fc.patch("anti-slop", fn);
  const attached = pass.attachedSets ?? [];
  const resolved = attached.map(resolveSetId);
  const enabled = new Set((pass.enabledBanks ?? []).map(resolveBankId));
  const unattached = SETS.filter((s) => !resolved.includes(s.id));
  return (
    <>
      <PassChromeRows page={page} type="anti-slop" strip={false} />
      <OutputModeRow value={pass.outputMode} onChange={(outputMode) => change({ outputMode })} />
      <PairRow a={{ label: "Default depth per bank", value: pass.defaultDepth ?? "standard", options: choicesOf(DEPTHS), onChange: (d) => change({ defaultDepth: d as BankDepth }) }}
        b={{ label: "If this pass fails", value: pass.failureMode, options: FAILURE_CHOICES, onChange: (failureMode) => change({ failureMode }) }} />
      {attached.length === 0 && <p className={NOTE}>No sets attached. Pick one below to start filtering.</p>}
      {/* bounded-ok: the sets one pass has attached, a handful chosen from a fixed catalogue */}
      {attached.map((raw) => {
        const set = getSet(raw);
        if (!set) return null;
        const ids = bankIdsInSet(raw);
        return <DrillRow key={raw} label={set.label} description={set.description} value={`${ids.filter((id) => enabled.has(id)).length}/${ids.length} on`} onOpen={() => nav.open(setPageId(raw))} />;
      })}
      {unattached.length > 0
        ? <SelectRow label="Attach another set" description="Attaching a set switches its first three banks on." value="" options={[{ value: "", label: "Pick a set" }, ...unattached.map((s) => ({ value: s.id, label: `${s.label} (${s.banks.length} banks)` }))]} onChange={(id) => { if (id) edit(attachSet(id)); }} />
        : <p className={NOTE}>All available sets are attached.</p>}
      <TextAreaRow label="Custom slopism watchlist" description="Phrases the agent should treat as banned, one per line." value={pass.customSlopisms ?? ""} rows={4} onChange={(customSlopisms) => change({ customSlopisms })} />
      <TextAreaRow label="Replacement guidance" description="A global override: concrete verbs, character-specific beats, shorter metaphors." value={pass.antiSlopInstructions ?? ""} rows={4} onChange={(antiSlopInstructions) => change({ antiSlopInstructions })} />
      <DrillRow label="Search banks, pin entries and write your own banks" description="Find a banned phrase, always send an entry, or author a custom bank." onOpen={() => env.open("post-production")} />
    </>
  );
}

export function AntiSlopPage({ env }: { env: SceneEnv }): JSX.Element {
  return <PassBody env={env} type="anti-slop" part="antislop" label="Anti-slop engine" description="Replaces worn-out phrases using the banks you attach.">{(page) => <AntiSlopRows env={env} page={page} />}</PassBody>;
}

function SetRows({ raw, page }: { raw: string; page: PassPage }): JSX.Element {
  const { pass, fc } = page;
  const nav = useSettingsNav();
  const edit = (fn: Parameters<typeof fc.patch>[1]): void => fc.patch("anti-slop", fn);
  const attached = pass.attachedSets ?? [];
  const at = attached.indexOf(raw);
  const set = getSet(raw);
  if (!set || at < 0) return <p className={NOTE}>This set is not attached to the pass.</p>;
  const ids = bankIdsInSet(raw);
  const enabled = new Set((pass.enabledBanks ?? []).map(resolveBankId));
  const defaultDepth = pass.defaultDepth ?? "standard";
  const overrides = pass.bankDepthOverrides ?? {};
  const depthOptions: ChoiceOption[] = [{ value: "default", label: `Use default (${BANK_DEPTH[defaultDepth].label.toLowerCase()})` }, ...(Object.keys(BANK_DEPTH) as BankDepth[]).map((k) => ({ value: k, label: `${BANK_DEPTH[k].label}: ${BANK_DEPTH[k].hint}` }))];
  return (
    <>
      <p className={NOTE}>{set.description}</p>
      <ActionRow label="Enable all banks" value={`${ids.filter((id) => enabled.has(id)).length}/${ids.length} on`} action="Enable all" onAction={() => edit(enableSetBanks(ids))} />
      <ActionRow label="Disable all banks" description="Also drops the entries you pinned from these banks." action="Disable all" onAction={() => edit(disableSetBanks(ids))} />
      {at > 0 && <ActionRow label="Run earlier" description="Sets are applied in the order they are attached." action="Move up" onAction={() => edit((c) => ({ attachedSets: swap(c.attachedSets ?? [], at - 1, at) }))} />}
      {at < attached.length - 1 && <ActionRow label="Run later" action="Move down" onAction={() => edit((c) => ({ attachedSets: swap(c.attachedSets ?? [], at, at + 1) }))} />}
      <ActionRow label="Detach this set" description="Switches its banks off and removes it from the pass." action="Detach" variant="danger" onAction={() => { edit(detachSet(raw, ids)); nav.back(); }} />
      {/* bounded-ok: the banks of one set, at most a few dozen from a fixed catalogue */}
      {ids.map((id) => {
        const bank = BANKS[id];
        if (!bank) return null;
        const on = enabled.has(id);
        return (
          <div key={id}>
            <ToggleRow label={bank.label} description={`${bank.kind}. ${getBank(id)?.why ?? bank.pattern}`} on={on} onChange={() => edit(toggleBank(id))} />
            {on && <SelectRow label={`${bank.label} depth`} description={`Sends ${depthFor(id, defaultDepth, overrides)} detail for this bank.`} value={overrides[id] ?? "default"} options={depthOptions}
              onChange={(v) => edit(setBankDepth(id, v === "default" ? null : (v as BankDepth)))} />}
          </div>
        );
      })}
    </>
  );
}

export function AntiSlopSetPage({ env, raw }: { env: SceneEnv; raw: string }): JSX.Element {
  return <PassBody env={env} type="anti-slop" part="antislop.set" label="Anti-slop engine" description="Replaces worn-out phrases using the banks you attach.">{(page) => <SetRows raw={raw} page={page} />}</PassBody>;
}
