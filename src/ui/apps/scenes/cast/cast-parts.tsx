/**
 * The Cast wing's shared pieces, after RoleCall's WingShell chrome: the hero card, a form section card,
 * a one-line field, a prose section with fullscreen expand, the pinned footer (Save, with its note), and
 * the portrait column both tabs use. Colour comes only from tokens; a section's tone is one deck token.
 */
import { useRef, type JSX, type ReactNode } from "react";
import { ExpandTextarea } from "../../../components/expand";
import { Button, IconButton } from "../../../components/button";
import { Ic, type IconName } from "../../../_shared/ic";
import { portraitFromRef } from "../../../../core/media";
import type { MediaAsset } from "../../../../entities/character/schema";
import type { AssetUpload } from "../../../_shared/asset-upload";
import type { SaveNote } from "./cast-core";

/** The wing's hero card: icon, eyebrow, a title with its accent word, and a subtitle. */
export function CastHero({ icon, eyebrow, title, emphasis, sub }: { icon: IconName; eyebrow: string; title: string; emphasis: string; sub?: string }): JSX.Element {
  return (
    <header className="hero cw-hero" data-part="scene.cast.hero">
      <span className="hi"><Ic name={icon} size={20} /></span>
      <div><div className="eb">{eyebrow}</div><h2>{title} <em>{emphasis}</em></h2>{sub && <p>{sub}</p>}</div>
    </header>
  );
}

/** A titled form card with a tone from one deck token and an optional expand button. */
export function FormSection({ title, icon, tone, note, expand, children, "data-part": part }: {
  title: string; icon: IconName; tone: string; note?: string; expand?(): void; children: ReactNode; /** The section's stable part name, written as a literal at each call so the parts page lists it. */ "data-part": string;
}): JSX.Element {
  return (
    <section className="cw-sec" style={{ "--c": tone } as React.CSSProperties} data-part={part}>
      <h3><Ic name={icon} size={16} />{title}{note && <small>{note}</small>}{expand && <span className="xp"><IconButton variant="quiet" size="sm" label={`Expand ${title}`} icon="lucide:maximize-2" onClick={expand} /></span>}</h3>
      {children}
    </section>
  );
}

/** A labelled one-line input. */
export function LineField({ label, value, onChange, placeholder, tone, disabled }: {
  label: string; value: string; onChange(v: string): void; placeholder?: string; tone?: "big" | "line" | "bare"; disabled?: boolean;
}): JSX.Element {
  return (
    <label className={`cw-line${tone ? ` ${tone}` : ""}`}>
      <span className="lb">{label}</span>
      <input value={value} placeholder={placeholder} aria-label={label} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** A prose section: RoleCall's titled card with a text area that can go fullscreen. */
export function ProseSection({ title, icon, tone, value, onChange, rows = 3, placeholder, note, disabled, "data-part": part }: {
  title: string; icon: IconName; tone: string; value: string; onChange(v: string): void; rows?: number; placeholder?: string; note?: string; disabled?: boolean; "data-part": string;
}): JSX.Element {
  return (
    <FormSection title={title} icon={icon} tone={tone} data-part={part} {...(note ? { note } : {})}>
      <ExpandTextarea label={title} className="cw-ta" rows={rows} value={value} placeholder={placeholder} aria-label={title} disabled={disabled}
        onChange={(e) => onChange(e.target.value)} />
    </FormSection>
  );
}

/** The pinned footer: the note about the last save, then the buttons the tab hands in, then Save. */
/** The pinned footer: the note about the last save, the tab's own buttons, then Save (Saved when clean). */
export function CastFooter({ dirty, saving, busy, note, what, saveLabel, onSave, children }: {
  dirty: boolean; saving: boolean; busy: boolean; note: SaveNote | null; what: string; /** the dirty button's words when a tab follows RoleCall's own (Save Draft) */ saveLabel?: string; onSave(): void; children?: ReactNode;
}): JSX.Element {
  const label = saving ? "Saving..." : dirty ? saveLabel ?? `Save ${what}` : "Saved";
  return (
    <footer className="cw-foot" data-part="scene.cast.footer">
      {note && <p className={`cw-note ${note.kind}`} role={note.kind === "saved" ? "status" : "alert"}>{note.text}</p>}
      {dirty && !note && <p className="cw-note hint">Saves the Library {what}, then moves this scene to the new version. Other scenes show Update available.</p>}
      {busy && dirty && <p className="cw-note busy" role="status">A reply is being written. You can save when it finishes.</p>}
      {children}
      <Button block variant={dirty ? "primary" : "secondary"} icon={!dirty && !saving ? "lucide:check" : undefined} disabled={!dirty || saving || busy} onClick={onSave}>{label}</Button>
    </footer>
  );
}

/** The tall portrait column: art or a stand-in, a change-image button, the "now" chip, and the caller's captions. */
/** The tall portrait column: art or a stand-in, a change-image button, the now chip, and the caller's captions. */
export function CastPortrait({ art, standIn, chip, name, lines, topLeft, upload, onPick, children }: {
  art: JSX.Element | null; standIn: ReactNode; chip: string; name: string; lines: ReactNode; topLeft?: ReactNode;
  upload?: AssetUpload; onPick?(asset: MediaAsset): void; children?: ReactNode;
}): JSX.Element {
  const file = useRef<HTMLInputElement>(null);
  const pick = async (f: File | undefined): Promise<void> => {
    if (!f || !upload || !onPick) return;
    const staged = await upload(f);
    const asset = portraitFromRef(staged.ref, staged.mime);
    if (asset) onPick({ ...asset, label: f.name });
  };
  return (
    <div className="cw-por" data-part="scene.cast.portrait">
      <div className="img">{art ?? <span className="standin">{standIn}</span>}</div>
      <div className="tl">{topLeft}</div>
      {onPick && (
        <div className="tr">
          <IconButton size="sm" label="Change image" icon="lucide:image" onClick={() => file.current?.click()} />
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}
      <div className="fadeb" />
      <div className="cw-info">
        <span className="nowchip"><i />{chip}</span>
        <h1>{name}</h1>
        {lines}
        {children}
      </div>
    </div>
  );
}
