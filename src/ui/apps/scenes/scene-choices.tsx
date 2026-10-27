/**
 * The Preset tab's "Choices" row (RoleCall's ChoiceGroupsSection): one slim row for a preset that declares choice groups, with "N of M
 * customized" and a button into the guided walkthrough. The first time a preset with groups loads for a scene, a small dialog offers the
 * walkthrough once; the offer is remembered per scene and preset so it never nags twice. A preset without groups shows nothing.
 */
import { useEffect, useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { PresetBody } from "../../../entities/preset/schema";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { ChoiceSelections } from "../../../core/macros/choice-groups";
import { buildPromptPeekMap, customizedCount } from "../../../core/preset/choice-stepper";
import { PRESET_CHOICE_DEFAULTS_KEY } from "../../../core/preset/choices";
import { recOr } from "../../../core/guards";
import { Button } from "../../components/button";
import { Ic } from "../../_shared/ic";
import { InkDialog } from "../../components/ink-dialog";
import { ChoiceWalkthrough } from "./scene-choice-walkthrough";
import type { SceneChoices } from "./use-scene-choices";

/** "Save & done": the answers kept as the person's defaults for this preset, over every other preset's (the walkthrough and the Messenger settings page both save them here). */
export function saveChoiceDefaults(prefs: AppContext["prefs"], presetId: string, selections: ChoiceSelections): void {
  prefs.set(PRESET_CHOICE_DEFAULTS_KEY, { ...recOr(prefs.get(PRESET_CHOICE_DEFAULTS_KEY)), [presetId]: selections });
}

const offeredKey = (chatId: string, presetId: string): string => `scenes.choiceOffered.${chatId}.${presetId}`;

export function ChoicesRow({ ctx, chat, body, choices }: { ctx: AppContext; chat: Chat; body: PresetBody; choices: SceneChoices }): JSX.Element | null {
  const presetId = chat.preset?.id ?? null;
  const { groups, selections } = choices;
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (groups.length === 0 || !presetId) return;
    const key = offeredKey(chat.id, presetId);
    if (ctx.prefs.get(key)) return;
    // Written when the offer shows, not when it is answered, so an escaped dialog never asks again.
    ctx.prefs.set(key, true);
    setOffer(true);
    // the shell rebuilds ctx on every status change; only the scene and preset decide an offer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length, chat.id, presetId]);
  if (groups.length === 0 || !presetId) return null;
  const close = (): void => { setOpen(false); setStep(0); };
  return (
    <div className="ch-row-bar" data-part="scene.choices">
      <Ic name="lucide:sliders-horizontal" size={14} />
      <div><b>Choices</b><small>{customizedCount(groups, selections)} of {groups.length} customized</small></div>
      <Button size="sm" onClick={() => setOpen(true)}>Open walkthrough</Button>
      {choices.error && <span className="ch-fail" role="alert">{choices.error}</span>}
      {offer && (
        <InkDialog onDismiss={() => setOffer(false)} ariaLabel="Preset walkthrough offer">
          <div className="ch-offer">
            <div className="eb">Preset choices</div>
            <h3>Set the <em>stage</em></h3>
            <p>This preset has options and a guided walkthrough. Set it up now?</p>
            <div className="row">
              <Button variant="quiet" onClick={() => setOffer(false)}>Use defaults</Button>
              <Button variant="primary" autoFocus onClick={() => { setOffer(false); setOpen(true); }}>Walk me through</Button>
            </div>
          </div>
        </InkDialog>
      )}
      {open && (
        <ChoiceWalkthrough groups={groups} selections={selections} startAt={step} onStep={setStep} onClose={close} presetName={body.name}
          {...(body.description ? { readme: body.description } : {})} peeks={buildPromptPeekMap(body.prompts.map((p) => ({ id: p.id, name: p.name, content: p.content })))}
          onSelect={(groupId, value) => { void choices.select(groupId, value).catch(() => undefined); }}
          onSave={() => saveChoiceDefaults(ctx.prefs, presetId, selections)} />
      )}
    </div>
  );
}
