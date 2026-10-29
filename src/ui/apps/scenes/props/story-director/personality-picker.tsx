/**
 * The personality picker (RoleCall's DMPersonalitySelector.tsx): the chosen narrator as a card (a 72px initial tile, the name, the title chip, the tagline in quotes, the description, and the
 * improv, agency and info control chips) that opens a list of all ten, each with its description, Philosophy, Favorite Story Arcs, Emotional Focus and style chips. RoleCall draws each
 * personality in its own hex color and a portrait; Bunzai's personalities carry no color, so each takes a theme role. The portraits are RoleCall's own (docs/media/dm-personalities/,
 * served by docAssetUrl); the Architect and the Oracle have none in RoleCall either, and a tile whose picture is missing shows the initial, RoleCall's own fallback.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { ListRow, MenuItem } from "../../../../components/button";
import { Ic } from "../../../../_shared/ic";
import { docAssetUrl } from "../../../../_shared/asset-url";
import { PERSONALITIES, personalityOf, type DirectorPersonalityDef } from "../../../../../core/director/personalities";
import type { DirectorPersonality } from "../../../../../stage/contracts/director-types";

const TONES: Readonly<Record<string, string>> = {
  "the-weaver": "var(--deck-lorebook)", "the-architect": "var(--deck-preset)", "the-oracle": "var(--deck-regex)", "the-romantic": "var(--deck-persona)", "the-thrill-seeker": "var(--stage-warn)",
  "the-shadow": "var(--bk-role-select-text)", "the-jester": "var(--stage-ok)", "the-enigma": "var(--deck-character)", "the-chronicler": "var(--deck-pack)", "the-balanced": "var(--accent)",
};
const toneOf = (p: DirectorPersonalityDef): CSSProperties => ({ "--pc": TONES[p.id] ?? "var(--accent)" } as CSSProperties);
/** The picture file for each personality that has one (RoleCall's avatar paths: dm-personalities/*.png, chronicle/weaver-avatar.png). */
export const PORTRAITS: Readonly<Record<string, string>> = {
  "the-balanced": "balanced", "the-chronicler": "chronicler", "the-enigma": "enigma", "the-jester": "jester",
  "the-romantic": "romantic", "the-shadow": "shadow", "the-thrill-seeker": "thrill-seeker", "the-weaver": "weaver",
};
export const initialsOf = (name: string): string => name.trim().replace(/^the\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "DM";

/** The tile: the portrait when there is one and it loads, else the initials (RoleCall's PersonalityAvatar). */
function Avatar({ p, xl }: { p: DirectorPersonalityDef; xl?: boolean }): JSX.Element {
  const [broken, setBroken] = useState(false);
  const file = PORTRAITS[p.id];
  return (
    <span className={`dp-av${xl ? " xl" : ""}`}>
      {file && !broken
        ? <img src={docAssetUrl(`docs/media/dm-personalities/${file}.png`)} alt={p.name} decoding="async" onError={() => setBroken(true)} />
        : <span role="img" aria-label={`${p.name} avatar`}>{initialsOf(p.name)}</span>}
    </span>
  );
}

function Style({ p }: { p: DirectorPersonalityDef }): JSX.Element {
  return <span className="dp-chips"><span>{p.philosophy.improvisation} improv</span><span>{p.philosophy.playerAgency} agency</span><span>{p.philosophy.informationControl} info control</span></span>;
}

export function PersonalityPicker({ value, onPick, disabled }: { value: DirectorPersonality; onPick(id: DirectorPersonality): void; disabled?: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  const chosen = personalityOf(value);
  return (
    <div className="dp" data-part="props.story-director.personality">
      <div className="dp-ctx" style={toneOf(chosen)}><ListRow variant="picker" wrap aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}
        leading={<Avatar p={chosen} xl />}
        label={<span className="dp-name"><b>{chosen.name}</b><i>{chosen.title}</i></span>}
        subtitle={<span className="dp-sub"><em>&ldquo;{chosen.tagline}&rdquo;</em><span className="dp-desc">{chosen.description}</span><Style p={chosen} /></span>} /></div>
      {open && (
        <div className="dp-list" role="listbox" aria-label="Story Director personality">
          {PERSONALITIES.map((p, i) => {
            const on = p.id === value;
            return (
              <div key={p.id} className="dp-ctx" style={{ ...toneOf(p), "--i": i } as CSSProperties}><MenuItem role="option" aria-selected={on} disabled={disabled}
                onClick={() => { onPick(p.id as DirectorPersonality); setOpen(false); }}>
                <span className="dp-body"><span className="dp-head">
                  <Avatar p={p} />
                  <span className="dp-tx"><span className="dp-name"><b>{p.name}</b><i>{p.title}</i></span><em>{p.tagline}</em></span>
                  {on && <span className="dp-check"><Ic name="lucide:check" size={16} /></span>}
                </span>
                <small>{p.description}</small>
                <span className="dp-more">
                  <span className="dp-h">Philosophy</span>
                  <ul>{p.philosophy.coreBeliefs.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}</ul>
                  <span className="dp-h">Favorite Story Arcs</span>
                  <span className="dp-chips arcs">{p.preferences.favoriteArcs.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (a, i) => <span key={i}>{a}</span>)}</span>
                  <span className="dp-h">Emotional Focus</span>
                  <span className="dp-chips">{p.preferences.emotionalFocus.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (a, i) => <span key={i}>{a}</span>)}</span>
                  <Style p={p} />
                </span></span>
              </MenuItem></div>
            );
          })}
        </div>
      )}
    </div>
  );
}
