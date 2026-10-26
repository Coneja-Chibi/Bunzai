/**
 * The character scope of the Messenger settings (wireframe SCOPES.char). The card's fields are saved through the Cast wing's draft and Save Draft path, which also moves this scene onto the
 * new card version, so they are value rows here (read from the scene's own copy of the card) that lead to the Characters program to be edited, never written from a row. What the scene itself
 * stores about the character is a row: which Look it wears. The card version actions are the page's own (`onUpdate`, `onRevert`). The wireframe's Lorebooks, Compendium, Wardrobe and Participants
 * pages are stored per scene and sit in the scene scope; its Character defaults page is character-defaults.tsx (a user pref a new scene reads); Injection depth has no store behind it and is not drawn; Delete character is the Library's.
 */
import type { JSX } from "react";
import type { CharacterVariant } from "../../../../../entities/character/schema";
import { bodyOf } from "../../../../../core/guards";
import { toErrorMessage } from "../../../../_shared/error-message";
import { readPath } from "../../../workbench/editor-core";
import { str } from "../../../workbench/editor-derive";
import { RATING_CHOICES } from "../../cast/cast-core";
import { isNewer } from "../../scene-card";
import { ActionRow, SelectRow } from "../frames/settings-rows";
import type { SettingsScope } from "../frames/settings-window";
import type { WingArgs } from "../wing-props";
import { CharacterDefaultRows } from "./character-defaults";
import { CharacterHero } from "./character-stats";
import type { OpenProgram } from "./scopes";

const clip = (text: string, n = 60): string => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}...` : one;
};

const FIELDS: readonly { label: string; path: string; description?: string }[] = [
  { label: "Name", path: "identity.name" },
  { label: "Tagline", path: "identity.tagline" },
  { label: "Description", path: "identity.description" },
  { label: "Personality", path: "persona.personality" },
  { label: "Scenario", path: "persona.scenario" },
  { label: "First message", path: "greetings.firstMessage" },
  { label: "Example dialogue", path: "examples.exampleMessages" },
];

function CardRows({ a, open }: { a: WingArgs; open: OpenProgram }): JSX.Element {
  const body = bodyOf(a.scene.snapshot.character);
  const edit = (): void => open("characters");
  const rating = str(readPath(body, "discovery.rating")) || "all-ages";
  const tags = readPath(body, "discovery.tags");
  const variants = Array.isArray(body["variants"]) ? (body["variants"] as CharacterVariant[]) : [];
  return (
    <>
      {FIELDS.map((f) => <ActionRow key={f.path} label={f.label} value={clip(str(readPath(body, f.path))) || "Empty"} action="Edit" onAction={edit} />)}
      <ActionRow label="Content rating" value={RATING_CHOICES.find((r) => r.value === rating)?.label ?? rating} action="Edit" onAction={edit} />
      <ActionRow label="Tags" value={Array.isArray(tags) && tags.length > 0 ? clip(tags.join(", ")) : "None"} action="Edit" onAction={edit} />
      {variants.length > 0 && (
        <SelectRow label="Look" description="The look this scene shows. Only this scene changes." value={a.scene.chat.variantId ?? ""} options={[{ value: "", label: "Base" }, ...variants.map((v) => ({ value: v.id, label: v.label ?? v.id }))]}
          onChange={(id) => { a.ctx.api.editScene("variant", { chatId: a.scene.chat.id, variantId: id === "" ? null : id }).then(a.replaceScene, (e: unknown) => a.ctx.setStatus(`could not change the look: ${toErrorMessage(e)}`)); }} />
      )}
    </>
  );
}

function VersionRows({ a }: { a: WingArgs }): JSX.Element {
  const { card } = a;
  return (
    <>
      {card && isNewer(card) && <ActionRow label="Update available" description={`This scene plays version ${String(card.version)} of the card.`} value={`Version ${String(card.latest)}`} action="Update" onAction={a.onUpdate} />}
      {card?.previous != null && <ActionRow label="Previous version" description="Put this scene back on the version it had before the last update." value={`Version ${String(card.previous)}`} action="Go back" onAction={a.onRevert} />}
      <ActionRow label="Full editor" description="Every field of the card, in the Workbench." action="Open"
        onAction={() => a.ctx.workbench.open({ id: a.scene.chat.cast.character.id, kind: "character", name: a.name })} />
    </>
  );
}

export function characterScope(a: WingArgs, open: OpenProgram): SettingsScope {
  return {
    id: "character", title: a.name, kind: "Character", leading: a.charArt,
    edit: { label: "Edit character", onClick: () => open("characters") },
    categories: [{ id: "overview", label: "Overview", icon: "lucide:contact-round", hero: <CharacterHero a={a} />, sections: [
      { id: "card", title: "Card", description: "The fields that define this character.", body: <CardRows a={a} open={open} /> },
      { id: "version", title: "Version", body: <VersionRows a={a} /> },
    ] }, { id: "defaults", label: "Character defaults", icon: "lucide:sliders-horizontal", group: "Defaults", sections: [
      { id: "new-scene", title: "New scene defaults", description: `Starting values for new scenes with ${a.name}. A scene can override each one.`, body: <CharacterDefaultRows a={a} /> },
    ] }],
  };
}
