/**
 * The chat layout chooser: RoleCall's first-run chat appearance page (components/scene/ChatAppearanceChooser.tsx, copy kept
 * word for word minus "We will save it to your account.", which is untrue in a local app) with the two layouts Bunraku has.
 * Full Chat is preselected; Preview opens the large view with a Choose button; Use hands the pick to onChoose.
 * The cards show real screenshots of one synthetic test scene in each layout (docs/media/chat-layouts/, 1920x947 like RoleCall's).
 */
import { useState, type CSSProperties, type JSX } from "react";
import { docAssetUrl } from "../../../_shared/asset-url";
import { Ic } from "../../../_shared/ic";
import { DialogCore } from "../../../components/dialog-core";
import { Button } from "../../../components/rc-controls";
import type { ChatLayout } from "../chat-layout";
import styles from "./layout-chooser.module.css";

const CHOICES: readonly { value: ChatLayout; title: string; image: string; lead: string; description: string }[] = [
  { value: "stage", title: "Full Chat", image: "full-chat", lead: "Your complete writing workspace.", description: "Keep the conversation, character details and trackers together, with your tools close at hand." },
  { value: "messenger", title: "Messenger", image: "messenger", lead: "A familiar place to catch up.", description: "Recent characters, your persona profile and a conversation with one settings workspace." },
];
type Choice = (typeof CHOICES)[number];

function Shot({ choice }: { choice: Choice }): JSX.Element {
  return (
    <img className={styles.shot} src={docAssetUrl(`docs/media/chat-layouts/${choice.image}.jpg`)} width={1920} height={947} alt={`${choice.title} layout in a test chat`} decoding="async" />
  );
}

export function LayoutChooser({ onChoose }: { onChoose: (layout: ChatLayout) => void }): JSX.Element {
  const [selected, setSelected] = useState<ChatLayout>("stage");
  const [preview, setPreview] = useState<Choice | null>(null);
  const choice = CHOICES.find((c) => c.value === selected) ?? CHOICES[0]!;

  return (
    <main className={styles.page} style={{ "--chooser-user": "var(--accent)", "--chooser-character": "var(--deck-character)" } as CSSProperties}>
      <div className={styles.rays} aria-hidden="true" />
      <section className={styles.content} aria-labelledby="chat-layout-title">
        <div className={styles.masthead}><span className={styles.title}>Bunraku</span><span>YOUR SPACE / YOUR STORIES</span></div>
        <header className={styles.intro}>
          <div><p className={styles.eyebrow}>A space for your stories</p><h1 id="chat-layout-title" className={styles.title}>Choose your<br /><span>chat layout.</span></h1></div>
          <div><p className={styles.subtitle}>Same characters. Same stories. Your kind of stage.</p><p>Choose a layout for all your chats. You can change it anytime in Appearance.</p></div>
        </header>
        <fieldset role="radiogroup" aria-label="Chat layout" className={styles.choices}>
          <legend className={styles.sr}>Chat layout</legend>
          {CHOICES.map((option, index) => (
            <article key={option.value} className={styles.card} data-selected={selected === option.value}>
              <label className={styles.option}>
                <input className={styles.sr} type="radio" name="chat-layout" value={option.value} checked={selected === option.value} onChange={() => setSelected(option.value)} aria-label={option.title} />
                <span className={styles.heading}><span className={styles.number}>0{index + 1}</span><span className={styles.title}>{option.title}</span><span className={styles.check} aria-hidden="true">{selected === option.value && <Ic name="lucide:check" size={16} />}</span></span>
                <Shot choice={option} />
                <span className={styles.copy}><strong>{option.lead}</strong><span>{option.description}</span></span>
              </label>
              <Button variant="ghost" className={styles.previewButton} onClick={() => setPreview(option)} aria-label={`Preview ${option.title}`}><Ic name="lucide:expand" size={16} />Preview</Button>
            </article>
          ))}
        </fieldset>
        <p className={styles.caption}>Actual screenshots from a test chat. Every layout runs the same scene.</p>
        <footer className={styles.footer}>
          <p role="status">{choice.title} selected</p>
          <Button className={styles.primary} onClick={() => onChoose(selected)}>Use {choice.title}<Ic name="lucide:arrow-right" size={16} /></Button>
        </footer>
      </section>
      {preview && (
        <DialogCore placement="center" portal ariaLabel={`${preview.title} preview`} labelledBy="layout-preview-title" onDismiss={() => setPreview(null)} overlayClassName={styles.scrim} className={styles.dialog}>
          <div className={styles.dialogHeading}><h2 id="layout-preview-title" className={styles.title}>{preview.title}</h2><Button variant="ghost" onClick={() => setPreview(null)} aria-label="Close preview"><Ic name="lucide:x" size={16} /></Button></div>
          <Shot choice={preview} />
          <p>{preview.description}</p>
          <div className={styles.dialogActions}><Button className={styles.primary} onClick={() => { setSelected(preview.value); setPreview(null); }}>Choose {preview.title}</Button></div>
        </DialogCore>
      )}
    </main>
  );
}
