/**
 * The Cast wing's Persona tab (approved wireframe; RoleCall's PersonaPanel): the hero, the tall portrait
 * with the Pass ticket (opens the Casting Call), the Now Live chip and RoleCall's three stats, and the
 * form in RoleCall's order: the Starring line (emoji, name, tagline, pronouns, height, age), Appearance
 * with its colour palette, Personality with traits, Quirks, History, Prompt Injection with its live preview,
 * and the linked lorebook. The fields are the Workbench persona editor's own card bodies; the Live Preview is the
 * block the assembler sends (cast-injection.tsx); the footer holds the Default persona button (the setting, never
 * changed by a swap) and Save.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { PersonaBody } from "../../../../entities/persona/schema";
import type { CharacterBody } from "../../../../entities/character/schema";
import { isPreviewablePortraitRef } from "../../../../core/media";
import { useArtSrc, usePieceArtIdentity, usePortraitAsset } from "../../../_shared/art-cache";
import { portraitUrl } from "../../../_shared/asset-url";
import { Ic } from "../../../_shared/ic";
import { patchBody, patchIdentity, setPortrait } from "../../workbench/persona/session";
import { InjectionCard } from "../../workbench/persona/injection-card";
import { SectionCard } from "../../workbench/persona/persona-cards";
import { InjectionStatus, LivePreview, type PresetScan } from "./cast-injection";
import { resolveCssColor } from "../../../_shared/css-color";
import { NamedSwatches } from "./cast-palette";
import { KnowledgeRail } from "../../workbench/lore/KnowledgeRail";
import { EmojiPicker } from "./emoji-picker";
import { useScopedAccents } from "../../../_shared/use-scoped-accents";
import { pieceAccent } from "../../../../studio/summary";
import { CastFooter, CastHero, CastPortrait, FormSection } from "./cast-parts";
import { INJECTION_POSITIONS, prettyPronouns, statLines } from "./cast-core";
import type { CastEditor } from "./use-cast-editor";

const INJECTION_LABELS = Object.fromEntries(INJECTION_POSITIONS.map((p) => [p.value, { label: p.label, hint: p.hint }]));
const STOPS = INJECTION_POSITIONS.map((p) => p.value);
const STAT_TITLES = { messages: "Messages sent with this persona", scenes: "Scenes playing this persona", streak: "Current day streak" } as const;
const STAT_ICONS = { messages: "lucide:message-square", scenes: "lucide:clapperboard", streak: "lucide:flame" } as const;

/** The Persona tab: the Starring line, appearance, personality, injection, and the Default persona and Save footer. */
export function PersonaForm({ ctx, id, editor, summary, art, stats, defaultId, busy, character, scan, onOpenPicker, onSetDefault }: {
  ctx: AppContext;
  id: string;
  editor: CastEditor<PersonaBody>;
  summary: { version?: number; writeId?: number; revision?: string; hasPortrait?: boolean } | undefined;
  /** the accent stamped from the stored persona's portrait (summary.ts artAccentOf) */
  art?: string;
  stats: { messages: number; scenes: number; streak: number } | null;
  defaultId: string | null;
  busy: boolean;
  /** the scene's frozen card, so the Live Preview expands {{char}} as a turn would */
  character: CharacterBody;
  /** what the scene's preset scan found: it decides whether the stops can change anything */
  scan: PresetScan;
  onOpenPicker(): void;
  onSetDefault(): void;
}): JSX.Element {
  const { body, edit } = editor;
  const accents = useScopedAccents({ persona: pieceAccent({ body }, art) });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiButton = useRef<HTMLButtonElement>(null);
  const onBody = (fn: (b: PersonaBody) => PersonaBody, key: keyof PersonaBody): void => edit(fn, key);
  const draftRef = body.media?.portrait?.ref ?? "";
  const draftArt = useArtSrc(isPreviewablePortraitRef(draftRef) ? draftRef : null);
  const identity = usePieceArtIdentity(ctx.pieces, "persona", id, summary?.writeId ?? 0, summary?.revision ?? "");
  const storedArt = usePortraitAsset("persona", id, summary?.version, !isPreviewablePortraitRef(draftRef) && summary?.hasPortrait ? portraitUrl("persona", id) : null, identity);
  const src = isPreviewablePortraitRef(draftRef) ? draftArt.src : storedArt.src;
  const ref = isPreviewablePortraitRef(draftRef) ? draftArt.ref : storedArt.ref;
  const emoji = body.presentation?.emoji ?? "";
  const isDefault = defaultId === id;
  useEffect(() => { setEmojiOpen(false); }, [id]);
  const setPresentation = (patch: Partial<NonNullable<PersonaBody["presentation"]>>): void =>
    onBody((b) => ({ ...b, presentation: { ...(b.presentation ?? {}), ...patch } }), "presentation");
  const identityPart = body.identity ?? {};

  return (
    <div className="cw cw-persona" data-part="scene.cast.persona" style={accents}>
      <CastHero icon="mdi:account-circle-outline" eyebrow="Identity & Details" title="Your" emphasis="Persona" sub="The character you play opposite the cast: name, look, voice, history, and how it's injected into the prompt." />
      <div className="cw-body">
        <CastPortrait
          art={src ? <img ref={ref as never} src={src} alt={body.name} /> : null}
          standIn={emoji || body.name.charAt(0).toUpperCase()}
          chip="Now live" name={body.name || "Unnamed persona"}
          upload={editor.uploads.uploadAsset}
          onPick={(asset) => onBody((b) => setPortrait(b, asset), "media")}
          topLeft={<button type="button" className="pass" onClick={onOpenPicker} aria-label="Open the Casting Call" title="Casting Call"><Ic name="lucide:bookmark" size={16} />Pass</button>}
          lines={<>
            {identityPart.tagline && <p className="cw-tg">{identityPart.tagline}</p>}
            {identityPart.pronouns && <p className="cw-tg mut">{prettyPronouns(identityPart.pronouns)}</p>}
            <div className="stats" data-part="scene.cast.persona.stats">
              {statLines(stats).map((s) => <span key={s.key} title={STAT_TITLES[s.key]}><Ic name={STAT_ICONS[s.key]} size={14} />{s.value}</span>)}
            </div>
          </>}
        />
        <div className="cw-form">
          <div className="cw-scroll">
            <section className="cw-star" data-part="scene.cast.starring">
              <div className="t"><Ic name="lucide:star" size={14} />Starring<Ic name="lucide:star" size={14} /></div>
              <div className="nm">
                <span className="cw-emoji-hold">
                  <button type="button" ref={emojiButton} className="emo" aria-label="Pick an emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}>{emoji || <Ic name="lucide:user" size={16} />}</button>
                  {emojiOpen && <EmojiPicker anchor={emojiButton.current} onClose={() => setEmojiOpen(false)} onPick={(e) => { setPresentation({ emoji: e }); setEmojiOpen(false); }} />}
                </span>
                <input value={body.name} placeholder="Character Name" aria-label="Persona name" onChange={(e) => onBody((b) => patchBody(b, { name: e.target.value }), "name")} />
              </div>
              <input className="tg2" value={identityPart.tagline ?? ""} placeholder="A brief tagline..." aria-label="Tagline" onChange={(e) => onBody((b) => patchIdentity(b, { tagline: e.target.value }), "identity")} />
              <div className="pr3">
                <input value={identityPart.pronouns ?? ""} placeholder="pronouns" aria-label="Pronouns" onChange={(e) => onBody((b) => patchIdentity(b, { pronouns: e.target.value }), "identity")} />
                <input value={identityPart.height ?? ""} placeholder="height" aria-label="Height" onChange={(e) => onBody((b) => patchIdentity(b, { height: e.target.value }), "identity")} />
                <input value={identityPart.age ?? ""} placeholder="age" aria-label="Age" onChange={(e) => onBody((b) => patchIdentity(b, { age: e.target.value }), "identity")} />
              </div>
            </section>
            <FormSection data-part="scene.cast.appearance" title="Appearance" icon="lucide:eye" tone="var(--deck-pack)" note="color palette">
              <NamedSwatches value={body.presentation?.colors ?? []} onChange={(rows) => setPresentation({ colors: rows.length ? rows : undefined })}
                signature={{ hex: body.presentation?.signatureColor ?? resolveCssColor("var(--deck-persona)"), name: body.presentation?.signatureName ?? "" }}
                onSignature={(s) => setPresentation({ signatureColor: s.hex, ...(s.name ? { signatureName: s.name } : { signatureName: undefined }) })} />
              <SectionCard body={body} onBody={onBody} writeFor="full" sectionKey="appearance" title="Appearance" placeholder="Build, distinguishing features..." />
            </FormSection>
            <FormSection data-part="scene.cast.personality" title="Personality" icon="lucide:heart" tone="var(--deck-lorebook)"><SectionCard body={body} onBody={onBody} writeFor="full" sectionKey="personality" title="Personality" placeholder="How they act, their demeanor..." /></FormSection>
            <FormSection data-part="scene.cast.quirks" title="Quirks" icon="lucide:sparkles" tone="var(--deck-regex)"><SectionCard body={body} onBody={onBody} writeFor="full" sectionKey="quirks" title="Quirks" placeholder="Habits, mannerisms, speech patterns..." /></FormSection>
            <FormSection data-part="scene.cast.history" title="History" icon="lucide:scroll-text" tone="var(--deck-preset)"><SectionCard body={body} onBody={onBody} writeFor="full" sectionKey="history" title="History" placeholder="Background, origins..." /></FormSection>
            <FormSection title="Prompt Injection" icon="lucide:target" tone="var(--stage-danger-text)" data-part="scene.cast.injection">
              <InjectionStatus scan={scan} />
              <InjectionCard body={body} onBody={onBody} stops={STOPS} labels={INJECTION_LABELS} showWrapper locked={scan !== null && scan !== "loading"} />
              <LivePreview body={body} character={character} scan={scan} />
            </FormSection>
            <FormSection data-part="scene.cast.lorebook" title="Linked Lorebook" icon="lucide:library" tone="var(--deck-lorebook)">
              <KnowledgeRail ctx={ctx} refs={body.knowledgeRefs ?? []} onChange={(next) => onBody((b) => ({ ...b, knowledgeRefs: next.length ? next : undefined }), "knowledgeRefs")} />
            </FormSection>
          </div>
          <CastFooter dirty={editor.dirty} saving={editor.saving} busy={busy} note={editor.note} what="persona" onSave={() => void editor.save()}>
            <button type="button" className={`cw-default${isDefault ? " on" : ""}`} aria-pressed={isDefault} disabled={isDefault} onClick={onSetDefault} data-part="scene.cast.default">
              <Ic name={isDefault ? "lucide:check" : "lucide:star"} size={16} />{isDefault ? "Default persona" : "Set as default persona"}
            </button>
          </CastFooter>
        </div>
      </div>
    </div>
  );
}
