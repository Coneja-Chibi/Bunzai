/**
 * The Character tab's content rating dial and Tags card (RoleCall's CharacterPanel.tsx:2134-2250). The
 * dial is RoleCall's three grades; its Visibility Status (draft, private, published) has no meaning
 * in a local library, so only the rating is here. Open Tagsheet is RoleCall's button and count line;
 * its categorized Tagsheet modal is a Discovery feature, so opening it here shows the card's own tags
 * in place, to add and remove.
 */
import { useState, type JSX } from "react";
import { Ic, type IconName } from "../../../_shared/ic";
import { Chip, ListRow, Segmented } from "../../../components/button";
import { FormSection } from "./cast-parts";
import { RATING_CHOICES } from "./cast-core";

/** RoleCall's tone per grade (green, amber, red), as the stage tokens. */
const RATING_TONE: Record<string, { icon: IconName; tone: string }> = {
  "all-ages": { icon: "lucide:sun", tone: "var(--stage-ok)" },
  mature: { icon: "lucide:moon", tone: "var(--stage-warn)" },
  explicit: { icon: "lucide:moon-star", tone: "var(--stage-danger-text)" },
};

export function RatingSection({ value, onChange }: { value: string; onChange(next: string): void }): JSX.Element {
  return (
    <FormSection title="Content Rating" icon="lucide:lock" tone="var(--stage-warn)" data-part="scene.cast.rating">
      <Segmented<string> label="Content rating" value={value} onChange={onChange}
        items={RATING_CHOICES.map((r) => {
          const { icon, tone } = RATING_TONE[r.value]!;
          return { value: r.value, tone, label: <><span className="cw-rate-ic" style={{ color: tone }}><Ic name={icon} size={14} /></span>{r.label}</> };
        })} />
    </FormSection>
  );
}

const SHOWN = 10;

export function TagsSection({ tags, onChange }: { tags: readonly string[]; onChange(next: string[]): void }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <FormSection title="Tags" icon="lucide:tags" tone="var(--deck-lorebook)" data-part="scene.cast.tags">
      <ListRow variant="picker" aria-expanded={open} onClick={() => setOpen(!open)} leading={<Ic name="lucide:tags" size={16} />}
        label="Open Tagsheet" subtitle={tags.length ? `${tags.length} tags selected` : "No tags yet"} />
      {tags.length > 0 && (
        <div className="cw-chips">
          {tags.slice(0, SHOWN).map((t) => <span key={t}>{t}</span>)}
          {tags.length > SHOWN && <span>+{tags.length - SHOWN} more</span>}
        </div>
      )}
      {open && (
        <div className="cw-tags">
          {tags.map((t) => <Chip key={t} title={`Remove tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>{t} &times;</Chip>)}
          <input placeholder="+ tag, enter" aria-label="Add a tag" onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const v = e.currentTarget.value.trim();
            if (v && !tags.includes(v)) onChange([...tags, v]);
            e.currentTarget.value = "";
          }} />
        </div>
      )}
    </FormSection>
  );
}
