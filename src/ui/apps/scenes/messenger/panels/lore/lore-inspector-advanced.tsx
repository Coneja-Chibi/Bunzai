/**
 * The inspector's Advanced tab (panels.html 3e, the Advanced pane): the Full Chat editor's advanced parts, each in its own card. Trigger mode, Injection, Timing (sticky, cooldown and
 * delay, which the wireframe's "Only on first trigger" rows stood in for; those two belong to Side effects and stay there), Recursion with Cross-Entry Boosting, Group, Character
 * filter and Side effects. The parts are scene-lore-advanced.tsx's own; this file only places them. The wireframe's group "Scope" row has no field behind it and is not drawn.
 */
import type { JSX, ReactNode } from "react";
import type { LorebookEntry } from "../../../../../../entities/lorebook/schema";
import { Segmented } from "../../../../../components/button";
import { LoreHelp } from "../../../lore-fields";
import { CharacterFilter, CrossEntryBoost, Group, PositionPicker, Recursion, SideEffects, Timing } from "../../../scene-lore-advanced";

function Card({ title, help, children }: { title: string; help?: [string, string]; children: ReactNode }): JSX.Element {
  return (
    <section className="msn-lore-card" aria-label={title}>
      <h4>{title}{help && <> <LoreHelp title={help[0]} text={help[1]} /></>}</h4>
      {children}
    </section>
  );
}

export function LoreAdvanced({ entry, groups, candidates, onPatch }: {
  entry: LorebookEntry;
  groups: readonly string[];
  candidates: readonly { id: string; title: string }[];
  onPatch(patch: Partial<LorebookEntry>): void;
}): JSX.Element {
  return (
    <>
      <Card title="Trigger mode" help={["Trigger Mode", "Simple: all triggers share one probability. Advanced: each trigger has its own probability % and optional cooldown."]}>
        <Segmented label="Trigger mode" size="sm" value={entry.triggerMode === "advanced" ? "advanced" : "simple"} items={[{ value: "simple", label: "Simple" }, { value: "advanced", label: "Advanced" }]}
          onChange={(triggerMode) => onPatch({ triggerMode })} />
      </Card>
      <Card title="Injection" help={["Injection Position", "Where in the context this entry's content will be placed. Different positions have different effects on how the AI interprets the information."]}>
        <div className="wl-pos"><PositionPicker entry={entry} onPatch={onPatch} /></div>
      </Card>
      <Card title="Timing" help={["Entry Timing", "Control when and how often this entry can activate using sticky, cooldown, and delay settings."]}>
        <Timing entry={entry} onPatch={onPatch} />
      </Card>
      <Card title="Recursion and cross-entry boosting">
        <div className="grp"><Recursion entry={entry} onPatch={onPatch} /></div>
        <CrossEntryBoost entry={entry} candidates={candidates} onPatch={onPatch} />
      </Card>
      <Card title="Group" help={["Entry Groups", "Group entries together so only one from the group activates per turn. Weights determine selection probability."]}>
        <Group entry={entry} groups={groups} onPatch={onPatch} />
      </Card>
      <Card title="Character filter"><CharacterFilter entry={entry} onPatch={onPatch} /></Card>
      <Card title="Side effects"><SideEffects value={entry.sideEffects} onChange={(sideEffects) => onPatch({ sideEffects })} /></Card>
    </>
  );
}
