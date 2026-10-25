/** Compose painterly PNG cover layers and an editable title in the Library's existing modal shell. */
import { useState, type JSX } from "react";
import { DialogCore } from "../../components/dialog-core";
import { docAssetUrl } from "../../_shared/asset-url";
import { coverDesigns, coverBackgrounds, type BookCoverChoice } from "./book-cover-core";
import styles from "./book-cover.module.css";

export function BookCover({ title, choice }: { title: string; choice: BookCoverChoice }): JSX.Element {
  const design = coverDesigns.find((a) => a.slug === choice.design);
  const background = coverBackgrounds.find((a) => a.slug === choice.background);
  return <div className={styles.cover}>
    {background && <img src={docAssetUrl(background.path)} alt="" loading="lazy" draggable={false} />}
    {design && <img src={docAssetUrl(design.path)} alt="" loading="lazy" draggable={false} />}
    <span>{choice.title?.trim() || title}</span>
  </div>;
}

export function BookCoverDialog({ title, initial, onSave, onDismiss }: {
  title: string; initial: BookCoverChoice | null; onSave(choice: BookCoverChoice | null): void; onDismiss(): void;
}): JSX.Element {
  const [choice, setChoice] = useState<BookCoverChoice>(initial ?? {
    design: coverDesigns[0]?.slug ?? "", background: coverBackgrounds[0]?.slug ?? "",
  });
  const ready = coverDesigns.length > 0 && coverBackgrounds.length > 0;
  return <DialogCore placement="center" ariaLabel="Design book cover" onDismiss={onDismiss} className={styles.dialog}>
    <h2>Design book cover</h2>
    <p>Mix an illustration and painted paper. Your title stays editable.</p>
    <div className={styles.editor}>
      <BookCover title={title} choice={choice} />
      <div className={styles.fields}>
        <label>Illustration<select value={choice.design} onChange={(e) => setChoice({ ...choice, design: e.target.value })}>
          {coverDesigns.map((a) => <option key={a.slug} value={a.slug}>{a.label}</option>)}
        </select></label>
        <label>Painted paper<select value={choice.background} onChange={(e) => setChoice({ ...choice, background: e.target.value })}>
          {coverBackgrounds.map((a) => <option key={a.slug} value={a.slug}>{a.label}</option>)}
        </select></label>
        <label>Cover title<input maxLength={120} value={choice.title ?? ""} placeholder={title}
          onChange={(e) => setChoice({ ...choice, title: e.target.value })} /></label>
        <p>Saved in your Library preferences. Original book content stays intact.</p>
        {!ready && <p>The cover collection is still being prepared.</p>}
      </div>
    </div>
    <footer><button type="button" onClick={onDismiss}>Cancel</button>
      <button type="button" onClick={() => onSave(null)}>Use original art</button>
      <button type="button" disabled={!ready} onClick={() => onSave(choice)}>Save cover</button></footer>
  </DialogCore>;
}
