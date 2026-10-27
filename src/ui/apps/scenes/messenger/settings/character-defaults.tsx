/**
 * The character scope's "Character defaults" page (wireframe SCOPES.char, def): what a NEW scene with this character starts with. One user pref (`scenes.characterDefaults`, keyed by character
 * id; the card is a shared Library piece and stays untouched), read and written by `useCharacterDefaults`, which the Full Chat Cast Character tab shares. The backdrop and samplers are kept from
 * this scene's own, because their pickers are the Control Panel's; the preset is chosen here. Changing a default never changes a scene that already exists, this one included.
 */
import type { JSX } from "react";
import { useCharacterDefaults } from "../../cast/use-character-defaults";
import { SegmentedRow, SelectRow, ToggleRow } from "../frames/settings-rows";
import type { WingArgs } from "../wing-props";

export function CharacterDefaultRows({ a }: { a: WingArgs }): JSX.Element {
  const { d, problems, choices, presetValue, gone, note, customSamplers, put, choosePreset, keepSamplers, keepBackdrop } = useCharacterDefaults(a.ctx, a.scene.chat);
  const options = [{ value: "", label: "No preset" }, ...(gone ? [{ value: presetValue, label: "No longer in your library" }] : []), ...choices];
  return (
    <div data-part="scene.messenger.settings.defaults">
      {problems.length > 0 && <p role="alert" className="msn-st-secd">Some saved defaults could not be read and are not used. Choosing a value again replaces them.</p>}
      {gone && <p role="status" className="msn-st-secd">The saved preset is no longer in your library. New scenes start without a preset until you choose another.</p>}
      {note && <p role="status" className="msn-st-secd">{note}</p>}
      <SelectRow label="Preset" description="New scenes with this character start on this preset." value={presetValue} options={options} onChange={choosePreset} />
      {d.presetId !== undefined && (
        <SegmentedRow<"preset" | "custom"> label="Samplers" description="Custom keeps this scene's sampler values for new scenes." value={customSamplers ? "custom" : "preset"}
          options={[{ value: "preset", label: "Use preset" }, { value: "custom", label: "Custom" }]}
          onChange={(v) => { if (v === "preset") put({ samplers: null }); else keepSamplers(); }} />
      )}
      <SegmentedRow<"none" | "scene"> label="Backdrop" description="Custom keeps this scene's backdrop for new scenes." value={d.backdrop ? "scene" : "none"}
        options={[{ value: "none", label: "None" }, { value: "scene", label: "This scene's" }]}
        onChange={(v) => { if (v === "none") put({ backdrop: null }); else keepBackdrop(); }} />
      <ToggleRow label="Turn on Story Director" description="New scenes start on this." on={d.director === true} onChange={(on) => put({ director: on ? true : null })} />
    </div>
  );
}
