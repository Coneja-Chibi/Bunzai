/**
 * The Character tab's "New scene defaults" section: what a NEW scene with this character starts on (preset, samplers, backdrop, Story Director). The same pref and the same reader and writer
 * as the Messenger character settings (`useCharacterDefaults`); the card is untouched and a scene that already exists never changes.
 */
import type { JSX } from "react";
import { Segmented, Toggle } from "../../../components/button";
import type { AppContext } from "../../../app-contract";
import type { OpenScene } from "../../../../studio/scenes";
import { FormSection } from "./cast-parts";
import { useCharacterDefaults } from "./use-character-defaults";

export function DefaultsSection({ ctx, chat }: { ctx: Pick<AppContext, "prefs" | "api">; chat: Pick<OpenScene["chat"], "backdrop" | "preset" | "cast"> }): JSX.Element {
  const { d, problems, choices, presetValue, gone, note, customSamplers, put, choosePreset, keepSamplers, keepBackdrop } = useCharacterDefaults(ctx, chat);
  return (
    <FormSection title="New scene defaults" icon="lucide:sliders-horizontal" tone="var(--deck-preset)" note="(a scene can override each one)" data-part="scene.cast.defaults">
      {problems.length > 0 && <p className="notice gone" role="alert">Some saved defaults could not be read and are not used. Choosing a value again replaces them.</p>}
      {gone && <p className="notice gone" role="status">The saved preset is no longer in your library. New scenes start without a preset until you choose another.</p>}
      {note && <p className="notice" role="status">{note}</p>}
      <label className="cw-line"><span className="lb">Preset</span>
        <select data-part="scene.cast.defaults.preset" value={presetValue} onChange={(e) => choosePreset(e.currentTarget.value)}>
          <option value="">No preset</option>
          {gone && <option value={presetValue}>No longer in your library</option>}
          {/* bounded-ok: options of a native select, which the browser lists in its own scrolling popup */}
          {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      {d.presetId !== undefined && (
        <div className="cw-sub"><span className="lb">Samplers</span>
          <Segmented<"preset" | "custom"> data-part="scene.cast.defaults.samplers" label="Samplers" size="sm" value={customSamplers ? "custom" : "preset"} onChange={(v) => { if (v === "preset") put({ samplers: null }); else keepSamplers(); }}
            items={[{ value: "preset", label: "Use preset" }, { value: "custom", label: "Custom", title: "Keeps this scene's sampler values for new scenes" }]} />
        </div>
      )}
      <div className="cw-sub"><span className="lb">Backdrop</span>
        <Segmented<"none" | "scene"> data-part="scene.cast.defaults.backdrop" label="Backdrop" size="sm" value={d.backdrop ? "scene" : "none"} onChange={(v) => { if (v === "none") put({ backdrop: null }); else keepBackdrop(); }}
          items={[{ value: "none", label: "None" }, { value: "scene", label: "This scene's", title: "Keeps this scene's backdrop for new scenes" }]} />
      </div>
      <div className="cw-sub"><span className="lb">Turn on Story Director</span>
        <Toggle on={d.director === true} aria-label="Turn on Story Director for new scenes" onChange={(on) => put({ director: on ? true : null })} />
      </div>
    </FormSection>
  );
}
