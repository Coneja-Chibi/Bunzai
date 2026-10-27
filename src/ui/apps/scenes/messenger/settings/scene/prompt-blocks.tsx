/**
 * The deeper page of the Preset row (wireframe: Presets and prompts > Narrator bank): the preset's choices and one switch per prompt block, for this scene. One scene preset writer (`useScenePresetOwn`) and one
 * choices writer (`useSceneChoices`) serve the whole page, as they do in the Prompting wing's Preset tab, so a switch and an answer can never overwrite each other; the page is a deeper page so that the Writing page's
 * Samplers (which hold the same writer) are not drawn beside it. A block is on by the scene's switch if it has one, else by the choices, else by the preset (`effectiveToggles`, `toggleBlock`); a block a choice
 * names keeps an explicit switch. The blocks are windowed, since a preset can hold hundreds. The prompt text itself is the Prompt editor program, reached by the last row.
 */
import { useState, type JSX } from "react";
import type { PresetBody, PresetPrompt } from "../../../../../../entities/preset/schema";
import { strArray } from "../../../../../../core/guards";
import { referencedPromptIds, type ChoiceGroup } from "../../../../../../core/macros/choice-groups";
import { selectionShortfall } from "../../../../../../core/preset/choice-stepper";
import { effectiveToggles } from "../../../../../../core/preset/choices";
import { countText } from "../../../../../../core/tokens";
import { VirtualRows } from "../../../../../_shared/virtual-list";
import { groupsOf, isOn, markerLabel, toggleBlock } from "../../../preset-core";
import { saveChoiceDefaults } from "../../../scene-choices";
import { useBoothPreset } from "../../../use-booth-preset";
import { useSceneChoices, type SceneChoices } from "../../../use-scene-choices";
import { useScenePresetOwn } from "../../../use-scene-preset-own";
import { ActionRow, DrillRow, SelectRow, ToggleRow } from "../../frames/settings-rows";
import { CheckedText } from "./drafts";
import { chatOf, takeChat, type SceneEnv } from "./env";

const SAY = "msn-st-secd";
const BLOCK_ROW_PX = 64;

function Heading({ children }: { children: string }): JSX.Element {
  return <div className="msn-st-cap" role="heading" aria-level={3}>{children}</div>;
}

/** One group's rows: a select for one answer, a switch for a yes or no, a switch per option for several, a text for a typed one. Each answer is written alone, in order. */
function GroupRows({ group, choices }: { group: ChoiceGroup; choices: SceneChoices }): JSX.Element {
  const value = choices.selections[group.id];
  const send = (pick: string | string[] | boolean): void => { void choices.select(group.id, pick).catch(() => undefined); };
  const copy = { label: group.label, ...(group.description ? { description: group.description } : {}) };
  if (group.type === "toggle") return <ToggleRow {...copy} on={value === true} onChange={send} />;
  if (group.type === "input") return <CheckedText {...copy} saved={typeof value === "string" ? value : ""} rows={1} write={send} />;
  if (group.type === "select_one") return <SelectRow {...copy} value={typeof value === "string" ? value : ""} options={group.options.map((o) => ({ value: o.id, label: o.label, ...(o.description ? { description: o.description } : {}) }))} onChange={send} />;
  const picked = new Set(strArray(value));
  const short = selectionShortfall(group, choices.selections);
  return (
    <>
      {group.options.map(/* bounded-ok: one preset's options for one group */ (o) => (
        <ToggleRow key={o.id} label={`${group.label}: ${o.label}`} {...(o.description ? { description: o.description } : {})} on={picked.has(o.id)}
          onChange={(on) => send(group.options.map((x) => x.id).filter((id) => (id === o.id ? on : picked.has(id))))} />
      ))}
      {short > 0 && <p className={SAY} role="status">{group.label}: pick at least {group.min ?? short}.</p>}
    </>
  );
}

function ChoiceRows({ env, presetId, choices }: { env: SceneEnv; presetId: string; choices: SceneChoices }): JSX.Element {
  return (
    <>
      <Heading>Choices</Heading>
      {choices.groups.map(/* bounded-ok: the groups one preset declares */ (g) => <GroupRows key={g.id} group={g} choices={choices} />)}
      {choices.error && <p className={SAY} role="alert">{choices.error}</p>}
      <ActionRow label="Keep these answers" description="Use them as your answers for this preset in new scenes." action="Save as default" onAction={() => saveChoiceDefaults(env.a.ctx.prefs, presetId, choices.selections)} />
    </>
  );
}

interface Block { p: PresetPrompt; group: string | null }

const blocksOf = (body: PresetBody): Block[] => groupsOf(body).flatMap((g) => g.prompts.map((p) => ({ p, group: g.id === null ? null : g.name })));

/** The page body: choices, then one switch per block, then the way to the prompt text. */
export function PromptBlocksPage({ env }: { env: SceneEnv }): JSX.Element {
  const chat = chatOf(env);
  const { ctx } = env.a;
  const [warn, setWarn] = useState<string | null>(null);
  const preset = useBoothPreset(ctx, chat.preset ?? null);
  const own = useScenePresetOwn(ctx, chat, takeChat(env), setWarn);
  const body = preset.state === "ready" ? preset.body : null;
  const choices = useSceneChoices(ctx, chat, body, takeChat(env));
  const editor = <DrillRow label="Prompt editor" description="Edit what each prompt says, its order and the preset's templates." onOpen={() => env.open("prompts")} />;
  if (!chat.preset) return <><p className={SAY}>This scene runs without a preset, so it has no prompt blocks to switch. Choose one on the Writing page.</p>{editor}</>;
  if (preset.state === "loading") return <p className={SAY} role="status">Loading the preset...</p>;
  if (!body || !own.own) return <><p className={SAY} role="alert">{preset.state === "gone" ? "This scene's preset is no longer in your library. Choose another on the Writing page." : "The preset could not be read."}</p>{editor}</>;
  // RoleCall hides the prompt tools for a Script Sheet: it is one instruction, edited in Prompting.
  if (chat.preset.kind !== "preset") return <><p className={SAY}>This scene uses a Script Sheet, one instruction with no blocks to switch. Edit it in Prompting.</p>{editor}</>;
  const saved = own.own;
  const toggles = effectiveToggles(choices.groups, choices.selections, saved.toggles);
  const keep = referencedPromptIds(choices.groups);
  const blocks = blocksOf(body);
  return (
    <div data-part="scene.messenger.settings.prompts">
      {choices.groups.length > 0 && <ChoiceRows env={env} presetId={chat.preset.id} choices={choices} />}
      <Heading>Prompt blocks</Heading>
      <VirtualRows items={blocks} keyOf={(b) => b.p.id} estimate={BLOCK_ROW_PX} render={({ p, group }) => (
        <ToggleRow label={p.marker ? `${markerLabel(p.markerSlot ?? p.id)} slot` : p.name || p.id} description={[group, p.marker ? null : `~${countText(p.content).toLocaleString()} tokens`].filter(Boolean).join(", ")}
          on={isOn(p, toggles)} onChange={(on) => own.save({ ...saved, toggles: toggleBlock(saved.toggles, p, on, keep) })} />
      )} />
      {warn && <p className={SAY} role="alert">{warn}</p>}
      {editor}
    </div>
  );
}
